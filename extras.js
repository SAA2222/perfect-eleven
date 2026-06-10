/* ============================================================
   EXTRAS — ticker, countdown, leaderboard
   ============================================================ */

const KICKOFF = new Date('2026-06-11T20:00:00Z').getTime();

const TICKER_ITEMS = [
  { type: 'live',  text: 'BUILD THE PERFECT ELEVEN · TOOL LIVE NOW' },
  { type: 'news',  text: '⚽ 48 NATIONS · 120 PLAYERS · ONE STARTING XI' },
  { type: 'news',  text: '🏆 OPENING MATCH · MEX vs TBD · JUN 11 · ESTADIO AZTECA' },
  { type: 'live',  text: 'NEW · LEGENDS MODE DROPS NEXT WEEK' },
  { type: 'news',  text: '🇧🇷 BRA · 🇦🇷 ARG · 🇫🇷 FRA · 🇪🇸 ESP · 🏴 ENG · TOP-RATED POOLS' },
  { type: 'news',  text: 'WORLD CUP 2026 · USA · CAN · MEX · 16 CITIES · 39 DAYS' },
  { type: 'live',  text: 'TODAY\'S HIGH SCORE · 91 OVR · BUILT IN MEXICO CITY' },
];

function pad(n) { return String(Math.max(0, Math.floor(n))).padStart(2, '0'); }

function updateCountdown() {
  const now = Date.now();
  const diff = KICKOFF - now;
  const tb = document.getElementById('topbarDate');
  if (!tb) return;
  if (diff > 0) {
    const days = diff / (1000 * 60 * 60 * 24);
    const hrs  = (diff / (1000 * 60 * 60)) % 24;
    const min  = (diff / (1000 * 60)) % 60;
    tb.textContent = `T-${pad(days)}D ${pad(hrs)}H ${pad(min)}M`;
  } else {
    tb.textContent = 'LIVE';
  }
}

function renderTicker() {
  const track = document.getElementById('tickerTrack');
  if (!track) return;
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS];
  track.innerHTML = items.map(it => `
    <span class="ticker__item">
      ${it.type === 'live' ? '<span class="ticker__live">● LIVE</span>' : ''}
      <span>${it.text}</span>
      <span class="ticker__sep"></span>
    </span>
  `).join('');
}

// ============================================================
// SPONSOR TICKER — bottom strip, brand integration
// ============================================================
// Accents chosen so no two ADJACENT brands share (or nearly share) a colour —
// including the wrap from the last item back to the first (the ticker loops).
const SPONSORS = [
  { name: 'RED BULL',      tagline: 'GIVES YOU WINGS',                     accent: '#FFC400' }, // yellow
  { name: 'ADIDAS',        tagline: 'IMPOSSIBLE IS NOTHING',               accent: '#FFFFFF' }, // white
  { name: 'NIKE',          tagline: 'JUST DO IT',                          accent: '#FF5A1F' }, // orange
  { name: 'VISA',          tagline: 'EVERYWHERE YOU WANT TO BE',           accent: '#3B6BFF' }, // blue
  { name: 'MASTERCARD',    tagline: 'START SOMETHING PRICELESS',           accent: '#F79E1B' }, // amber
  { name: 'COCA-COLA',     tagline: 'TASTE THE FEELING',                   accent: '#E40712' }, // red
  { name: 'HYUNDAI',       tagline: 'NEW THINKING · NEW POSSIBILITIES',    accent: '#00B3A4' }, // teal
  { name: 'QATAR AIRWAYS', tagline: 'GOING PLACES TOGETHER',               accent: '#B0184B' }, // maroon
  { name: 'HUBLOT',        tagline: 'FUSION OF INNOVATION',                accent: '#C9A24A' }, // gold
  { name: 'YOUR BRAND',    tagline: 'AVAILABLE FOR SPONSORSHIP · CONTACT', accent: '#00FF85' }, // green
  { name: '@CASUALZFC',    tagline: 'NOW ON TIKTOK',                       accent: '#B14EFF' }, // purple
  { name: '@EATOGRAPHY',   tagline: 'PLATES WORTH CHASING · NOW ON TIKTOK',accent: '#FF6B35' }, // coral
  { name: 'CASAPER CONSTRUCTION', tagline: 'BUILT IT TOGETHER',           accent: '#69C9D0' }, // cyan
];

