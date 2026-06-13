/**
 * Global shared leaderboard endpoint — backed by Upstash Redis.
 *
 * GET  /api/leaderboard           → { entries: [top 100 by OVR] }
 * POST /api/leaderboard {entry}   → { ok: true, entry } | 400 | 429
 *
 * Requires env vars (auto-injected when Upstash KV is linked to the project):
 *   KV_REST_API_URL    (or UPSTASH_REDIS_REST_URL)
 *   KV_REST_API_TOKEN  (or UPSTASH_REDIS_REST_TOKEN)
 *
 * If KV isn't connected the endpoint responds 503 — the client falls back to
 * localStorage so the app stays usable.
 */
import { Redis } from '@upstash/redis';

// fromEnv() reads UPSTASH_REDIS_REST_URL / TOKEN automatically.
// Fallback to KV_REST_API_* if the Vercel-integration variant is in use.
function makeKv() {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return Redis.fromEnv();
  }
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    return new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
  }
  return null;
}
const kv = makeKv();

const KEY = 'pe:lineups:v1';
const MAX_STORED = 600;       // retain more history so low-volume modes don't age out
const TOP_RETURN = 100;       // (legacy global cap — superseded by PER_MODE_RETURN below)
const PER_MODE_RETURN = 50;   // top-N per mode so EVERY mode tab is populated regardless
                              // of the global OVR race (TOP50 lineups league-mix → low
                              // chem → low OVR, and were falling below the global cutoff)
// Mirror of the client normalizeMode so per-mode bucketing agrees with the tabs.
function normMode(m) {
  const v = String(m || 'CLASSIC').toUpperCase().replace(/\s+/g, '');
  if (v === 'TOP50' || v === 'TOP-50') return 'TOP50';
  if (v === 'LEGEND' || v === 'LEGENDS') return 'LEGENDS';
  if (v === 'TACTICAL') return 'TACTICAL';
  if (v === 'DAILY') return 'DAILY';
  if (v === 'CLASSIC') return 'CLASSIC';
  return v;
}
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

// Profanity guard for the public "by" field (the only free-text input).
const PROFANITY_RE = /(nigg|\bfagg|\bfag\b|kike|\bspic\b|chink|\bcoon\b|trann|retard|\bcunt|fuck|\bshit|bitch|whore|\bslut|pussy|asshole|bastard|motherf|\bwank|\bkys\b|\bporn|nazi|dickhead)/i;
// Structured XI for LIVE scoring: [[code, name], …] ≤ 11. Lets the client
// recompute each entry's live form delta (real-world goals/ratings) so the
// board reshuffles through the day. Bounded + sanitized.
function cleanXI(xi) {
  if (!Array.isArray(xi)) return null;
  const out = [];
  for (const it of xi.slice(0, 11)) {
    if (!Array.isArray(it)) continue;
    const code = sanitize(String(it[0] || ''), 4).toUpperCase().replace(/[^A-Z]/g, '');
    const name = sanitize(String(it[1] || ''), 28);
    if (code && name) out.push([code, name]);
  }
  return out.length ? out : null;
}

function cleanBy(s) {
  const v = sanitize(s, 48);   // room for "BUILT BY NAME · CITY"
  if (!v) return 'BUILT BY ANONYMOUS · EARTH';
  const norm = v.toLowerCase()
    .replace(/[\s._\-*'`]+/g, '')
    .replace(/0/g, 'o').replace(/[1!|]/g, 'i').replace(/3/g, 'e')
    .replace(/4/g, 'a').replace(/@/g, 'a').replace(/[$5]/g, 's').replace(/7/g, 't');
  if (PROFANITY_RE.test(norm) || PROFANITY_RE.test(v.toLowerCase())) return 'BUILT BY ANONYMOUS · EARTH';
  // Guarantee a city — every stored entry reads NAME · CITY.
  return /·/.test(v) ? v : `${v} · EARTH`;
}

function kvConfigured() {
  return kv !== null;
}

// Stable short hash for the dedup key (FNV-1a → base36).
function hashKey(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
const DEDUP_WINDOW_SEC = 60;

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
        .filter(Boolean);
      // Top-N PER MODE so every mode tab is populated even when one mode's OVRs
      // dominate the global ranking (TOP50 = world-best players from many leagues
      // → low chem → low OVR, was getting buried under high-chem CLASSIC builds).
      const byMode = {};
      for (const e of parsed) {
        const m = normMode(e.mode);
        (byMode[m] || (byMode[m] = [])).push(e);
      }
      const balanced = [];
      for (const m of Object.keys(byMode)) {
        byMode[m].sort((a, b) => (b.ovr || 0) - (a.ovr || 0));
        balanced.push(...byMode[m].slice(0, PER_MODE_RETURN));
      }
      balanced.sort((a, b) => (b.ovr || 0) - (a.ovr || 0));
      return res.status(200).json({ entries: balanced });
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
      const { by, ovr, chem, mode, lineup, finish, expert, xi, bfs } = body || {};
      const FINISH_TIERS = ['CHAMPIONS','RUNNERS_UP','THIRD','FOURTH','QUARTERFINAL','R16','R32','GROUP_OUT'];

      const entry = {
        by:     cleanBy(by),
        ovr:    Math.max(0, Math.min(110, parseInt(ovr) || 0)),  // chem tops out ~107; cap blocks absurd forged scores
        chem:   Math.max(0, Math.min(99, parseInt(chem) || 0)),
        mode:   sanitize(mode, 16).toUpperCase() || 'CLASSIC',
        lineup: sanitize(lineup, 320),
        xi:     cleanXI(xi),                              // structured 11 → live form recompute
        bfs:    Math.max(-55, Math.min(55, parseInt(bfs) || 0)),  // form sum baked in at submit
        finish: FINISH_TIERS.includes(String(finish)) ? String(finish) : null,
        expert: expert === true || expert === 'true',   // blind/expert draft → 2× leaderboard score
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

      // Dedup backstop: drop an identical entry (same person + lineup + score +
      // mode) within a short window — stops accidental double-posts even if the
      // client-side guard is bypassed. Keyed by IP too: in the DAILY everyone
      // faces the same 11, so two different ANONYMOUS players can legitimately
      // post identical lineup+score — they must not collide. Fail-open on KV error.
      try {
        const dupKey = `pe:dup:${hashKey(`${ip}|${entry.by}|${entry.lineup}|${entry.ovr}|${entry.mode}`)}`;
        const firstTime = await kv.set(dupKey, 1, { nx: true, ex: DEDUP_WINDOW_SEC });
        if (firstTime === null) {
          return res.status(200).json({ ok: true, duplicate: true, entry });  // silently ignore
        }
      } catch (e) { /* dedup unavailable — don't block the post */ }

      await kv.lpush(KEY, JSON.stringify(entry));
      await kv.ltrim(KEY, 0, MAX_STORED - 1);

      return res.status(200).json({ ok: true, entry });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
}
