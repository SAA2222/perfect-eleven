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
const STATS_V = 4;   // bump to invalidate the cached sweep (v4: MOTM overlay + slim response)

// Response payload: only players with something to SHOW (goals/assists/MOTM).
// The full 1,200-player map lives in KV for the overlay; shipping it to every
// client was 80KB per poll for data the UI never renders.
function emitStats(state, at) {
  const visible = {};
  for (const k of Object.keys(state.players)) {
    const p = state.players[k];
    if ((p.g || 0) > 0 || (p.a || 0) > 0 || (p.m || 0) > 0) visible[k] = p;
  }
  return { ok: true, players: visible, complete: state.complete, at };
}

async function getStats(key) {
  const rec = kv ? await kv.get('pe:live:stats') : null;   // { state, at }
  let state = (rec && rec.state) || null;
  if (!state || state.v !== STATS_V) {
    state = { v: STATS_V, players: {}, ids: {}, cursor: null, complete: false, teams: null,
              doneIds: [], doneTotals: {}, motmTotals: {}, hadLive: false };
  }
  const age = rec ? Date.now() - (rec.at || 0) : Infinity;
  // 2.5min while a match is LIVE (goal chips mid-match), 30min on idle tournament
  // days, 2min while the initial roster sweep is still running.
  const maxAge = state.hadLive ? 150000 : (state.complete ? 1800000 : 120000);
  if (rec && rec.state && rec.state.v === STATS_V && age < maxAge) {
    return emitStats(state, rec.at);
  }
  if (!state.complete) {
    try {
      // Teams map (id → abbreviation) — the abbreviations match the game's nation
      // codes (RSA/POR/GER…), unlike player country_code which is ISO (ZAF/PRT/DEU).
      if (!state.teams) {
        const t = await bdl('/teams', key);
        state.teams = {};
        for (const team of t.data || []) state.teams[team.id] = team.abbreviation;
      }
      for (let page = 0; page < 8; page++) {       // 13 pages total → completes in 2 refreshes
        const q = `/rosters?seasons[]=2026&per_page=100${state.cursor ? `&cursor=${state.cursor}` : ''}`;
        const res = await bdl(q, key);
        for (const row of res.data || []) {
          const p = row.player || {};
          if (!p.name) continue;
          // Key: TEAM-ABBR|normalized last name — matched client-side vs xi-data names.
          const last = String(p.name).normalize('NFD').replace(/[̀-ͯ]/g, '')
            .toLowerCase().trim().split(/\s+/).pop();
          const code = state.teams[row.team_id] || p.country_code || '';
          state.players[`${code}|${last}`] = {
            n: p.name, g: row.goals || 0, a: row.assists || 0,
            apps: row.appearances || 0, r: row.avg_rating || null,
          };
          if (p.id != null) state.ids[p.id] = `${code}|${last}`;   // for the per-match overlay
        }
        state.cursor = res.meta && res.meta.next_cursor;
        if (!state.cursor) { state.complete = true; break; }
      }
    } catch (e) {
      if (e.status !== 429) throw e;               // 429 mid-sweep: keep partial, resume next refresh
    }
  }

  // ---- REAL-TIME overlay: /rosters cumulative stats lag (verified: MEX 2-0 FT,
  // rosters still all-zero an hour later) but player_match_stats is live. Sum
  // G/A per player from started matches and override the roster numbers when
  // bigger. Completed matches are processed ONCE (doneIds); live matches are
  // re-read each refresh and never persisted (no double-count when they finish).
  try {
    const fetchTotals = async (ids) => {
      const totals = {};
      for (let i = 0; i < ids.length; i += 4) {
        const chunk = ids.slice(i, i + 4);
        let cursor = null;
        for (let page = 0; page < 6; page++) {
          const q = chunk.map(id => `match_ids[]=${id}`).join('&') + `&per_page=100${cursor ? `&cursor=${cursor}` : ''}`;
          const res = await bdl(`/player_match_stats?${q}`, key);
          for (const r of res.data || []) {
            const t = totals[r.player_id] || (totals[r.player_id] = [0, 0]);
            t[0] += r.goals || 0; t[1] += r.assists || 0;
          }
          cursor = res.meta && res.meta.next_cursor;
          if (!cursor) break;
        }
      }
      return totals;
    };
    const mp = await getMatches(key);
    const started = (mp.matches || []).filter(m => m.status === 'in_progress' || m.status === 'completed');
    const newDone = started.filter(m => m.status === 'completed' && !state.doneIds.includes(m.id)).map(m => m.id);
    const liveIds = started.filter(m => m.status === 'in_progress').map(m => m.id);
    if (newDone.length) {
      const t = await fetchTotals(newDone);
      for (const pid of Object.keys(t)) {
        const cur = state.doneTotals[pid] || [0, 0];
        state.doneTotals[pid] = [cur[0] + t[pid][0], cur[1] + t[pid][1]];
      }
      // Official Man of the Match per finished game → real Golden Ball race.
      try {
        state.motmTotals = state.motmTotals || {};
        for (let i = 0; i < newDone.length; i += 4) {
          const chunk = newDone.slice(i, i + 4);
          let cursor = null;
          for (let page = 0; page < 4; page++) {
            const q = chunk.map(id => `match_ids[]=${id}`).join('&') + `&per_page=100${cursor ? `&cursor=${cursor}` : ''}`;
            const res = await bdl(`/match_best_players?${q}`, key);
            for (const r of res.data || []) {
              if (r.is_man_of_match) state.motmTotals[r.player_id] = (state.motmTotals[r.player_id] || 0) + 1;
            }
            cursor = res.meta && res.meta.next_cursor;
            if (!cursor) break;
          }
        }
      } catch (e) { /* MOTM is garnish — never block goals on it */ }
      state.doneIds.push(...newDone);
    }
    const liveTotals = liveIds.length ? await fetchTotals(liveIds) : {};
    state.hadLive = liveIds.length > 0;
    const merged = {};
    for (const pid of Object.keys(state.doneTotals)) merged[pid] = [...state.doneTotals[pid]];
    for (const pid of Object.keys(liveTotals)) {
      const cur = merged[pid] || [0, 0];
      merged[pid] = [cur[0] + liveTotals[pid][0], cur[1] + liveTotals[pid][1]];
    }
    for (const pid of Object.keys(merged)) {
      const k = state.ids[pid];
      const pl = k && state.players[k];
      if (!pl) continue;
      if (merged[pid][0] > (pl.g || 0)) pl.g = merged[pid][0];
      if (merged[pid][1] > (pl.a || 0)) pl.a = merged[pid][1];
    }
    for (const pid of Object.keys(state.motmTotals || {})) {
      const k = state.ids[pid];
      const pl = k && state.players[k];
      if (pl) pl.m = state.motmTotals[pid];
    }
  } catch (e) { /* overlay is best-effort — the roster base still serves */ }

  const at = Date.now();
  if (kv) await kv.set('pe:live:stats', { state, at }, { ex: 86400 });
  return emitStats(state, at);
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