function renderSponsorTicker() {
  const track = document.getElementById('sponsorTrack');
  if (!track) return;
  const items = [...SPONSORS, ...SPONSORS, ...SPONSORS];
  track.innerHTML = items.map(s => `
    <span class="sponsor-ticker__item">
      <span class="sponsor-ticker__pby">PRESENTED BY</span>
      <span class="sponsor-ticker__name" style="color: ${s.accent};">${s.name}</span>
      <span class="sponsor-ticker__tag">${s.tagline}</span>
      <span class="sponsor-ticker__sep">◆</span>
    </span>
  `).join('');
}

// ============================================================
// LEADERBOARD — mock data
// ============================================================
const LEADERBOARD = [
  { ovr: 91, chem: 24, lineup: 'MBAPPÉ · HAALAND · YAMAL · BELLINGHAM · RODRI · PEDRI · VAN DIJK · ROMERO · HAKIMI · DAVIES · ALISSON', by: 'BUILT IN MEXICO CITY', mode: 'CLASSIC' },
  { ovr: 90, chem: 27, lineup: 'VINÍCIUS · KANE · DÍAZ · DE BRUYNE · VALVERDE · BELLINGHAM · KIM MIN-JAE · MARQUINHOS · HAKIMI · SALIBA · DONNARUMMA', by: 'BUILT IN LONDON', mode: 'CLASSIC' },
  { ovr: 89, chem: 21, lineup: 'MESSI · OSIMHEN · SAKA · MUSIALA · MODRIĆ · ENZO · VAN DIJK · BASTONI · DAVIES · HAKIMI · MAIGNAN', by: 'BUILT IN BUENOS AIRES', mode: 'LEGENDS' },
  { ovr: 88, chem: 18, lineup: 'MBAPPÉ · LUKAKU · MITOMA · ØDEGAARD · DE JONG · BARELLA · AKANJI · RÜDIGER · MAZRAOUI · HAKIMI · BONO', by: 'BUILT IN TOKYO', mode: 'CLASSIC' },
  { ovr: 87, chem: 14, lineup: 'PULISIC · HØJLUND · LEÃO · BRUNO F. · TCHOUAMÉNI · LEE KANG-IN · KOULIBALY · CHRISTENSEN · DAVIES · HAKIMI · SOMMER', by: 'BUILT IN NEW YORK', mode: 'TOP50' },
  { ovr: 86, chem: 12, lineup: 'SON · LOZANO · SARR · JAMES · CASEMIRO · BARELLA · VAN DIJK · MARQUINHOS · DAVIES · HAKIMI · OCHOA', by: 'BUILT IN SEOUL', mode: 'CLASSIC' },
];

// ============================================================
// LEADERBOARD STORAGE — Vercel KV (global) with localStorage fallback
// ============================================================
const LINEUP_KEY = 'pe_lineups_v1';
const API_URL    = '/api/leaderboard';
let _leaderboardIsGlobal = false; // toggled true when API responded

function loadStoredLineups() {
  try { return JSON.parse(localStorage.getItem(LINEUP_KEY) || '[]'); }
  catch { return []; }
}

// Save locally as a backup so user's own entries survive even if API fails
function saveStoredLineup(entry) {
  const arr = loadStoredLineups();
  arr.push(entry);
  arr.sort((a, b) => b.ovr - a.ovr);
  localStorage.setItem(LINEUP_KEY, JSON.stringify(arr.slice(0, 30)));
}

async function fetchGlobalLeaderboard() {
  try {
    const r = await fetch(API_URL, { cache: 'no-store' });
    if (!r.ok) return null;
    const data = await r.json();
    return Array.isArray(data?.entries) ? data.entries : null;
  } catch { return null; }
}

async function submitGlobalLineup(entry) {
  try {
    const r = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, status: r.status, error: data?.error || r.statusText };
    return { ok: true, entry: data.entry };
  } catch (e) { return { ok: false, error: e.message }; }
}

