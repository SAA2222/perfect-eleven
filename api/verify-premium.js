/**
 * Premium verification — proves a REAL, PAID, LIVE Stripe checkout before
 * unlocking. This closes the client-side leak: a guessed ?premium=token, a free
 * test-mode checkout, or a shared link no longer work. Only a genuine completed
 * payment on YOUR live Stripe account (or your private comp code) unlocks.
 *
 *   GET /api/verify-premium?session_id=cs_live_...  → { premium: true } | { premium:false, reason }
 *   GET /api/verify-premium?comp=<code>             → owner/comp access
 *
 * Env vars (add in Vercel → Project → Settings → Environment Variables):
 *   STRIPE_SECRET_KEY    LIVE secret key  (sk_live_…)   ← REQUIRED. Never commit it.
 *   PREMIUM_COMP_CODE    optional private code you can hand out for free access
 *   UPSTASH_REDIS_REST_* / KV_REST_API_*   already linked for the leaderboard
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

// One purchase can unlock at most this many browsers (covers a buyer's own
// phone + laptop) — stops a buyer pasting their ?session_id= URL for everyone.
const MAX_REDEMPTIONS = 3;
const REDEEM_TTL_SEC = 60 * 60 * 24 * 400; // ~13 months

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ premium: false, reason: 'method' });

  const sessionId = (req.query.session_id || '').toString().trim();
  const comp = (req.query.comp || '').toString().trim();

  // ----- Owner / comp code (secret lives in server env, never in client) -----
  if (comp) {
    // trim both sides: env values piped in can carry a stray trailing newline
    const code = (process.env.PREMIUM_COMP_CODE || '').trim();
    if (code && comp.trim() === code) return res.status(200).json({ premium: true, via: 'comp' });
    return res.status(200).json({ premium: false, reason: 'bad_comp' });
  }

  if (!sessionId) return res.status(400).json({ premium: false, reason: 'no_session' });
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    return res.status(200).json({ premium: false, reason: 'bad_id' });
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return res.status(503).json({
      premium: false, reason: 'not_configured',
      hint: 'Add STRIPE_SECRET_KEY (sk_live_…) in Vercel → Settings → Environment Variables.',
    });
  }

  try {
    // Pull the session straight from Stripe with the LIVE secret key. A guessed
    // id, a test-mode id, or another account's id all fail (404 / wrong key).
    const r = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
      { headers: { Authorization: `Bearer ${secret}` } }
    );
    if (!r.ok) {
      return res.status(200).json({ premium: false, reason: r.status === 404 ? 'not_found' : 'stripe_error' });
    }
    const session = await r.json();
    const paid = session && (session.payment_status === 'paid' || session.status === 'complete');
    if (!paid) return res.status(200).json({ premium: false, reason: 'not_paid' });

    // Redemption cap — block one receipt unlocking the whole group chat.
    if (kv) {
      const key = `pe:prem:redeem:${sessionId}`;
      const n = await kv.incr(key);
      if (n === 1) await kv.expire(key, REDEEM_TTL_SEC);
      if (n > MAX_REDEMPTIONS) return res.status(200).json({ premium: false, reason: 'redeemed' });
    }

    return res.status(200).json({ premium: true, via: 'stripe' });
  } catch (e) {
    return res.status(500).json({ premium: false, reason: 'error', message: e.message });
  }
}
