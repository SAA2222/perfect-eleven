/* ============================================================
   LIVE TOURNAMENT STATS — 2026 FIFA WORLD CUP
   Auto-updated daily during the tournament via scripts/fetch-stats.js
   (GitHub Action workflow: .github/workflows/update-stats.yml)
   Manually trigger with: node scripts/fetch-stats.js
   ============================================================ */
window.LIVE_STATS = {
  // Tournament phase — drives whether UI shows live data or simulated:
  // "PRE" | "GROUP" | "RO32" | "RO16" | "QF" | "SF" | "FINAL" | "COMPLETE"
  status: "PRE",

  // ISO date last successful update ran
  updatedAt: "2026-06-05",

  // Award leaders — populated by scraper, displayed in the COMPLETE modal
  // when status !== "PRE" (overriding the simulated picks)
  awards: {
    goldenBoot:   null,  // { name, code, value: goals }
    goldenBall:   null,  // { name, code }  — MOTM aggregate
    goldenGlove:  null,  // { name, code, value: cleanSheets }
    topAssister:  null,  // { name, code, value: assists }
    youngPlayer:  null,  // { name, code, age }
    bestDefender: null,
    bestMidfielder: null,
  },

  // Per-player stats — keyed by EXACT player name as in xi-data.js
  // { "Kylian Mbappé": { G: 0, A: 0, MOTM: 0, redCards: 0 }, ... }
  players: {},

  // Real, confirmed injuries (overrides simulated injury rolls in UI)
  // [{ name, code, reason, out }]  — out: "GROUP" | "RO32" | "TOURNAMENT"
  injuries: [],

  // Latest results — { date, home, away, homeScore, awayScore, scorers: [{name, minute}] }
  results: [],
};

/* ============================================================
   LIVE MODE — real matches + real player stats via /api/live
   (BALLDONTLIE proxy). Fails SILENT: no key / no data → no UI.
   ============================================================ */
let _liveGoals = {};        // "CODE|lastname" → { n, g, a, apps, r } (raw server map)
let _liveIdx = {};          // multi-key lookup index built from _liveGoals
let _livePollTimer = null;
// Localhost previews have no serverless functions — point at prod so the live
// pipeline can be exercised outside Vercel. Empty string = same-origin (prod).
const LIVE_API_BASE = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'https://perfect-eleven.vercel.app' : '';

