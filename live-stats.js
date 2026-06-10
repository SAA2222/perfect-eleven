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
// Build the lookup index: each API player is reachable by CODE|last-meaningful-token
// AND CODE|first-token (covers Brazilian first-name-known players). Keys claimed by
// two DIFFERENT players (e.g. the Thuram brothers) are dropped as ambiguous.
function _buildLiveIdx(players) {
  const idx = {}, dropped = new Set();
  for (const k of Object.keys(players || {})) {
    const v = players[k];
    const code = k.split('|')[0];
    const toks = _liveTokens(v.n);
    if (!toks.length) continue;
    const keys = new Set([`${code}|${_liveLastTok(v.n)}`, `${code}|${toks[0]}`]);
    for (const kk of keys) {
      if (dropped.has(kk)) continue;
      if (idx[kk] && idx[kk].n !== v.n) { delete idx[kk]; dropped.add(kk); continue; }
      idx[kk] = v;
    }
  }
  return idx;
}
// Map an xi-data roster player → live stats (last-name first, first-name fallback).
function liveStatFor(p) {
  if (!p || !p.code || !p.name) return null;
  const toks = _liveTokens(p.name);
  if (!toks.length) return null;
  return _liveIdx[`${p.code}|${_liveLastTok(p.name)}`] || _liveIdx[`${p.code}|${toks[0]}`] || null;
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
  strip.hidden = false;
  strip.innerHTML = `
    <span class="matchday__label">${anyLive ? '🔴 MATCHDAY — LIVE' : '⚽ MATCHDAY'}</span>
    <div class="matchday__track">
      ${windowed.map(m => `
        <span class="matchday__chip${m.status === 'in_progress' ? ' matchday__chip--live' : ''}">
          <b>${(m.home && m.home.code) || m.ph || 'TBD'}</b>
          <span class="matchday__score">${_liveScore(m)}</span>
          <b>${(m.away && m.away.code) || m.pa || 'TBD'}</b>
          <span class="matchday__time">${_liveTimeLabel(m)}</span>
        </span>`).join('')}
    </div>`;
  return anyLive;
}

async function refreshLiveMode() {
  try {
    const r = await fetch('/api/live?view=today');
    const data = await r.json();
    if (!data || !data.ok) { const s = document.getElementById('matchdayStrip'); if (s) s.hidden = true; return; }
    const anyLive = renderMatchdayStrip(data.matches);
    // Poll faster while matches are live, slower around kickoff windows.
    if (_livePollTimer) clearTimeout(_livePollTimer);
    _livePollTimer = setTimeout(refreshLiveMode, anyLive ? 90000 : 600000);
  } catch (e) { /* offline / no api — stay quiet */ }
}
async function loadLiveStats() {
  try {
    const r = await fetch('/api/live?view=stats');
    const data = await r.json();
    if (data && data.ok && data.players) {
      _liveGoals = data.players;
      _liveIdx = _buildLiveIdx(_liveGoals);
      // Repaint filled slots so ⚽ chips appear on players who have really scored.
      if (typeof state !== 'undefined' && state.roster && typeof fillSlot === 'function') {
        Object.keys(state.roster).forEach(k => { try { fillSlot(k); } catch (e) {} });
      }
    }
  } catch (e) { /* silent */ }
}
document.addEventListener('DOMContentLoaded', () => {
  refreshLiveMode();
  loadLiveStats();
});