// Public API used by xi-script.js — async to wait on backend submit + refresh
async function storeLineup(entry) {
  // Mark user-owned for highlighting on render
  const userEntry = { ...entry, user: true };
  // Always save locally (so user sees their own entry even if API fails)
  saveStoredLineup(userEntry);
  // Submit to the shared global leaderboard
  const result = await submitGlobalLineup({
    by: entry.by, ovr: entry.ovr, chem: entry.chem,
    mode: entry.mode, lineup: entry.lineup,
  });
  return result;
}

// Filter out entries with corrupted Unicode (replacement chars from a bad
// encoding round-trip — happened to early test entries posted from PowerShell).
function isEntryClean(e) {
  if (!e) return false;
  const fields = [e.by, e.lineup, e.mode];
  for (const f of fields) {
    if (typeof f !== 'string') continue;
    // U+FFFD = replacement char ("�"). Some browsers also render lone ?  marks.
    if (f.includes('�')) return false;
    // Heuristic: 3+ "?" in a row in lineup = was probably non-ASCII before
    if (/\?\s*[·\-]?\s*\?\s*[·\-]?\s*\?/.test(f)) return false;
  }
  return true;
}

// Hide obvious dev/test submissions from the public board.
function isTestEntry(e) {
  const by = (e && e.by) || '';
  return /\b(test|vercel|deploy|utf8|localhost|debug|asdf|qwerty)\b/i.test(by);
}

// Every row must read "BUILT BY NAME · CITY". Backfills old / odd entries:
// missing (or profane) name → ANONYMOUS, missing (or profane) city → EARTH.
function normalizeBy(by) {
  const bad = (s) => typeof hasProfanity === 'function' && hasProfanity(s);
  let s = String(by || '').trim();
  // Demo-seed "BUILT IN <city>" carries a city but no name.
  const inCity = /^BUILT IN\s+(.+)$/i.exec(s);
  if (inCity) { const c = inCity[1].trim(); return `BUILT BY ANONYMOUS · ${(bad(c) ? 'EARTH' : c).toUpperCase()}`; }
  s = s.replace(/^BUILT BY\s*/i, '').trim();
  const parts = s.split('·').map(x => x.trim()).filter(Boolean);
  let name = parts[0] || '';
  let city = parts.slice(1).join(' · ');
  if (!name || /^EARTH$/i.test(name) || bad(name)) name = 'ANONYMOUS';
  if (!city || bad(city)) city = 'EARTH';
  return `BUILT BY ${name.toUpperCase()} · ${city.toUpperCase()}`;
}
// Mode filter state + cache of the last-merged rows, so switching tabs
// re-paints instantly without refetching. Mode strings stored by the app:
// 'CLASSIC', 'TOP50', 'LEGENDS' (see xi-script submit path).
let _lbRows = [];
let _lbFilter = 'ALL';
let _lbPeriod = 'ALLTIME';   // 'ALLTIME' | 'WEEK'
let _lbShowAll = false;      // ALL tab: expand past the top-25 cap
const LB_TOP_N = 10;         // mode tabs cap
const LB_ALL_CAP = 25;       // ALL tab default cap (then "show all")
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const LB_FILTER_LABELS = { ALL: 'ALL MODES', DAILY: "⭐ TODAY'S DAILY", CLASSIC: 'CLASSIC', TACTICAL: 'TACTICAL', TOP50: 'TOP 50', LEGENDS: 'LEGENDS' };

function normalizeMode(m) {
  const v = (m || 'CLASSIC').toUpperCase().replace(/\s+/g, '');
  if (v === 'TOP50' || v === 'TOP-50') return 'TOP50';
  if (v === 'LEGENDS' || v === 'LEGEND') return 'LEGENDS';
  if (v === 'TACTICAL') return 'TACTICAL';
  if (v === 'CLASSIC') return 'CLASSIC';
  return v; // legacy values (e.g. U-25) only ever show under ALL
}

// Friendly label for the small per-row mode badge (TOP50 → "TOP 50").
function modeDisplay(m) {
  const v = normalizeMode(m);
  return v === 'TOP50' ? 'TOP 50' : v;
}

