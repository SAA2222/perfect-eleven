/**
 * OWNER-ONLY purchase lookup — the support tool behind "restore my purchase".
 *
 *   GET /api/restore?email=<customer email>&admin=<PREMIUM_COMP_CODE>
 *     → { ok:true, sessions:[{ id, when, amount, currency, paid, redemptions }] }
 *
 * Flow: customer emails support → owner calls this with their email → replies
 * with the customer's restore link:  https://perfect-eleven.vercel.app/?session_id=<id>
 * (verify-premium enforces the 3-device redemption cap as usual.)
 *
 * Auth = the PREMIUM_COMP_CODE env var, so only the owner can query. The Stripe
 * secret never leaves the server. Wrong/missing admin code → 403, no info leaked.
 */
import { Redis } from '@upstash/redis';

function makeKv() {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) return Redis.fromEnv();
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    return new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
  }
  return null;
}
const kv = makeKv();

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'GET') return res.status(405).json({ ok: false, reason: 'method' });

  const adminCode = (process.env.PREMIUM_COMP_CODE || '').trim();
  const given = (req.query.admin || '').toString().trim();
  if (!adminCode || given !== adminCode) return res.status(403).json({ ok: false, reason: 'forbidden' });

  const email = (req.query.email || '').toString().trim().toLowerCase();
  if (!email || !email.includes('@')) return res.status(400).json({ ok: false, reason: 'bad_email' });

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return res.status(503).json({ ok: false, reason: 'stripe_not_configured' });

  try {
    // Walk recent checkout sessions (up to 3 pages of 100) and match the email.
    const matches = [];
    let startingAfter = null;
    for (let page = 0; page < 3; page++) {
      const q = `limit=100${startingAfter ? `&starting_after=${startingAfter}` : ''}`;
      const r = await fetch(`https://api.stripe.com/v1/checkout/sessions?${q}`, {
        headers: { Authorization: `Bearer ${secret}` },
      });
      if (!r.ok) return res.status(200).json({ ok: false, reason: `stripe_${r.status}` });
      const data = await r.json();
      for (const s of data.data || []) {
        const em = ((s.customer_details || {}).email || '').toLowerCase();
        if (em === email) {
          let redemptions = 0;
          if (kv) { try { redemptions = (await kv.get(`pe:prem:redeem:${s.id}`)) || 0; } catch (e) {} }
          matches.push({
            id: s.id,
            when: new Date((s.created || 0) * 1000).toISOString(),
            amount: (s.amount_total || 0) / 100,
            currency: (s.currency || '').toUpperCase(),
            paid: s.payment_status === 'paid' || s.status === 'complete',
            redemptions,
          });
        }
      }
      if (!data.has_more || !(data.data || []).length) break;
      startingAfter = data.data[data.data.length - 1].id;
    }
    return res.status(200).json({ ok: true, email, sessions: matches });
  } catch (e) {
    return res.status(500).json({ ok: false, reason: 'error', message: e.message });
  }
}
