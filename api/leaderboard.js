/**
 * Global shared leaderboard endpoint — backed by Vercel KV (Upstash Redis).
 *
 * GET  /api/leaderboard           → { entries: [top 100 by OVR] }
 * POST /api/leaderboard {entry}   → { ok: true, entry } | 400 | 429
 *
 * Requires env vars (auto-injected when KV is linked to the Vercel project):
 *   KV_REST_API_URL
 *   KV_REST_API_TOKEN
 *
 * If KV isn't connected the endpoint responds 503 — the client falls back to
 * localStorage so the app stays usable.
 */
import { kv } from '@vercel/kv';

const KEY = 'pe:lineups:v1';
const MAX_STORED = 200;
const TOP_RETURN = 100;
const RL_WINDOW_SEC = 60;
const RL_MAX_PER_WINDOW = 3;

function sanitize(s, maxLen) {
  if (typeof s !== 'string') return '';
  return s
    .replace(/[<>]/g, '')           // strip angle brackets (XSS)
    .replace(/\s+/g, ' ')           // collapse whitespace
    .trim()
    .slice(0, maxLen);
}

function kvConfigured() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

export default async function handler(req, res) {
  // Permissive CORS so the static client (and Vercel preview deploys) can call.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!kvConfigured()) {
    return res.status(503).json({
      error: 'Leaderboard storage not configured',
      hint: 'Create a Vercel KV instance and link it to the project (Storage tab in Vercel dashboard).',
    });
  }

  // ===== GET: read top entries =====
  if (req.method === 'GET') {
    try {
      const raw = await kv.lrange(KEY, 0, MAX_STORED - 1);
      const parsed = (raw || [])
        .map(e => {
          try { return typeof e === 'string' ? JSON.parse(e) : e; }
          catch { return null; }
        })
        .filter(Boolean)
        .sort((a, b) => (b.ovr || 0) - (a.ovr || 0))
        .slice(0, TOP_RETURN);
      return res.status(200).json({ entries: parsed });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ===== POST: submit new entry =====
  if (req.method === 'POST') {
    try {
      let body = req.body;
      // Some Vercel runtimes don't auto-parse JSON
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch {} }
      const { by, ovr, chem, mode, lineup } = body || {};

      const entry = {
        by:     sanitize(by, 40) || 'ANONYMOUS',
        ovr:    Math.max(0, Math.min(100, parseInt(ovr) || 0)),
        chem:   Math.max(0, Math.min(99, parseInt(chem) || 0)),
        mode:   sanitize(mode, 16).toUpperCase() || 'CLASSIC',
        lineup: sanitize(lineup, 320),
        createdAt: Date.now(),
      };
      if (!entry.ovr || !entry.lineup) {
        return res.status(400).json({ error: 'Missing required fields (ovr + lineup)' });
      }

      // Rate limit by client IP (3 submissions per minute)
      const ip = (req.headers['x-forwarded-for']?.split(',')[0]
              || req.headers['x-real-ip']
              || 'unknown').trim();
      const rateKey = `pe:rl:lb:${ip}`;
      const count = await kv.incr(rateKey);
      if (count === 1) await kv.expire(rateKey, RL_WINDOW_SEC);
      if (count > RL_MAX_PER_WINDOW) {
        return res.status(429).json({ error: 'Too many submissions — try again in a minute' });
      }

      await kv.lpush(KEY, JSON.stringify(entry));
      await kv.ltrim(KEY, 0, MAX_STORED - 1);

      return res.status(200).json({ ok: true, entry });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
}