// Tournament finish → compact leaderboard badge.
const FINISH_SHORT = {
  CHAMPIONS:    '🏆 WORLD CUP WINNER',
  RUNNERS_UP:   '🥈 RUNNERS-UP',
  THIRD:        '🥉 THIRD',
  FOURTH:       '4TH PLACE',
  QUARTERFINAL: 'QUARTER-FINAL',
  R16:          'ROUND OF 16',
  R32:          'ROUND OF 32',
  GROUP_OUT:    'GROUP STAGE',
};
// Reconstruct the finish tier for entries with no stored finish (old + demo).
// Backs the chem display-boost out of the OVR so it matches the complete screen.
function deriveFinishTier(ovr, chem) {
  const c = Number(chem) || 0;
  const basis = (Number(ovr) || 0) - Math.round(c / 3) + Math.floor(c / 6);
  const score = basis + c * 0.5;
  if (score >= 108) return 'CHAMPIONS';
  if (score >= 103) return 'RUNNERS_UP';
  if (score >= 99)  return 'THIRD';
  if (score >= 95)  return 'FOURTH';
  if (score >= 90)  return 'QUARTERFINAL';
  if (score >= 84)  return 'R16';
  if (score >= 78)  return 'R32';
  return 'GROUP_OUT';
}
function finishBadge(entry) {
  const tier = entry.finish || deriveFinishTier(entry.ovr, entry.chem);
  const label = FINISH_SHORT[tier];
  if (!label) return '';
  const cls = tier === 'CHAMPIONS' ? 'lb-finish--champ'
            : tier === 'RUNNERS_UP' ? 'lb-finish--runner'
            : (tier === 'THIRD' || tier === 'FOURTH') ? 'lb-finish--podium'
            : 'lb-finish--ko';
  return `<span class="lb-finish ${cls}">${label}</span>`;
}

// Leaderboard score — an Expert (blind) draft earns a points MULTIPLIER (BLIND_MULT,
// defined in xi-script.js). OVR stays raw; only the ranking points get the bonus.
const _BLIND_MULT = (typeof BLIND_MULT === 'number') ? BLIND_MULT : 1.25;
function lbScore(e) {
  const ovr = Number(e && e.ovr) || 0;
  return (e && e.expert) ? Math.round(ovr * _BLIND_MULT) : ovr;
}
function expertBadge(e) {
  if (!e || !e.expert) return '';
  return `<span class="lb-expert">🎭 EXPERT ×${_BLIND_MULT} · ${lbScore(e)} PTS</span>`;
}
// Color-code the overall score by tier (ascending): lime → bright green → dark green → gold.
function ovrColor(ovr) {
  const n = Number(ovr) || 0;
  if (n >= 100) return '#ffd24a';  // gold — elite
  if (n >= 95)  return '#16a34a';  // dark green
  if (n >= 90)  return '#4ade80';  // bright green
  if (n >= 84)  return '#a3e635';  // lime
  return '#8a96a0';                // below 84 — muted
}

// This squad's would-be position on the ALL-TIME, all-modes leaderboard (ranked
// by lbScore so Expert 2× counts) — used on the share card. Returns null if the
// board hasn't loaded yet (card falls back to SLOTS).
function userGlobalRank(score) {
  if (typeof score !== 'number' || !Array.isArray(_lbRows) || !_lbRows.length) return null;
  const better = _lbRows.filter(e => lbScore(e) > score).length;
  return better + 1;
}

