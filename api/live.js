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
const STATS_V = 7;   // bump to invalidate the cached sweep (v6: unique player keys — shared
                     // surnames collided: all four KOR "Lee"s merged into one record and the
                     // last writer DELETED Kang-in Lee's +2 form)

// Bounded FORM delta on the game OVR: avg real match rating (0-10) bands,
// PLUS a goal-contribution kicker so scorers always read GREEN (a 7.1-rated
// goalscorer in a loss is form, not neutral — user rule). Clamped to ±3.
// Contribution rate is per RATED match, so one early goal stops carrying a
// striker who goes quiet for the rest of the tournament.
function formDelta(avg, matches, ga) {
  let d = 0;
  if (matches && avg != null) {
    if (avg >= 8.5) d = 3;
    else if (avg >= 8.0) d = 2;
    else if (avg >= 7.5) d = 1;
    else if (avg < 6.0) d = -2;
    else if (avg < 6.5) d = -1;
  }
  // Ratings lag the final whistle — until they land, raw G+A drives the kicker
  // (a scorer flips green at the goal, mid-match).
  const rate = matches ? (ga || 0) / matches : (ga || 0);
  if (rate >= 1.5) d += 2;
  else if (rate >= 0.75) d += 1;
  return Math.max(-3, Math.min(3, d));
}