function _liveNorm(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
const _LIVE_SUFFIX = /^(jr\.?|junior|sr\.?|senior|ii|iii|iv|filho|neto)$/;
function _liveTokens(name) {
  return _liveNorm(name).replace(/\s*\(peak\)\s*$/, '').split(/\s+/).filter(Boolean);
}
// Last meaningful token: "Vinicius Junior" → "vinicius", "Son Heung-min" → "heung-min".
function _liveLastTok(name) {
  const t = _liveTokens(name);
  let i = t.length - 1;
  while (i > 0 && _LIVE_SUFFIX.test(t[i])) i--;
  return t[i] || '';
}
// Build the lookup index. Servers ≥ v6 emit per-player alias tokens (`k`)
// VETTED against the full squad (full name always; last/first token only when
// unique within the team) — those are indexed as-is; ambiguity was resolved
// where the whole roster lives. Legacy payloads without `k` fall back to local
// tokenization: CODE|last-meaningful-token AND CODE|first-token, with keys
// claimed by two DIFFERENT players (e.g. the Thuram brothers) dropped.
let _liveIdxVetted = false;
function _buildLiveIdx(players) {
  const idx = {}, dropped = new Set();
  let vetted = true;
  for (const k of Object.keys(players || {})) {
    const v = players[k];
    const code = k.split('|')[0];
    if (Array.isArray(v.k) && v.k.length) {
      for (const alias of v.k) idx[`${code}|${alias}`] = v;
      continue;
    }
    vetted = false;
    const toks = _liveTokens(v.n);
    if (!toks.length) continue;
    const keys = new Set([`${code}|${_liveLastTok(v.n)}`, `${code}|${toks[0]}`]);
    for (const kk of keys) {
      if (dropped.has(kk)) continue;
      if (idx[kk] && idx[kk].n !== v.n) { delete idx[kk]; dropped.add(kk); continue; }
      idx[kk] = v;
    }
  }
  _liveIdxVetted = vetted && Object.keys(players || {}).length > 0;
  return idx;
}
// Map an xi-data roster player → live stats: exact full name, then last token,
// then first token. With a VETTED index the first-token try is safe — the
// server only emitted tokens unique within the squad, so "Raúl Rangel" can
// never inherit Raúl Jiménez's goal (both Raúls → no 'raul' alias at all).
// On legacy indexes the first-token fallback stays MONONYM-ONLY ("Rodrygo"):
// the slim payload hides teammates, so local ambiguity checks can't be trusted.
function liveStatFor(p) {
  if (!p || !p.code || !p.name) return null;
  const toks = _liveTokens(p.name);
  if (!toks.length) return null;
  const full = _liveIdx[`${p.code}|${toks.join(' ')}`];
  if (full) return full;
  const hit = _liveIdx[`${p.code}|${_liveLastTok(p.name)}`];
  if (hit) return hit;
  if (_liveIdxVetted || toks.length === 1) return _liveIdx[`${p.code}|${toks[0]}`] || null;
  return null;
}
// Small "⚽N" chip for slot cards — only once a player has REAL tournament goals.
function liveChipFor(p) {
  const s = liveStatFor(p);
  if (!s || !s.g) return '';
  return `<span class="slot__live-chip" title="${s.n}: ${s.g} World Cup goal${s.g > 1 ? 's' : ''}">⚽${s.g}</span>`;
}

function _liveTimeLabel(m) {
  if (m.status === 'in_progress') return '🔴 LIVE';
  if (m.status === 'completed') return 'FT';
  try {
    const d = new Date(m.dt);
    const t = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    // More than ~20h out → include the weekday ("THU 3:00 PM")
    if (d - Date.now() > 20 * 3600000) {
      return `${d.toLocaleDateString([], { weekday: 'short' }).toUpperCase()} ${t}`;
    }
    return t;
  } catch (e) { return ''; }
}
function _liveScore(m) {
  if (m.hs == null || m.as == null) return 'vs';
  const pens = (m.hp != null && m.ap != null) ? ` (${m.hp}–${m.ap}p)` : '';
  return `${m.hs}–${m.as}${pens}`;
}
function renderMatchdayStrip(matches) {
  const strip = document.getElementById('matchdayStrip');
  if (!strip) return;
  const now = Date.now();
  // Window: live now, finished in the last 12h, or kicking off in the next 48h
  // (wide enough that tournament-eve shows the opening fixtures with day labels;
  // during the tournament there are matches daily, so this only matters on quiet days).
  const windowed = (matches || []).filter(m => {
    const t = Date.parse(m.dt || 0);
    if (m.status === 'in_progress') return true;
    if (m.status === 'completed') return now - t < 12 * 3600000;
    return t - now > 0 && t - now < 48 * 3600000;
  }).slice(0, 10);
  if (!windowed.length) { strip.hidden = true; return; }
  const anyLive = windowed.some(m => m.status === 'in_progress');
  // Real tournament leaders: a full-width SECOND ROW under the fixtures (a chip
  // at the end of the scrolling track kept getting clipped).
  let leadersRow = '';
  const L = window._liveLeaders;
  if (L && (L.boot || L.assist || L.motm)) {
    const bits = [];
    if (L.boot)   bits.push(`⚽ TOP SCORER ${L.boot[0]} (${L.boot[1]})`);
    if (L.assist) bits.push(`🅰️ ASSISTS ${L.assist[0]} (${L.assist[1]})`);
    if (L.motm)   bits.push(`🏆 MOTM ${L.motm[0]}${L.motm[1] > 1 ? ` (${L.motm[1]})` : ''}`);
    leadersRow = `<div class="matchday__leaders"><b>LEADERS</b> ${bits.join(' · ')}</div>`;
  }
  strip.hidden = false;
  strip.innerHTML = `
    <div class="matchday__row">
      <span class="matchday__label">${anyLive ? '🔴 MATCHDAY — LIVE' : '⚽ MATCHDAY'}</span>
      <div class="matchday__track">
        ${windowed.map(m => `
          <span class="matchday__chip${m.status === 'in_progress' ? ' matchday__chip--live' : ''}">
            <b>${(m.home && m.home.code) || m.ph || 'TBD'}</b>
            <span class="matchday__score">${_liveScore(m)}</span>
            <b>${(m.away && m.away.code) || m.pa || 'TBD'}</b>
            <span class="matchday__time">${_liveTimeLabel(m)}</span>
          </span>`).join('')}
      </div>
    </div>
    ${leadersRow}`;
  return anyLive;
}

// Map real match progress → LIVE_STATS.status, which flips the app's whole live
// pipeline (topbar badge, real award overrides, live injuries) on automatically.
const _STAGE_PHASE = {
  'Group Stage': 'GROUP', 'Round of 32': 'RO32', 'Round of 16': 'RO16',
  'Quarter-finals': 'QF', 'Quarter-final': 'QF', 'Semi-finals': 'SF',
  'Semi-final': 'SF', 'Third place play-off': 'SF', 'Final': 'FINAL',
};
function updateTournamentPhase(matches) {
  const started = (matches || []).filter(m => m.status === 'in_progress' || m.status === 'completed');
  if (!started.length || !window.LIVE_STATS) return;
  started.sort((a, b) => Date.parse(b.dt) - Date.parse(a.dt));
  window.LIVE_STATS.status = _STAGE_PHASE[started[0].stage] || 'GROUP';
  window.LIVE_STATS.updatedAt = new Date().toISOString().slice(0, 10);
  if (typeof initLiveBadge === 'function' && !document.querySelector('.topbar__livebadge')) {
    try { initLiveBadge(); } catch (e) {}
  }
}

async function refreshLiveMode() {
  try {
    const r = await fetch(LIVE_API_BASE + '/api/live?view=today');
    const data = await r.json();
    if (!data || !data.ok) { const s = document.getElementById('matchdayStrip'); if (s) s.hidden = true; return; }
    window._liveMatchesCache = data.matches;   // lets the stats loader refresh the strip
    const anyLive = renderMatchdayStrip(data.matches);
    updateTournamentPhase(data.matches);
    // Feed real scores into the top news ticker (replaces the stale pre-match line).
    try {
      const hl = [];
      const live = (data.matches || []).filter(m => m.status === 'in_progress');
      const done = (data.matches || [])
        .filter(m => m.status === 'completed' && Date.now() - Date.parse(m.dt) < 24 * 3600000)
        .sort((a, b) => Date.parse(b.dt) - Date.parse(a.dt));
      for (const m of live.slice(0, 2)) {
        hl.push(`🔴 LIVE · ${(m.home && m.home.code) || '?'} ${m.hs ?? 0}–${m.as ?? 0} ${(m.away && m.away.code) || '?'}`);
      }
      for (const m of done.slice(0, 2)) {
        hl.push(`FT · ${(m.home && m.home.code) || '?'} ${m.hs}–${m.as} ${(m.away && m.away.code) || '?'}`);
      }
      if (hl.length && typeof setLiveTickerHeadlines === 'function') setLiveTickerHeadlines(hl);
    } catch (e) { /* ticker stays editorial */ }
    // Poll faster while matches are live, slower around kickoff windows.
    if (_livePollTimer) clearTimeout(_livePollTimer);
    _livePollTimer = setTimeout(refreshLiveMode, anyLive ? 90000 : 600000);
  } catch (e) { /* offline / no api — stay quiet */ }
}
async function loadLiveStats() {
  try {
    const r = await fetch(LIVE_API_BASE + '/api/live?view=stats');
    const data = await r.json();
    if (data && data.ok && data.players) {
      _liveGoals = data.players;
      _liveIdx = _buildLiveIdx(_liveGoals);
      // Feed the app's existing LIVE_STATS consumers (real award overrides on the
      // complete screen, ⚽/🎯 badges on pick cards) — keyed by EXACT xi-data names.
      try {
        if (typeof NATIONS !== 'undefined' && window.LIVE_STATS) {
          const map = {};
          for (const n of NATIONS) {
            for (const p of (n.players || [])) {
              const s = liveStatFor({ code: n.code, name: p.name });
              if (s && (s.g || s.a || s.m)) map[p.name] = { G: s.g || 0, A: s.a || 0, MOTM: s.m || 0, redCards: 0 };
            }
          }
          window.LIVE_STATS.players = map;
          // Tournament leaders (xi-matched names) → gold LEADERS chip on the
          // matchday strip. Re-render the strip if it's already on screen.
          const top = (key) => Object.entries(map)
            .map(([name, s]) => [name, s[key] || 0]).filter(([, v]) => v > 0)
            .sort((a, b) => b[1] - a[1])[0] || null;
          window._liveLeaders = { boot: top('G'), assist: top('A'), motm: top('MOTM') };
          if (window._liveMatchesCache) renderMatchdayStrip(window._liveMatchesCache);
        }
      } catch (e) { /* keep chips working even if the feed fails */ }
      // Repaint filled slots so ⚽ chips appear on players who have really scored.
      if (typeof state !== 'undefined' && state.roster && typeof fillSlot === 'function') {
        Object.keys(state.roster).forEach(k => { try { fillSlot(k); } catch (e) {} });
      }
    }
  } catch (e) { /* silent */ }
  // Goals land mid-match now — keep long-lived tabs fresh (awards on the
  // complete screen + ⚽ chips read this data at render time).
  setTimeout(loadLiveStats, 600000);
}
document.addEventListener('DOMContentLoaded', () => {
  refreshLiveMode();
  loadLiveStats();
});