async function renderLeaderboard() {
  const grid = document.getElementById('leaderboardGrid');
  if (!grid) return;

  // Optimistically render local + demo so the page never looks empty
  const local = loadStoredLineups();
  let rows = [...local, ...LEADERBOARD];

  // Try the global API in parallel
  const remote = await fetchGlobalLeaderboard();
  if (remote && remote.length) {
    _leaderboardIsGlobal = true;
    // Merge: global + local (so user's own pre-deploy entries still show)
    // Mark which entries are user's own by matching against local timestamps/lineups
    const localKeyset = new Set(local.map(e => `${e.by}|${e.ovr}|${e.lineup}`));
    rows = remote.map(e => ({
      ...e,
      user: localKeyset.has(`${e.by}|${e.ovr}|${e.lineup}`),
    }));
  } else if (remote && remote.length === 0) {
    _leaderboardIsGlobal = true;
    rows = [...LEADERBOARD]; // empty global → show demo seed
  } else {
    _leaderboardIsGlobal = false;
  }

  // Skip corrupted-Unicode + dev test entries. NO per-person de-dupe — multiple
  // entries per player are welcome (every win counts). Normalize every "by" to
  // "BUILT BY NAME · CITY" (backfills old entries → ANONYMOUS / EARTH).
  _lbRows = rows
    .filter(e => isEntryClean(e) && !isTestEntry(e))
    .map(e => ({ ...e, by: normalizeBy(e.by) }));
  paintLeaderboard();   // movement arrows are annotated per-tab inside the paint
  // Board data just arrived → refresh the Daily CTA's "🌍 N played" social proof.
  if (typeof updateDailyCta === 'function') updateDailyCta();
}

// ---- Rank movement: ▲/▼/NEW vs YESTERDAY (ET) — league-table style ------------
// The old version saved a fresh snapshot on EVERY load, so the comparison frame
// was "since this device's previous page load" — between two visits nothing
// moves, so users only ever saw dashes. Now: per-tab buckets, baseline = the
// tab's state as of yesterday (frozen all day, rolls at midnight ET — same
// rhythm as the Daily). DAILY compares within today (yesterday's daily was a
// different challenge), baselined the first time you look each day.
function lbEntryId(e) { return `${e.by}|${e.ovr}|${e.lineup}`; }
function _lbDayET(ms) {
  return (typeof easternDayString === 'function')
    ? easternDayString(ms != null ? new Date(ms) : new Date())
    : new Date(ms != null ? ms : Date.now()).toISOString().slice(0, 10);
}
// Annotate `ranked` (already sorted + rank-numbered for the CURRENT tab) in place.
// EVERY row carries its CUMULATIVE movement: spots moved since the entry JOINED
// the board (entered #20, now #3 → ▲+17). NEW = first sighting; 0 = where it
// joined. Per-tab registries of join-ranks; DAILY resets each ET day (new
// challenge). Returns 'joined' | 'armed' (first-ever paint of a bucket —
// everything registers quietly at 0) for the legend.
function annotateMovementFor(bucket, ranked) {
  let rec;
  try { rec = JSON.parse(localStorage.getItem('pe_lb_move3') || 'null'); } catch (e) { rec = null; }
  if (!rec || !rec.buckets) rec = { daily: null, buckets: {} };
  try { localStorage.removeItem('pe_lb_ranks2'); localStorage.removeItem('pe_lb_ranks'); } catch (e) {}
  if (bucket === 'DAILY') {
    const today = _lbDayET();
    if (rec.daily !== today) { rec.buckets.DAILY = null; rec.daily = today; }   // new challenge → fresh registry
  }
  const reg = rec.buckets[bucket];
  const fresh = !reg;                                  // first time tracking this tab
  const next = {};
  ranked.forEach(e => {
    const id = lbEntryId(e);
    if (fresh) { next[id] = e.rank; e._move = { type: 'same' }; return; }      // armed at its current spot
    if (!(id in reg)) { next[id] = e.rank; e._move = { type: 'new' }; return; } // just joined the board
    const r0 = reg[id];
    next[id] = r0;                                     // keep the original join rank forever
    const d = r0 - e.rank;
    e._move = d > 0 ? { type: 'up', n: d } : (d < 0 ? { type: 'down', n: -d } : { type: 'same' });
  });
  rec.buckets[bucket] = next;                          // departed ids prune automatically
  try { localStorage.setItem('pe_lb_move3', JSON.stringify(rec)); } catch (e) {}
  return fresh ? 'armed' : 'joined';
}
function moveHTML(m) {
  if (!m || m.type === 'same') return '<span class="lb-move lb-move--same">0</span>';
  if (m.type === 'new')  return '<span class="lb-move lb-move--new">NEW</span>';
  if (m.type === 'up')   return `<span class="lb-move lb-move--up">▲+${m.n}</span>`;
  if (m.type === 'down') return `<span class="lb-move lb-move--down">▼-${m.n}</span>`;
  return '';
}

