/**
 * LIVE TOURNAMENT PROXY — BALLDONTLIE FIFA World Cup API.
 *
 *   GET /api/live?view=today  → 2026 matches (live scores refresh ~60s)
 *   GET /api/live?view=stats  → cumulative tournament stats per player (goals/assists)
 *
 * The BALLDONTLIE key lives ONLY in the env var BALLDONTLIE_API_KEY (Vercel →
 * Settings → Environment Variables). Without it, both views return
 * { ok:false, reason:'no_key' } and the client hides all live UI.
 *
 * Upstash KV caching bounds our upstream rate regardless of site traffic:
 *   matches: 60s TTL  → ≤ ~1 upstream call/min even with thousands of visitors
 *   stats:   resume-paginated; 120s TTL until the full roster sweep completes,
 *            then 6h (cumulative stats don't need to be fresher). On the 5 req/min
 *            GOAT trial each refresh advances ≤4 pages and resumes via cursor.
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
const BASE = 'https://api.balldontlie.io/fifa/worldcup/v1';

async function bdl(path, key) {
  const r = await fetch(`${BASE}${path}`, { headers: { Authorization: key } });
  if (!r.ok) { const e = new Error(`bdl ${r.status}`); e.status = r.status; throw e; }
  return r.json();
}

// ---- view=today: all 2026 matches, compact ----
async function getMatches(key) {
  if (kv) { const hit = await kv.get('pe:live:matches'); if (hit) return hit; }
  const out = [];
  let cursor = null;
  for (let page = 0; page < 3; page++) {           // 104 matches ≤ 2 pages of 100
    const q = `/matches?per_page=100${cursor ? `&cursor=${cursor}` : ''}`;
    const res = await bdl(q, key);
    for (const m of res.data || []) {
      out.push({
        id: m.id,
        dt: m.datetime,
        status: m.status,                          // scheduled | in_progress | completed | …
        stage: m.stage && m.stage.name,
        home: m.home_team ? { code: m.home_team.abbreviation, name: m.home_team.name } : null,
        away: m.away_team ? { code: m.away_team.abbreviation, name: m.away_team.name } : null,
        ph: m.home_team_source && m.home_team_source.placeholder,   // "2A" etc. when TBD
        pa: m.away_team_source && m.away_team_source.placeholder,
        hs: m.home_score, as: m.away_score,
        hp: m.home_score_penalties, ap: m.away_score_penalties,
      });
    }
    cursor = res.meta && res.meta.next_cursor;
    if (!cursor) break;
  }
  const payload = { ok: true, matches: out, at: Date.now() };
  if (kv) await kv.set('pe:live:matches', payload, { ex: 60 });
  return payload;
}

// ---- view=stats: cumulative roster stats, resume-paginated across refreshes ----
// State and freshness are decoupled: the record lives 24h in KV (so partial
// sweep progress is never lost to a freshness expiry — that bug cost us a
// stuck-at-391 loop), and freshness is computed from its timestamp.
async function getStats(key) {
  const rec = kv ? await kv.get('pe:live:stats') : null;   // { state, at }
  const state = (rec && rec.state) || { players: {}, cursor: null, complete: false };
  const age = rec ? Date.now() - (rec.at || 0) : Infinity;
  const maxAge = state.complete ? 21600000 : 120000;       // 6h once complete, 2min while sweeping
  if (rec && age < maxAge) {
    return { ok: true, players: state.players, complete: state.complete, at: rec.at };
  }
  if (!state.complete) {
    try {
      for (let page = 0; page < 8; page++) {       // 13 pages total → completes in 2 refreshes
        const q = `/rosters?seasons[]=2026&per_page=100${state.cursor ? `&cursor=${state.cursor}` : ''}`;
        const res = await bdl(q, key);
        for (const row of res.data || []) {
          const p = row.player || {};
          if (!p.name) continue;
          // Key: TEAMCODE|normalized last name — matched client-side vs xi-data names.
          const last = String(p.name).normalize('NFD').replace(/[̀-ͯ]/g, '')
            .toLowerCase().trim().split(/\s+/).pop();
          const code = p.country_code || '';
          state.players[`${code}|${last}`] = {
            n: p.name, g: row.goals || 0, a: row.assists || 0,
            apps: row.appearances || 0, r: row.avg_rating || null,
          };
        }
        state.cursor = res.meta && res.meta.next_cursor;
        if (!state.cursor) { state.complete = true; break; }
      }
    } catch (e) {
      if (e.status !== 429) throw e;               // 429 mid-sweep: keep partial, resume next refresh
    }
  }
  const at = Date.now();
  if (kv) await kv.set('pe:live:stats', { state, at }, { ex: 86400 });
  return { ok: true, players: state.players, complete: state.complete, at };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=30');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ ok: false, reason: 'method' });

  const key = process.env.BALLDONTLIE_API_KEY;
  if (!key) return res.status(200).json({ ok: false, reason: 'no_key' });

  const view = (req.query.view || 'today').toString();
  try {
    if (view === 'stats') return res.status(200).json(await getStats(key));
    return res.status(200).json(await getMatches(key));
  } catch (e) {
    // Upstream auth/tier/rate problems → tell the client to stay quiet, not break.
    const reason = e.status === 401 ? 'tier' : e.status === 429 ? 'rate' : 'upstream';
    return res.status(200).json({ ok: false, reason, message: e.message });
  }
}