// Response payload: only players with something to SHOW (goals/assists/MOTM/form).
// The full 1,200-player map lives in KV for the overlay; shipping it to every
// client was 80KB per poll for data the UI never renders.
//
// Each visible player carries `k`: name aliases VETTED against the full squad
// (full name always; last/first token only when unique within the team). The
// client indexes exactly these — it can't see absent teammates in the slim
// payload, so ambiguity must be resolved here where the whole roster lives
// (the "Raúl Rangel inherited Jiménez's goal" class of bug).
const _normName = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const _SUFFIX = /^(jr\.?|junior|sr\.?|senior|ii|iii|iv|filho|neto)$/;
function emitStats(state, at) {
  // Token usage per team across the FULL squad (one count per token per player).
  const counts = {};
  for (const k of Object.keys(state.players)) {
    const code = k.split('|')[0];
    const c = counts[code] || (counts[code] = {});
    for (const t of new Set(_normName(state.players[k].n).split(/\s+/).filter(Boolean))) {
      c[t] = (c[t] || 0) + 1;
    }
  }
  const visible = {};
  for (const k of Object.keys(state.players)) {
    const p = state.players[k];
    if (!((p.g || 0) > 0 || (p.a || 0) > 0 || (p.m || 0) > 0 || (p.f || 0) !== 0)) continue;
    const code = k.split('|')[0];
    const toks = _normName(p.n).split(/\s+/).filter(Boolean);
    const c = counts[code] || {};
    const aliases = new Set(toks.length ? [toks.join(' ')] : []);
    let i = toks.length - 1;
    while (i > 0 && _SUFFIX.test(toks[i])) i--;          // last MEANINGFUL token
    if (c[toks[i]] === 1) aliases.add(toks[i]);
    if (toks.length && c[toks[0]] === 1) aliases.add(toks[0]);
    visible[k] = { ...p, k: [...aliases] };
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
          if (!p.name || p.id == null) continue;
          // Key: TEAM-ABBR|player_id — UNIQUE. Keying by last name merged every
          // shared surname into one record (KOR has four "Lee"s; the last writer
          // deleted Kang-in Lee's form). Client matching uses the emitted alias
          // tokens (see emitStats), never the key itself — only its code prefix.
          const code = state.teams[row.team_id] || p.country_code || '';
          state.players[`${code}|${p.id}`] = {
            n: p.name, g: row.goals || 0, a: row.assists || 0,
            apps: row.appearances || 0, r: row.avg_rating || null,
          };
          state.ids[p.id] = `${code}|${p.id}`;   // for the per-match overlay
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
    // Per player: [goals, assists, ratingSum, ratedMatches]. Match ratings only
    // count with ≥20 minutes played — a 5-minute cameo shouldn't define form.
    // `meta` (optional) reports rating coverage: of the rows with ≥20 minutes,
    // how many carry a rating yet (they land minutes AFTER the final whistle).
    const fetchTotals = async (ids, meta) => {
      const totals = {};
      for (let i = 0; i < ids.length; i += 4) {
        const chunk = ids.slice(i, i + 4);
        let cursor = null;
        for (let page = 0; page < 6; page++) {
          const q = chunk.map(id => `match_ids[]=${id}`).join('&') + `&per_page=100${cursor ? `&cursor=${cursor}` : ''}`;
          const res = await bdl(`/player_match_stats?${q}`, key);
          for (const r of res.data || []) {
            const t = totals[r.player_id] || (totals[r.player_id] = [0, 0, 0, 0]);
            t[0] += r.goals || 0; t[1] += r.assists || 0;
            const mins = r.minutes_played || 0;
            if (mins >= 20 && meta) meta.eligible++;
            if (r.rating != null && mins >= 20) { t[2] += r.rating; t[3] += 1; if (meta) meta.rated++; }
          }
          cursor = res.meta && res.meta.next_cursor;
          if (!cursor) break;
        }
      }
      return totals;
    };
    const mp = await getMatches(key);
    const started = (mp.matches || []).filter(m => m.status === 'in_progress' || m.status === 'completed');
    const newDone = started.filter(m => m.status === 'completed' && !state.doneIds.includes(m.id));
    const liveIds = started.filter(m => m.status === 'in_progress').map(m => m.id);
    // A completed match is folded into doneTotals ONCE — but only when its
    // ratings have actually landed (they lag the final whistle). Until then it
    // is merged transiently like a live match, so goals show immediately and
    // form follows a refresh or two later. After 24h we take what exists.
    const transients = [];
    const acceptedDone = [];
    for (const m of newDone) {
      const meta = { eligible: 0, rated: 0 };
      const t = await fetchTotals([m.id], meta);
      const stale = m.dt && (Date.now() - new Date(m.dt).getTime()) > 24 * 3600000;
      if (!stale && (meta.eligible === 0 || meta.rated / meta.eligible < 0.5)) {
        transients.push(t);                        // stats/ratings not in yet — don't persist
        continue;
      }
      for (const pid of Object.keys(t)) {
        const cur = state.doneTotals[pid] || [0, 0, 0, 0];
        state.doneTotals[pid] = [
          cur[0] + t[pid][0], cur[1] + t[pid][1],
          (cur[2] || 0) + t[pid][2], (cur[3] || 0) + t[pid][3],
        ];
      }
      acceptedDone.push(m.id);
    }
    if (acceptedDone.length) {
      // Official Man of the Match per finished game → real Golden Ball race.
      try {
        state.motmTotals = state.motmTotals || {};
        for (let i = 0; i < acceptedDone.length; i += 4) {
          const chunk = acceptedDone.slice(i, i + 4);
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
      state.doneIds.push(...acceptedDone);
    }
    const liveTotals = liveIds.length ? await fetchTotals(liveIds) : {};
    // Ratings-waiting matches keep the fast refresh cadence so form lands quickly.
    state.hadLive = liveIds.length > 0 || transients.length > 0;
    const merged = {};
    for (const pid of Object.keys(state.doneTotals)) merged[pid] = [...state.doneTotals[pid]];
    for (const t of [liveTotals, ...transients]) {
      for (const pid of Object.keys(t)) {
        const cur = merged[pid] || [0, 0, 0, 0];
        merged[pid] = [cur[0] + t[pid][0], cur[1] + t[pid][1], (cur[2] || 0) + t[pid][2], (cur[3] || 0) + t[pid][3]];
      }
    }
    for (const pid of Object.keys(merged)) {
      const k = state.ids[pid];
      const pl = k && state.players[k];
      if (!pl) continue;
      if (merged[pid][0] > (pl.g || 0)) pl.g = merged[pid][0];
      if (merged[pid][1] > (pl.a || 0)) pl.a = merged[pid][1];
      const rc = merged[pid][3] || 0;
      const ga = (merged[pid][0] || 0) + (merged[pid][1] || 0);
      const f = formDelta(rc ? merged[pid][2] / rc : null, rc, ga);
      if (f) pl.f = f; else delete pl.f;   // form can cool back to neutral
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