// Paints from _lbRows using the active mode filter. Tab clicks call this
// directly — no network round-trip.
function paintLeaderboard() {
  const grid = document.getElementById('leaderboardGrid');
  if (!grid) return;

  let rows = _lbRows.slice();
  if (_lbFilter === 'DAILY') {
    // Today's daily only, keyed by EASTERN DAY (matches the seed / 12 AM ET reset)
    // so it's a true global apples-to-apples board. De-dupe to one BEST run per
    // person HERE only (multiple entries are still welcome on every other board).
    const eDay = (ms) => (typeof easternDayString === 'function')
      ? easternDayString(new Date(ms))
      : new Date(ms).toISOString().slice(0, 10);
    const today = eDay(Date.now());
    const dailyRows = rows.filter(r => normalizeMode(r.mode) === 'DAILY' && eDay(r.createdAt || 0) === today);
    const best = new Map();
    for (const e of dailyRows) {
      const k = (e.by || '').trim().toLowerCase();
      const cur = best.get(k);
      if (!cur || lbScore(e) > lbScore(cur)) best.set(k, e);
    }
    rows = [...best.values()];
  } else if (_lbFilter !== 'ALL') {
    rows = rows.filter(r => normalizeMode(r.mode) === _lbFilter);
  }
  if (_lbPeriod === 'WEEK') {
    const cutoff = Date.now() - WEEK_MS;
    rows = rows.filter(r => r.createdAt && r.createdAt >= cutoff);
  }
  // Mode tabs cap at TOP 10. The ALL tab shows TOP 25 by default with a "show all"
  // expander — and pins YOUR best row below the cut if you're outside the 25.
  const sorted = rows.sort((a, b) => lbScore(b) - lbScore(a));   // Expert 2× counts
  const ranked = sorted.map((row, i) => ({ ...row, rank: i + 1 }));
  const isAll = _lbFilter === 'ALL';

  // ▲/▼/NEW vs yesterday, per tab. Skip under THIS WEEK (different ranking frame)
  // and when showing the offline/demo fallback (junk ids would pollute the baseline).
  let moveFrame = null;
  if (_lbPeriod !== 'WEEK' && _leaderboardIsGlobal) moveFrame = annotateMovementFor(_lbFilter, ranked);

  let combined, hiddenCount = 0, pinnedUser = null;
  if (!isAll) {
    combined = ranked.slice(0, LB_TOP_N);
  } else if (_lbShowAll || ranked.length <= LB_ALL_CAP) {
    combined = ranked;
  } else {
    combined = ranked.slice(0, LB_ALL_CAP);
    hiddenCount = ranked.length - LB_ALL_CAP;
    if (!combined.some(r => r.user)) pinnedUser = ranked.find(r => r.user) || null;  // pin your best
  }

  const scope = _leaderboardIsGlobal
    ? `<span class="lb-meta--global">🌍 GLOBAL</span>`
    : `<span class="lb-meta--local">📱 LOCAL · OFFLINE</span>`;
  const periodLabel = _lbPeriod === 'WEEK' ? 'THIS WEEK' : 'ALL TIME';
  const countLabel = isAll
    ? (hiddenCount > 0 ? `TOP ${LB_ALL_CAP} OF ${ranked.length}` : `${ranked.length} ${ranked.length === 1 ? 'PLAYER' : 'PLAYERS'}`)
    : (sorted.length > LB_TOP_N ? `TOP ${LB_TOP_N}` : `${combined.length} ${combined.length === 1 ? 'PLAYER' : 'PLAYERS'}`);
  const badge = `<div class="lb-meta">${scope} · ${LB_FILTER_LABELS[_lbFilter] || _lbFilter} · ${periodLabel} · ${countLabel}</div>`;
  // Movement legend — defines the symbols + says what they're measured against.
  const FRAME_LABEL = {
    joined: 'TOTAL MOVEMENT SINCE EACH ENTRY JOINED THE BOARD',
    armed: 'TRACKING ARMED — MOVEMENT SHOWS AS THE BOARD CHANGES',
  };
  const legend = moveFrame ? `<div class="lb-legend">
      <span class="lb-move lb-move--up">▲+N</span> CLIMBED N SPOTS ·
      <span class="lb-move lb-move--down">▼-N</span> DROPPED N ·
      <span class="lb-move lb-move--new">NEW</span> JUST JOINED ·
      <span class="lb-move lb-move--same">0</span> AT JOIN SPOT —
      ${FRAME_LABEL[moveFrame] || ''}
    </div>` : '';

  if (!combined.length) {
    grid.innerHTML = badge + `
      <div class="lb-empty">
        <p class="lb-empty__title">NO ${LB_FILTER_LABELS[_lbFilter] || _lbFilter} XIs YET</p>
        <p class="lb-empty__sub">Be the first — build one and claim the top spot.</p>
      </div>`;
    return;
  }

  const rowHTML = (row, pinned) => `
    <article class="lb-row ${row.user ? 'lb-row--user' : ''}${pinned ? ' lb-row--pinned' : ''}">
      <div class="lb-row__rank">
        <span class="lb-row__rank-num">${String(row.rank).padStart(2, '0')}</span>
        ${row._move !== undefined ? moveHTML(row._move) : ''}
        <span class="lb-row__mode">${modeDisplay(row.mode)}</span>
      </div>
      <div class="lb-row__body">
        <p class="lb-row__lineup">${row.lineup}</p>
        <span class="lb-row__by">${row.by}${row.user ? ' · <span style="color:var(--pitch);">YOU</span>' : ''}</span>
        <span class="lb-badges">${finishBadge(row)}${expertBadge(row)}</span>
      </div>
      <div class="lb-row__ovr">
        <span class="lb-row__ovr-num" style="color:${ovrColor(row.ovr)}">${row.ovr}</span>
        <span class="lb-row__ovr-label">OVR${row.chem ? ' · ' + row.chem + ' CHEM' : ''}</span>
      </div>
    </article>`;

  const pinnedHTML = pinnedUser ? `<div class="lb-pin-sep">⋯ YOUR RANK ⋯</div>` + rowHTML(pinnedUser, true) : '';
  const toggle = (isAll && (hiddenCount > 0 || _lbShowAll))
    ? `<button class="lb-showall" id="lbShowAll" type="button">${_lbShowAll ? `▲ SHOW TOP ${LB_ALL_CAP}` : `▼ SHOW ALL ${ranked.length}`}</button>`
    : '';

  grid.innerHTML = badge + legend + combined.map(r => rowHTML(r, false)).join('') + pinnedHTML + toggle;
  const sa = document.getElementById('lbShowAll');
  if (sa) sa.addEventListener('click', () => { _lbShowAll = !_lbShowAll; paintLeaderboard(); });
}

function wireLeaderboardFilters() {
  const bar = document.getElementById('leaderboardFilters');
  if (bar) {
    bar.querySelectorAll('.lb-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        _lbFilter = btn.dataset.lbMode || 'ALL';
        _lbShowAll = false;   // collapse back to the capped view on tab switch
        bar.querySelectorAll('.lb-filter').forEach(b => {
          const active = b === btn;
          b.classList.toggle('lb-filter--active', active);
          b.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        paintLeaderboard();
      });
    });
  }
  // Time-period toggle (ALL TIME / THIS WEEK)
  const period = document.getElementById('leaderboardPeriod');
  if (period) {
    period.querySelectorAll('.lb-period').forEach(btn => {
      btn.addEventListener('click', () => {
        _lbPeriod = btn.dataset.lbPeriod || 'ALLTIME';
        period.querySelectorAll('.lb-period').forEach(b => {
          const active = b === btn;
          b.classList.toggle('lb-period--active', active);
          b.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        paintLeaderboard();
      });
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderTicker();
  renderSponsorTicker();
  wireLeaderboardFilters();
  renderLeaderboard();
  updateCountdown();
  setInterval(updateCountdown, 30 * 1000);
});
