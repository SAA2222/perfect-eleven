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
let _liveGoals = {};        // "CODE|lastname" → { n, g, a, apps, r }
let _livePollTimer = null;

function _liveNorm(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
// Map an xi-data roster player → live stats (match on nation code + last name).
function liveStatFor(p) {
  if (!p || !p.code || !p.name) return null;
  const last = _liveNorm(p.name).replace(/\s*\(peak\)\s*$/, '').split(/\s+/).pop();
  return _liveGoals[`${p.code}|${last}`] || null;
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
    return new Date(m.dt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
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
  // Today's window: live now, finished in the last 12h, or kicking off in the next 18h.
  const windowed = (matches || []).filter(m => {
    const t = Date.parse(m.dt || 0);
    if (m.status === 'in_progress') return true;
    if (m.status === 'completed') return now - t < 12 * 3600000;
    return t - now > 0 && t - now < 18 * 3600000;
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
