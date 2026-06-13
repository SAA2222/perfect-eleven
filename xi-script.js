/* ============================================================
   BUILD THE PERFECT XI — game logic
   Specific roles + league chemistry
   ============================================================ */

// ============================================================
// FORMATIONS — each is 11 slots (index 0-10, GK always index 10) with a role and
// a pitch position (top/left %). Chemistry is league-link based (position-agnostic)
// so a formation only changes WHICH roles you're drafting for + where they sit.
// ============================================================
const FORMATIONS = {
  '4-3-3': [
    { pos:'FWD', role:'LW',  top:14, left:20 },
    { pos:'FWD', role:'ST',  top:9,  left:50 },
    { pos:'FWD', role:'RW',  top:14, left:80 },
    { pos:'MID', role:'LCM', top:32, left:28 },
    { pos:'MID', role:'CDM', top:46, left:50 },
    { pos:'MID', role:'RCM', top:32, left:72 },
    { pos:'DEF', role:'LB',  top:74, left:18 },
    { pos:'DEF', role:'LCB', top:72, left:39 },
    { pos:'DEF', role:'RCB', top:72, left:61 },
    { pos:'DEF', role:'RB',  top:74, left:82 },
    { pos:'GK',  role:'GK',  top:91, left:50 },
  ],
  '4-4-2': [
    { pos:'FWD', role:'LST', top:11, left:40 },
    { pos:'FWD', role:'RST', top:11, left:60 },
    { pos:'MID', role:'LM',  top:38, left:14 },
    { pos:'MID', role:'LCM', top:41, left:40 },
    { pos:'MID', role:'RCM', top:41, left:60 },
    { pos:'MID', role:'RM',  top:38, left:86 },
    { pos:'DEF', role:'LB',  top:74, left:16 },
    { pos:'DEF', role:'LCB', top:72, left:39 },
    { pos:'DEF', role:'RCB', top:72, left:61 },
    { pos:'DEF', role:'RB',  top:74, left:84 },
    { pos:'GK',  role:'GK',  top:91, left:50 },
  ],
  '4-2-3-1': [
    { pos:'FWD', role:'ST',  top:10, left:50 },
    { pos:'MID', role:'LAM', top:29, left:22 },
    { pos:'MID', role:'CAM', top:26, left:50 },
    { pos:'MID', role:'RAM', top:29, left:78 },
    { pos:'MID', role:'LDM', top:49, left:38 },
    { pos:'MID', role:'RDM', top:49, left:62 },
    { pos:'DEF', role:'LB',  top:74, left:16 },
    { pos:'DEF', role:'LCB', top:72, left:39 },
    { pos:'DEF', role:'RCB', top:72, left:61 },
    { pos:'DEF', role:'RB',  top:74, left:84 },
    { pos:'GK',  role:'GK',  top:91, left:50 },
  ],
  '3-5-2': [
    { pos:'FWD', role:'LST', top:11, left:40 },
    { pos:'FWD', role:'RST', top:11, left:60 },
    { pos:'MID', role:'LWB', top:40, left:11 },
    { pos:'MID', role:'LCM', top:38, left:34 },
    { pos:'MID', role:'CDM', top:47, left:50 },
    { pos:'MID', role:'RCM', top:38, left:66 },
    { pos:'MID', role:'RWB', top:40, left:89 },
    { pos:'DEF', role:'LCB', top:74, left:30 },
    { pos:'DEF', role:'CCB', top:76, left:50 },
    { pos:'DEF', role:'RCB', top:74, left:70 },
    { pos:'GK',  role:'GK',  top:91, left:50 },
  ],
};
const DEFAULT_FORMATION = '4-3-3';
function buildSlotDef(name) {
  const f = FORMATIONS[name] || FORMATIONS[DEFAULT_FORMATION];
  const def = {};
  f.forEach((s, i) => { def[i] = { pos: s.pos, role: s.role }; });
  return def;
}
// slot index → { pos (group), role (specific) } — MUTABLE, swapped per formation.
let SLOT_DEF = buildSlotDef(DEFAULT_FORMATION);

// player role → slot roles that count as a NATURAL fit (exact, no penalty).
// Anything else falls back to "same line, OUT OF POSITION" (-1 rating).
//   · CDM (holder) — any holding slot (CDM / LDM / RDM)
//   · CM  (box-to-box) — every central + wide-mid slot
//   · CAM (#10 / advanced 8) — the attacking-mid + 8 slots, never a holder
//   · wide players cover wide-mid + wing-back + wide-AM; strikers cover any ST slot
const ROLE_FIT = {
  GK:  ['GK'],
  CB:  ['LCB', 'RCB', 'CCB'],
  LB:  ['LB', 'LWB'],
  RB:  ['RB', 'RWB'],
  CDM: ['CDM', 'LDM', 'RDM'],
  CM:  ['CDM', 'LCM', 'RCM', 'LDM', 'RDM', 'LM', 'RM', 'CAM', 'LAM', 'RAM'],
  CAM: ['LCM', 'RCM', 'CAM', 'LAM', 'RAM'],
  LW:  ['LW', 'LM', 'LWB', 'LAM'],
  ST:  ['ST', 'LST', 'RST'],
  RW:  ['RW', 'RM', 'RWB', 'RAM'],
};
// GK, then defenders → mids → forwards, left-to-right within each line. Used for
// the lineup string + structured xi so any formation reads naturally.
function orderedSlots() {
  const lineRank = { GK: 0, DEF: 1, MID: 2, FWD: 3 };
  const f = FORMATIONS[state.formation] || FORMATIONS[DEFAULT_FORMATION];
  return Object.keys(SLOT_DEF).map(Number).sort((a, b) => {
    const lr = (lineRank[SLOT_DEF[a].pos] || 0) - (lineRank[SLOT_DEF[b].pos] || 0);
    return lr !== 0 ? lr : ((f[a] ? f[a].left : 0) - (f[b] ? f[b].left : 0));
  });
}

// ----- TIERED OUT-OF-POSITION penalty -----
// A natural fit costs 0. A SOFT move (same line, related role — e.g. a left-back
// at right-back) costs −1. A HARD move (wrong family or wrong line — e.g. a
// left-back at centre-back, or anyone in goal) costs −2.
const POS_FAMILY = {
  GK:'GK',
  LB:'FB', RB:'FB', LWB:'FB', RWB:'FB',           // fullbacks / wing-backs
  LCB:'CB', RCB:'CB', CCB:'CB', CB:'CB',          // centre-backs
  CDM:'DM', LDM:'DM', RDM:'DM',                   // holders
  LCM:'CM', RCM:'CM', CM:'CM',                    // central mids
  LM:'WM', RM:'WM',                               // wide mids
  CAM:'AM', LAM:'AM', RAM:'AM',                   // attacking mids
  LW:'WF', RW:'WF',                               // wingers
  ST:'CF', LST:'CF', RST:'CF',                    // strikers
};
// Families a player's own family can shift into for only −1 (everything else −2).
const FAMILY_SOFT = {
  GK: [],
  FB: ['FB', 'WM', 'WF'],            // fullback → other-side fullback, wide mid, winger
  CB: ['CB', 'DM', 'FB'],            // centre-back → holder, fullback
  DM: ['DM', 'CM', 'CB'],
  CM: ['CM', 'DM', 'AM', 'WM'],
  WM: ['WM', 'WF', 'CM', 'FB'],
  AM: ['AM', 'CM', 'WF', 'CF', 'WM'],
  WF: ['WF', 'AM', 'CF', 'WM'],
  CF: ['CF', 'WF', 'AM'],
};
// 0 = natural, 1 = soft OOP, 2 = hard OOP. Drives the per-player rating penalty.
function oopPenalty(playerRole, slotRole) {
  if ((ROLE_FIT[playerRole] || []).includes(slotRole)) return 0;
  const pf = POS_FAMILY[playerRole] || 'CM';
  const sf = POS_FAMILY[slotRole] || 'CM';
  if (pf === sf) return 1;                                  // same family, non-natural side
  return (FAMILY_SOFT[pf] || []).includes(sf) ? 1 : 2;
}

const POS_BLURB = {
  high: 'A genuine super-team. Bookmark this lineup.',
  mid:  'Mid-table magic. Some inspired picks; some courage.',
  low:  'A cult classic. The neutrals\' team.'
};

const MAX_SKIPS = 3;
const MAX_SWAPS = 2;

let state = {
  mode: 'classic',
  roster: {},      // slotIdx → player
  usedNations: new Set(),
  isSpinning: false,
  currentNation: null,
  skipsLeft: MAX_SKIPS,
  swapsLeft: MAX_SWAPS,
  swapMode: false,
  pickSwapMode: false, // user clicked SWAP from inside pick modal → next pick replaces
  blind: false,        // EXPERT mode — ratings hidden during the draft (38-0-style)
  revealed: false,     // flips true on the complete screen → the big reveal
  currentSlot: null,   // TACTICAL mode — the open slot the spinner landed on
  usedPlayers: new Set(), // TACTICAL mode — players already drafted (no repeats)
  tacticalDraw: null,  // TACTICAL mode — the current 5 candidates
};

const $ = (id) => document.getElementById(id);

// Vercel Analytics custom event — no-ops if analytics isn't loaded.
function track(name, data) {
  try { if (window.va) window.va('event', data ? { name, data } : { name }); } catch (e) {}
}

// Per-mode resources. Tactical is tighter (2 skips / 1 swap) — it's a paid mode.
const MODE_RESOURCES = {
  classic:  { skips: 3, swaps: 2 },
  top50:    { skips: 3, swaps: 2 },
  legends:  { skips: 3, swaps: 2 },
  tactical: { skips: 2, swaps: 1 },
};
function applyModeResources() {
  const r = MODE_RESOURCES[state.mode] || { skips: 3, swaps: 2 };
  state.skipsLeft = r.skips;
  state.swapsLeft = r.swaps;
}
// Rebuild the skip/swap pip dots to match the mode's max (Tactical shows 2/1).
function renderResourcePips() {
  const r = MODE_RESOURCES[state.mode] || { skips: 3, swaps: 2 };
  const sk = $('skipPips'), sw = $('swapPips');
  if (sk) sk.innerHTML = Array.from({ length: r.skips }, () => '<span class="xi-res__pip on"></span>').join('');
  if (sw) sw.innerHTML = Array.from({ length: r.swaps }, () => '<span class="xi-res__pip on"></span>').join('');
}

// Full position names for the Tactical spinner / result.
const POS_FULL = {
  GK:'GOALKEEPER', LB:'LEFT-BACK', RB:'RIGHT-BACK', LCB:'CENTRE-BACK', RCB:'CENTRE-BACK', CCB:'CENTRE-BACK',
  LWB:'LEFT WING-BACK', RWB:'RIGHT WING-BACK',
  CDM:'DEF. MIDFIELD', LDM:'DEF. MIDFIELD', RDM:'DEF. MIDFIELD',
  LCM:'CENTRE MID', RCM:'CENTRE MID', LM:'LEFT MID', RM:'RIGHT MID',
  CAM:'ATTACK MID', LAM:'ATTACK MID', RAM:'ATTACK MID',
  LW:'LEFT WING', RW:'RIGHT WING', ST:'STRIKER', LST:'STRIKER', RST:'STRIKER',
};

// ----- FORMATION switching -----
// Swap the active formation: re-roles + repositions the 11 pitch slots and the
// SLOT_DEF the whole game reads. Locked once a build is underway (changing roles
// mid-draft would scramble fits) — re-enabled on reset. Persisted across sessions.
function applyFormation(name, opts = {}) {
  if (!FORMATIONS[name]) name = DEFAULT_FORMATION;
  if (!opts.force && Object.keys(state.roster).length > 0) {
    toast('RESET TO CHANGE FORMATION');
    syncFormationPicker();
    return;
  }
  state.formation = name;
  SLOT_DEF = buildSlotDef(name);
  try { localStorage.setItem('pe_formation', name); } catch (e) {}
  FORMATIONS[name].forEach((s, i) => {
    const el = document.querySelector(`.slot[data-slot="${i}"]`);
    if (!el) return;
    el.dataset.pos = s.pos;
    el.dataset.role = s.role;       // .slot::before { content: attr(data-role) } relabels for free
    el.style.top = s.top + '%';
    el.style.left = s.left + '%';
    el.classList.toggle('slot--gk', s.pos === 'GK');
  });
  syncFormationPicker();
}
function syncFormationPicker() {
  const sel = document.getElementById('formationPicker');
  if (!sel) return;
  sel.value = state.formation || DEFAULT_FORMATION;
  sel.disabled = Object.keys(state.roster).length > 0;   // lock once building starts
}
// Share-card slot position — derived from the ACTIVE formation so the exported
// card matches whatever shape you built in.
function cardSlotPos(i) {
  const f = FORMATIONS[state.formation] || FORMATIONS[DEFAULT_FORMATION];
  const s = f[i];
  return s ? { x: s.left / 100, y: s.top / 100, label: s.role } : { x: 0.5, y: 0.5, label: '' };
}

// EXPERT / BLIND draft: hide every rating + chem number until the final reveal.
// Pure display gate — game logic (OVR/chem/finish) is unchanged. One predicate
// threaded through every render so nothing leaks.
function ratingsHidden() { return state.blind && !state.revealed; }
function maskRating(r) { return ratingsHidden() ? '?' : r; }

// The expert toggle is committed once the draft starts — no flipping mid-build
// to peek at ratings. Re-enabled on reset (empty roster).
function updateBlindToggleLock() {
  const toggle = document.getElementById('expertToggle');
  const wrap = document.getElementById('expertToggleWrap');
  if (!toggle) return;
  const started = Object.keys(state.roster).length > 0;
  toggle.disabled = started;
  toggle.checked = state.blind;
  if (wrap) wrap.classList.toggle('xi-expert--locked', started);
}

// ============================================================
// SPINNER
// ============================================================
function buildSpinnerCards() {
  if (state.mode === 'tactical') return buildTacticalSpinnerCards();
  const pool = getNationPool(state.mode);
  const showRank = (state.mode === 'classic' || state.mode === 'top50');
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const long = [...shuffled, ...shuffled, ...shuffled, ...shuffled];
  $('spinnerCards').innerHTML = long.map(n => {
    const r = (showRank && typeof fifaRank === 'function') ? fifaRank(n.code) : null;
    return `
    <div class="xi-card" data-code="${n.code}">
      <img class="xi-card__flag" src="${flagURL(n.iso, 80)}" srcset="${flagURL2x(n.iso, 80)} 2x" alt="${n.name}" />
      <span class="xi-card__name">${n.name}</span>
      ${r ? `<span class="xi-card__rank">FIFA&nbsp;#${r}</span>` : ''}
    </div>`;
  }).join('');
}

// TACTICAL — the wheel spins POSITIONS, not nations.
function buildTacticalSpinnerCards() {
  const slots = Object.values(SLOT_DEF);
  const long = [...slots, ...slots, ...slots, ...slots].sort(() => Math.random() - 0.5);
  $('spinnerCards').innerHTML = long.map(s => `
    <div class="xi-card xi-card--pos" data-code="${s.role}">
      <span class="xi-card__poslabel">${s.role}</span>
      <span class="xi-card__name">${POS_FULL[s.role] || s.role}</span>
    </div>
  `).join('');
}

// ============================================================
// NATION SPIN WEIGHTS — bigger teams spin more often than minnows.
// Tiers reflect footballing strength, not pure rating.
// Brazil (6) is 6x more likely than Haiti (1); Türkiye (2) is 2x.
// ============================================================
const NATION_TIER = {
  // ELITE (6) — title contenders
  BRA:6, ARG:6, FRA:6, ESP:6, GER:6, ENG:6, POR:6,
  // STRONG (4) — heavyweight contenders + traditional powers
  NED:4, BEL:4, ITA:4, CRO:4, URY:4, COL:4, MAR:4,
  // MID-TIER (3) — competitive sides
  SUI:3, MEX:3, USA:3, JPN:3, SEN:3, CIV:3, TUR:3, ECU:3, NOR:3, SWE:3, DEN:3, NGA:3,
  // GROUP CONTENDERS (2) — outsiders / second-tier qualifiers
  KOR:2, AUS:2, IRN:2, EGY:2, TUN:2, ALG:2, AUT:2, GHA:2, CZE:2, SCO:2, SRB:2, POL:2, UKR:2, PAR:2,
  // DEBUTANTS / MINNOWS (1) — lowest spin weight
  HAI:1, CUW:1, QAT:1, BIH:1, JOR:1, IRQ:1, UZB:1, PAN:1, RSA:1, NZL:1, COD:1, SAU:1, CPV:1,
};

// ----- Daily Challenge: a seeded RNG so EVERYONE gets the same 11 spins today --
// mulberry32 — tiny deterministic PRNG. Seeded from the date string.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const DAILY_EPOCH = Date.UTC(2026, 5, 8);   // 8 Jun 2026 (ET) = Daily #1
// The day rolls over at MIDNIGHT EASTERN (America/New_York, DST-aware) — so the
// challenge unlocks/resets at 12 AM ET and everyone plays the same Daily #N.
function easternDayString(d) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(d || new Date());
}
function dailyDayString(d) { return easternDayString(d); }   // YYYY-MM-DD in ET
function dailyNumber() {
  const [y, m, d] = dailyDayString().split('-').map(Number);
  return Math.max(1, Math.floor((Date.UTC(y, m - 1, d) - DAILY_EPOCH) / 86400000) + 1);
}
// ms until the next 12 AM ET (for the lock countdown). Offset trick: format now in
// ET, reparse as a local Date, advance to its next midnight.
function msUntilNextEasternMidnight() {
  const nowET = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const next = new Date(nowET); next.setHours(24, 0, 0, 0);
  return Math.max(0, next - nowET);
}
function fmtCountdown(ms) {
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function fnv1a(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
let _spinRng = Math.random;   // swapped to the seeded RNG while in Daily mode
let _submittingLineup = false;   // re-entry guard: one post per completed XI
const BLIND_MULT = 1.25;   // Expert/blind draft → +25% leaderboard points (single source of truth)

function weightedPick(pool) {
  // Base tier (1=minnow … 6=elite) + a matchday bonus on top:
  //  · CLASSIC etc → window._matchdayBonus (LIVE: today/just-played/about-to-play)
  //  · DAILY       → window._dailyMatchdayBonus (FROZEN date-based today/yesterday,
  //                  identical for everyone today → the seeded daily stays "same 11")
  //  · H2H         → no bonus (pure seed, so you and your challenger replay identical)
  const bonus = state.daily ? window._dailyMatchdayBonus
              : (state.h2h ? null : window._matchdayBonus);
  const weights = pool.map(n => (NATION_TIER[n.code] || 2) + (bonus ? (bonus[n.code] || 0) : 0));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = _spinRng() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}
// Matchday tag for the spin RESULT screen, so the boost is legible ("why did I
// keep landing on teams playing today?"). Empty in seeded modes / no live data.
function matchdayNoteFor(code) {
  if (state.daily || state.h2h) return '';
  const b = window._matchdayBonus;
  if (!b || !b[code]) return '';
  return b[code] >= 3 ? '⚡ PLAYING TODAY' : (b[code] === 2 ? '⚡ PLAYED YESTERDAY' : '⚡ PLAYS TOMORROW');
}

// ----- Daily challenge state + helpers -----
function loadDailyState() {
  try { return JSON.parse(localStorage.getItem('pe_daily') || '{}') || {}; }
  catch (e) { return {}; }
}
function saveDailyState(s) { try { localStorage.setItem('pe_daily', JSON.stringify(s)); } catch (e) {} }
function dailyYesterdayString() { return easternDayString(new Date(Date.now() - 86400000)); }
function dailyPlayedToday() { return loadDailyState().lastDay === dailyDayString(); }
function dailyStreak() { return loadDailyState().streak || 0; }

// Begin today's Daily — Classic pool, a date-seeded spin sequence (same 11 for
// everyone), NO skips/swaps. ONE attempt per day: locked once played until 12 AM ET.
function startDailyChallenge() {
  if (dailyPlayedToday()) {                       // already used today's one go
    toast(`✓ TODAY'S DAILY IS DONE — NEW ONE IN ${fmtCountdown(msUntilNextEasternMidnight())}`);
    updateDailyCta();
    return;
  }
  state.mode = 'classic';
  state.daily = true;
  state.h2h = null;                           // Daily and H2H are mutually exclusive
  clearBlindForSeededRun();                   // fair board: no inherited hidden 1.25×
  document.body.classList.remove('is-h2h');
  // Make sure the frozen date-based daily bonus is ready (today/yesterday teams
  // spin more) before we seed — best-effort if fixtures have loaded.
  if (typeof buildDailyMatchdayBonus === 'function' && window._liveMatchesCache && !window._dailyMatchdayBonus) {
    try { buildDailyMatchdayBonus(); } catch (e) {}
  }
  _spinRng = mulberry32(fnv1a('PE-DAILY-' + dailyDayString()));
  document.querySelectorAll('.xi-mode').forEach(b => b.classList.toggle('xi-mode--active', b.dataset.mode === 'classic'));
  resetRoster();
  state.skipsLeft = 0; state.swapsLeft = 0;   // identical challenge for all
  updateResources();
  buildSpinnerCards();
  updateSpinButtonLabel();
  document.body.classList.add('is-daily');
  toast(`⭐ DAILY #${dailyNumber()} — same 11 for everyone · equal terms (no skips · no expert)`);
  document.getElementById('spinner')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function exitDaily() {   // leaving Daily / H2H for a normal mode
  state.daily = false;
  state.h2h = null;
  _spinRng = Math.random;
  document.body.classList.remove('is-daily', 'is-h2h');
}
// Seeded modes (Daily/H2H) hide the Expert toggle, so an inherited blind flag
// would be an invisible 1.25× multiplier some players have and others don't.
// Clear it and sync the (hidden) checkbox so the UI matches when it reappears.
function clearBlindForSeededRun() {
  state.blind = false;
  state.revealed = false;
  const t = document.getElementById('expertToggle');
  if (t) t.checked = false;
}

// ----- Head-to-head challenge (async): same 11 for you AND your friend -----
// opponent = {name, score} when you're ANSWERING a challenge; null when creating one.
function startH2HChallenge(seed, opponent) {
  state.mode = 'classic';
  state.daily = false;
  state.h2h = { seed: (seed >>> 0), opponent: opponent || null };
  clearBlindForSeededRun();   // both sides face the same 11 on equal terms
  _spinRng = mulberry32(state.h2h.seed);
  document.querySelectorAll('.xi-mode').forEach(b => b.classList.toggle('xi-mode--active', b.dataset.mode === 'classic'));
  resetRoster();                       // re-seeds + zeroes skips/swaps (h2h branch)
  state.skipsLeft = 0; state.swapsLeft = 0;
  updateResources();
  buildSpinnerCards();
  updateSpinButtonLabel();
  document.body.classList.add('is-daily', 'is-h2h');   // reuse the no-skip/swap/reset UI
  toast(opponent
    ? `⚔️ BEAT ${opponent.name} — they got ${opponent.score} · equal terms (no skips · no expert)`
    : '⚔️ CHALLENGE — same 11 for you both · equal terms (no skips · no expert)');
  document.getElementById('spinner')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
// Just the NAME part of "NAME · CITY".
function shortByName() {
  const full = (typeof getBuiltByName === 'function') ? getBuiltByName() : 'A FRIEND';
  return ((full.split('·')[0] || '').trim() || 'A FRIEND');
}
function h2hLink(score) {
  const seed = state.h2h ? state.h2h.seed : 0;
  const params = new URLSearchParams({ h2h: String(seed), n: shortByName(), s: String(score) });
  return `https://perfect-eleven.vercel.app/?${params.toString()}`;
}
// On load: if ?h2h= is present, auto-start the challenge vs the sender.
function handleH2HReturn() {
  try {
    const p = new URLSearchParams(window.location.search);
    const seedStr = p.get('h2h');
    if (seedStr == null) return false;
    const seed = parseInt(seedStr, 10);
    if (!Number.isFinite(seed)) return false;
    const opponent = { name: (p.get('n') || 'A FRIEND').slice(0, 24), score: parseInt(p.get('s'), 10) || 0 };
    window.history.replaceState({}, '', window.location.pathname);   // refresh won't re-trigger
    startH2HChallenge(seed, opponent);
    return true;
  } catch (e) { return false; }
}
function h2hKickerText(myScore) {
  const opp = state.h2h && state.h2h.opponent;
  if (!opp) return '⚔️ CHALLENGE READY — SEND IT TO A FRIEND';
  if (myScore > opp.score) return `⚔️ YOU WIN! ${myScore} vs ${opp.name} ${opp.score}`;
  if (myScore < opp.score) return `⚔️ ${opp.name} WINS — ${opp.score} vs YOUR ${myScore}`;
  return `🤝 DEAD HEAT — ${myScore} vs ${opp.name}`;
}
function copyH2HLink(score) {
  const link = h2hLink(score);
  const text = `⚔️ Beat my Perfect Eleven — I got ${score}. You get the SAME 11 spins: ${link}`;
  if (navigator.share) { navigator.share({ title: 'Beat my XI', text, url: link }).catch(() => {}); return; }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(link).then(() => toast('⚔️ CHALLENGE LINK COPIED — SEND IT!'), () => toast(link));
    return;
  }
  toast(link);
}
// Rematch: lose (or tie) → one tap starts a FRESH seeded run; when you finish it,
// the share copy is aimed back at the person who beat you. Ping-pong loop.
function startH2HRematch(name) {
  startH2HChallenge(Math.floor(Math.random() * 0xffffffff), null);
  state.h2h.rematchVs = name;   // remembered for the share copy after this run
  $('completeModal').hidden = true;
  toast(`🔁 REMATCH — new 11. Beat your score, then send it to ${name}`);
}
function renderH2HResult(myScore) {
  const row = document.getElementById('h2hRow');
  if (!row) return;
  if (!state.h2h) { row.hidden = true; return; }
  row.hidden = false;
  const opp = state.h2h.opponent;
  const vs = state.h2h.rematchVs;
  const verdict = opp
    ? (myScore > opp.score ? `🏆 You beat ${opp.name}! ${myScore} vs ${opp.score}`
      : myScore < opp.score ? `${opp.name} got you — ${opp.score} vs ${myScore}.`
      : `Dead heat with ${opp.name} — ${myScore} apiece.`)
    : (vs ? `Rematch ready — send it to ${vs}. Can they beat ${myScore}?`
          : `Send these exact 11 to a friend — can they beat ${myScore}?`);
  const rematchBtn = (opp && myScore <= opp.score)
    ? `<button class="xi-btn xi-btn--crimson" id="h2hRematchBtn">🔁 GET REVENGE — REMATCH ${opp.name}</button>`
    : '';
  row.innerHTML = `
    <p class="h2h-row__verdict">${verdict}</p>
    ${rematchBtn}
    <button class="xi-btn xi-btn--gold" id="h2hCopyBtn">⚔️ ${opp ? 'CHALLENGE SOMEONE ELSE' : 'COPY CHALLENGE LINK'}</button>`;
  const btn = document.getElementById('h2hCopyBtn');
  if (btn) btn.addEventListener('click', () => copyH2HLink(myScore));
  const rb = document.getElementById('h2hRematchBtn');
  if (rb) rb.addEventListener('click', () => startH2HRematch(opp.name));
}
// Update + return the streak after completing today's Daily.
// Premium perk: STREAK FREEZE — missing exactly ONE day doesn't reset the streak
// (auto-applied, once per calendar month).
function recordDailyCompletion(ovr) {
  const today = dailyDayString();
  const st = loadDailyState();
  if (st.lastDay === today) return st.streak || 1;        // already counted today
  if (st.lastDay === dailyYesterdayString()) {
    st.streak = (st.streak || 0) + 1;                     // consecutive day
  } else {
    const twoDaysAgo = easternDayString(new Date(Date.now() - 2 * 86400000));
    const month = today.slice(0, 7);                      // YYYY-MM (ET)
    const prem = (typeof isPremium === 'function') && isPremium();
    if (st.lastDay === twoDaysAgo && prem && st.freezeMonth !== month && (st.streak || 0) > 0) {
      st.streak = (st.streak || 0) + 1;                   // 🧊 freeze covers the missed day
      st.freezeMonth = month;
      toast('🧊 STREAK FREEZE used — your streak survived the missed day');
    } else {
      st.streak = 1;                                      // broken — start over
    }
  }
  st.lastDay = today;
  st.bestOvr = Math.max(st.bestOvr || 0, ovr || 0);
  saveDailyState(st);
  return st.streak;
}
// ----- Trophy case: unlockable badges (localStorage pe_badges) -----
const BADGES = {
  first_xi: { icon: '⚽', name: 'FIRST ELEVEN',   how: 'Complete your first XI' },
  champion: { icon: '🏆', name: 'WORLD CHAMPION', how: 'Win the World Cup' },
  ovr_100:  { icon: '💯', name: 'CENTURION',      how: 'Hit 100+ overall' },
  chem_30:  { icon: '🧪', name: 'CHEMISTRY LAB',  how: 'Reach 30+ chemistry' },
  blind_ace:{ icon: '🎭', name: 'BLIND MAESTRO',  how: 'Grade A+ or S drafting blind' },
  h2h_win:  { icon: '⚔️', name: 'DUEL WINNER',    how: 'Win a head-to-head' },
  streak_3: { icon: '🔥', name: 'HAT-TRICK',      how: '3-day daily streak' },
  streak_7: { icon: '🗓️', name: 'PERFECT WEEK',  how: '7-day daily streak' },
};
function loadBadges() { try { return JSON.parse(localStorage.getItem('pe_badges') || '{}') || {}; } catch (e) { return {}; } }
// Evaluate this run against every badge → returns the NEWLY unlocked ones.
function checkBadges(ctx) {
  const have = loadBadges();
  const earned = [];
  const award = (id, cond) => { if (cond && !have[id]) { have[id] = true; earned.push(id); } };
  award('first_xi',  true);
  award('champion',  ctx.finishTier === 'CHAMPIONS');
  award('ovr_100',   ctx.final >= 100);
  award('chem_30',   ctx.chem >= 30);
  award('blind_ace', ctx.wasBlind && (ctx.grade === 'S' || ctx.grade === 'A+'));
  award('h2h_win',   !!ctx.h2hWin);
  award('streak_3',  ctx.streak >= 3);
  award('streak_7',  ctx.streak >= 7);
  if (earned.length) { try { localStorage.setItem('pe_badges', JSON.stringify(have)); } catch (e) {} }
  return { earned, total: Object.keys(BADGES).length, count: Object.keys(have).length };
}
// Render the unlock moment (+ tappable trophy count) on the complete screen.
let _badgeCaseOpen = false;
function badgeCaseListHTML() {
  const have = loadBadges();
  return `<div class="xi-badges__list">` + Object.keys(BADGES).map(id => {
    const b = BADGES[id], owned = !!have[id];
    return `<span class="xi-badge ${owned ? '' : 'xi-badge--locked'}"><span class="xi-badge__icon">${owned ? b.icon : '🔒'}</span><span class="xi-badge__name">${b.name}</span><span class="xi-badge__how">${b.how}</span></span>`;
  }).join('') + `</div>`;
}
function renderBadgeRow(res) {
  const row = document.getElementById('xiBadgeRow');
  if (!row) return;
  if (!res.earned.length && res.count === 0) { row.hidden = true; return; }
  row.hidden = false;
  const newBits = res.earned.map(id => {
    const b = BADGES[id];
    return `<span class="xi-badge xi-badge--new"><span class="xi-badge__icon">${b.icon}</span><span class="xi-badge__name">UNLOCKED: ${b.name}</span><span class="xi-badge__how">${b.how}</span></span>`;
  }).join('');
  const countBtn = `<button type="button" class="xi-badges__count" id="badgeCaseBtn">🏅 TROPHY CASE ${res.count}/${res.total} ${_badgeCaseOpen ? '▴' : '▾'}</button>`;
  row.innerHTML = newBits + countBtn + (_badgeCaseOpen ? badgeCaseListHTML() : '');
  const btn = document.getElementById('badgeCaseBtn');
  if (btn) btn.addEventListener('click', () => { _badgeCaseOpen = !_badgeCaseOpen; renderBadgeRow(res); });
}

// 2-letter ISO → flag emoji (renders as the OS flag on the share text).
function flagEmoji(iso) {
  if (!iso || iso.length !== 2) return '⚽';
  const A = 0x1F1E6;
  return String.fromCodePoint(A + iso.toLowerCase().charCodeAt(0) - 97, A + iso.toLowerCase().charCodeAt(1) - 97);
}
function dailyShareText(ovr, finishLabel, streak) {
  const order = orderedSlots();
  const flags = order.map(i => flagEmoji((state.roster[i] || {}).iso)).join('');
  const fin = (finishLabel || '').replace(/[^\w\s-]/g, '').trim();
  return `Perfect Eleven · Daily #${dailyNumber()}\n${ovr} OVR${fin ? ' · ' + fin : ''}${streak > 1 ? ' · 🔥 ' + streak + ' day streak' : ''}\n${flags}\nperfect-eleven.vercel.app`;
}
// Hero kickoff pill: countdown before June 11, "LIVE" during the tournament
// (Jun 11 – Jul 19), hidden after the final.
function updateKickoffPill() {
  const el = document.getElementById('kickoffPill');
  if (!el) return;
  const now = Date.now();
  const kickoff = Date.UTC(2026, 5, 11, 19, 0);   // MEX vs RSA — 3 PM ET Jun 11 (API-confirmed)
  const final_  = Date.UTC(2026, 6, 19, 23, 59);  // final Jul 19
  if (now < kickoff) {
    // ET calendar days so "TODAY"/"TOMORROW" flip at the right midnight.
    const dayNow = easternDayString();
    el.textContent = dayNow === '2026-06-11' ? '⚽ KICKS OFF TODAY · 3PM ET'
      : dayNow === '2026-06-10' ? '⚽ KICKS OFF TOMORROW'
      : `⚽ KICKS OFF IN ${Math.ceil((kickoff - now) / 86400000)} DAYS`;
    el.hidden = false;
  } else if (now <= final_) {
    el.textContent = '🔴 THE WORLD CUP IS LIVE';
    el.classList.add('kickoff-pill--live');
    el.hidden = false;
  } else {
    el.hidden = true;
  }
}

// Refresh the Daily CTA copy (number, streak, played-today state).
// How many people have posted TODAY'S daily to the global board (social proof).
// Reads the already-fetched leaderboard rows — no extra network.
function dailyPlayedCount() {
  try {
    if (typeof _lbRows === 'undefined' || !Array.isArray(_lbRows)) return 0;
    const today = dailyDayString();
    return _lbRows.filter(r =>
      String(r.mode || '').toUpperCase().replace(/\s+/g, '') === 'DAILY' &&
      easternDayString(new Date(r.createdAt || 0)) === today).length;
  } catch (e) { return 0; }
}
function updateDailyCta() {
  const cta = $('dailyCta'), title = $('dailyTitle'), sub = $('dailySub'), go = $('dailyGo');
  if (!sub) return;
  const streak = dailyStreak();
  if (title) title.textContent = `DAILY #${dailyNumber()}`;
  const played = dailyPlayedCount();
  const crowd = played >= 3 ? ` · 🌍 ${played} played` : '';
  if (dailyPlayedToday()) {
    // One go per day — locked until the next 12 AM ET.
    sub.textContent = `✓ Done${streak > 0 ? ` · 🔥 ${streak}` : ''} · next in ${fmtCountdown(msUntilNextEasternMidnight())}${crowd}`;
    if (go) go.textContent = '🔒 TIL 12AM ET';   // not a paywall — the one-a-day lock
    if (cta) { cta.classList.add('xi-daily--locked'); cta.setAttribute('aria-disabled', 'true'); }
  } else {
    sub.textContent = (streak > 0
      ? `🔥 ${streak}-day streak · one attempt · same 11 for all`
      : 'One attempt · same 11 spins for everyone · no skips') + crowd;
    if (go) go.textContent = 'PLAY →';
    if (cta) { cta.classList.remove('xi-daily--locked'); cta.removeAttribute('aria-disabled'); }
  }
}

// Spin button reads "SPIN POSITION" in Tactical, "SPIN THE WORLD" otherwise.
function updateSpinButtonLabel() {
  const btn = $('spinBtn');
  const span = btn && btn.querySelector('span:not(.xi-btn__arrow)');
  if (span) span.textContent = state.mode === 'tactical' ? 'SPIN POSITION' : 'SPIN THE WORLD';
  refreshStickySpin();
}

// Shared spinner animation — scrolls the strip so the card with `code` lands center.
function animateSpinnerTo(code, onDone) {
  const cards = $('spinnerCards');
  cards.classList.remove('spinning');
  cards.style.transition = 'none';
  cards.style.transform = 'translate(0, -50%)';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const matches = [...cards.querySelectorAll(`.xi-card[data-code="${code}"]`)];
      const targetCard = matches[Math.min(matches.length - 1, Math.floor(matches.length * 0.7))];
      if (targetCard) {
        const containerW = $('spinner').offsetWidth;
        const actualCardW = targetCard.offsetWidth;
        const cardCenter = targetCard.offsetLeft + (actualCardW / 2);
        const offset = (containerW / 2) - cardCenter;
        cards.style.transition = '';
        cards.classList.add('spinning');
        cards.style.transform = `translate(${offset}px, -50%)`;
      }
    });
  });
  setTimeout(() => { state.isSpinning = false; onDone && onDone(); }, 4300);
}

function spin() {
  if (state.isSpinning) return;
  track('spin', { mode: state.mode });
  if (state.mode === 'tactical') return spinTactical();
  const available = getNationPool(state.mode).filter(n => !state.usedNations.has(n.code));
  if (available.length === 0) return;

  state.isSpinning = true;
  $('spinBtn').disabled = true;
  refreshStickySpin();
  if (_stickyInitiatedSpin) startStickySpinFlash();
  _stickyInitiatedSpin = false;
  $('spinnerResult').classList.remove('show');
  buildSpinnerCards();

  const winner = weightedPick(available);
  state.currentNation = winner;
  animateSpinnerTo(winner.code, () => {
    showResult(winner);
    setTimeout(openPickModal, 600);
  });
}

// TACTICAL — spin lands on a random OPEN position, then deals 5 candidates.
function spinTactical() {
  const openSlots = Object.keys(SLOT_DEF).filter(i => !state.roster[i]);
  if (!openSlots.length) return;

  state.isSpinning = true;
  $('spinBtn').disabled = true;
  refreshStickySpin();
  if (_stickyInitiatedSpin) startStickySpinFlash();
  _stickyInitiatedSpin = false;
  $('spinnerResult').classList.remove('show');
  buildSpinnerCards();

  const slotIdx = openSlots[Math.floor(Math.random() * openSlots.length)];
  state.currentSlot = slotIdx;
  state.tacticalDraw = null;   // fresh 5 for this new spin
  const role = SLOT_DEF[slotIdx].role;
  animateSpinnerTo(role, () => {
    showResultTactical(slotIdx);
    setTimeout(openPickModal, 600);
  });
}

// FIFA world ranking — shown only in CLASSIC / TOP 50 (current nations).
function fifaRankBadge(code) {
  if (state.mode !== 'classic' && state.mode !== 'top50') return '';
  const r = (typeof fifaRank === 'function') ? fifaRank(code) : null;
  return r ? ` <span class="fifa-rank">FIFA&nbsp;#${r}</span>` : '';
}

function showResult(nation) {
  $('resultFlag').innerHTML = `<img src="${flagURL(nation.iso, 160)}" srcset="${flagURL2x(nation.iso, 160)} 2x" alt="${nation.name}" class="result-flag-img" />`;
  $('resultName').textContent = nation.name;
  const r = (typeof fifaRank === 'function') ? fifaRank(nation.code) : null;
  const baseLabel = ((state.mode === 'classic' || state.mode === 'top50') && r)
    ? `FIFA WORLD RANK #${r}`
    : nation.group;
  const md = matchdayNoteFor(nation.code);
  $('resultGroup').innerHTML = md
    ? `${baseLabel} <span class="result-matchday">${md}</span>`
    : baseLabel;
  $('spinnerResult').classList.add('show');
  if (typeof landStickySpin === 'function') landStickySpin(nation);   // mirror the result in the sticky bar
}

function showResultTactical(slotIdx) {
  const role = SLOT_DEF[slotIdx].role;
  $('resultFlag').innerHTML = `<span class="result-pos">${role}</span>`;
  $('resultName').textContent = POS_FULL[role] || role;
  $('resultGroup').textContent = 'PICK THE BEST ONE';
  $('spinnerResult').classList.add('show');
  if (typeof landStickySpin === 'function') landStickySpin({ iso: null, name: POS_FULL[role] || role });
}

// ============================================================
// TACTICAL ENGINE — position-first drafting
// ============================================================
// Reverse of ROLE_FIT: which player roles NATURALLY fill a given slot role.
function playerRolesForSlot(slotRole) {
  const roles = [];
  for (const [pRole, slots] of Object.entries(ROLE_FIT)) {
    if (slots.includes(slotRole)) roles.push(pRole);
  }
  return roles;
}

// Flatten the CLASSIC pool into players tagged with their nation.
function tacticalPlayerPool() {
  const all = [];
  NATIONS.forEach(n => n.players.forEach(p => {
    all.push({ ...p, nation: n.name, flag: n.flag, code: n.code, iso: n.iso, league: clubToLeague(p.club) });
  }));
  return all;
}

// Deal `count` distinct candidates for a slot — rating-weighted (so you usually
// get a mix of a star or two and squad players), de-duped against players already
// drafted this run. Returned SHUFFLED (not sorted) so you have to read the names,
// not just grab the top of the list.
function drawTacticalPlayers(slotRole, count = 12) {
  const fitRoles = playerRolesForSlot(slotRole);
  const pool = tacticalPlayerPool().filter(p => fitRoles.includes(p.role) && !state.usedPlayers.has(p.name));
  const picked = [];
  while (picked.length < count && pool.length) {
    const weights = pool.map(p => Math.pow(Math.max(1, p.rating - 60), 1.7));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total, idx = 0;
    for (; idx < pool.length; idx++) { r -= weights[idx]; if (r <= 0) break; }
    idx = Math.min(idx, pool.length - 1);
    picked.push(pool[idx]);
    pool.splice(idx, 1);
  }
  // Fisher-Yates shuffle so the candidates aren't in rating order
  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [picked[i], picked[j]] = [picked[j], picked[i]];
  }
  return picked;
}

function openTacticalPickModal() {
  const slotIdx = state.currentSlot;
  if (slotIdx == null) return;
  const role = SLOT_DEF[slotIdx].role;
  // Reuse the existing draw on resume; deal a fresh 5 on a new spin.
  const players = state.tacticalDraw || drawTacticalPlayers(role, 12);
  state.tacticalDraw = players;

  // Highlight the target slot on the pitch
  clearSlotHighlights();
  const slotEl = document.querySelector(`.slot[data-slot="${slotIdx}"]`);
  if (slotEl) slotEl.classList.add('slot--empty-target');

  $('modalTitle').innerHTML = `<span class="modal-pos">${role}</span> ${POS_FULL[role] || role}`;
  $('modalLede').textContent = `The wheel landed on ${POS_FULL[role] || role}. 12 options — read the names and pick wisely.`;

  $('modalPlayers').innerHTML = players.map((p, idx) => {
    const league = clubToLeague(p.club);
    return `
      <button class="player" data-idx="${idx}">
        <div class="player__top">
          <span class="player__pos player__pos--${p.pos.toLowerCase()}">${p.role}</span>
          <span class="player__rating">${maskRating(p.rating)}</span>
        </div>
        <div class="player__name">${p.name}${ratingsHidden() ? '' : formChipFor(p, 'roster__form')}</div>
        <div class="player__meta">
          <span class="player__club">${p.club}</span>
          <span class="player__league player__league--${league.toLowerCase()}">${league}</span>
        </div>
        <div class="player__fit player__fit--natural">${p.nation.toUpperCase()}</div>
      </button>
    `;
  }).join('');

  // The in-modal "SWAP IN" button is a CLASSIC mechanic (replace a slot from
  // the current nation's pool). Tactical has no current nation and the spun
  // position is always an OPEN slot, so it doesn't apply — hide it. Swapping in
  // Tactical is done via the main SWAP button (remove a placed player).
  const pickSwapBtn = document.getElementById('pickSwapBtn');
  if (pickSwapBtn) pickSwapBtn.style.display = 'none';

  hidePickResumeBar();
  $('pickModal').hidden = false;
  $('modalPlayers').querySelectorAll('.player').forEach(btn => {
    btn.addEventListener('click', () => pickPlayer(state.tacticalDraw[parseInt(btn.dataset.idx, 10)]));
  });
}

function pickTacticalPlayer(p) {
  const slotIdx = state.currentSlot;
  if (slotIdx == null) return;
  state.roster[slotIdx] = { ...p, naturalFit: true };
  state.usedPlayers.add(p.name);
  state.currentSlot = null;
  state.tacticalDraw = null;
  fillSlot(slotIdx);
  updateProgress();
  closePickModal();
  $('spinnerResult').classList.remove('show');
  if (Object.keys(state.roster).length === 11) setTimeout(showCompleteModal, 400);
}

// ============================================================
// SLOT MATCHING — exact role first, then group fallback
// ============================================================
function bestSlotForPlayer(player) {
  // priority list of slot roles for this player's role
  const fits = ROLE_FIT[player.role] || [];
  for (const slotRole of fits) {
    for (const [slotIdxStr, def] of Object.entries(SLOT_DEF)) {
      if (def.role === slotRole && !state.roster[slotIdxStr]) {
        return { slotIdx: slotIdxStr, exact: true };
      }
    }
  }
  // fallback — any open slot in same group
  for (const [slotIdxStr, def] of Object.entries(SLOT_DEF)) {
    if (def.pos === player.pos && !state.roster[slotIdxStr]) {
      return { slotIdx: slotIdxStr, exact: false };
    }
  }
  return null;
}

function canPlayerFit(player) {
  return bestSlotForPlayer(player) !== null;
}

// ============================================================
// PICK MODAL
// ============================================================
// Keep an OPEN pick/swap modal in sync when live data lands (form ▲/▼ chips,
// ⚽/🎯 badges). The modal renders ONCE on open — without this, a modal opened
// in the first second (before /api/live?view=stats resolves) would never show
// form. Scroll position is preserved so a refresh never yanks the list.
function rerenderOpenPickModal() {
  const modal = document.getElementById('pickModal');
  if (!modal || modal.hidden) return;
  const scroller = modal.querySelector('.modal__panel');   // the actual scroll container
  const scroll = scroller ? scroller.scrollTop : 0;
  try {
    if (state.mode === 'tactical') { if (state.currentSlot != null) openTacticalPickModal(); }
    else if (state.pickSwapMode) rerenderPickModalForSwapIn();
    else if (state.currentNation) openPickModal();
  } catch (e) { /* leave the modal as-is on any error */ }
  const scroller2 = modal.querySelector('.modal__panel');
  if (scroller2) scroller2.scrollTop = scroll;
}

function openPickModal() {
  if (state.mode === 'tactical') return openTacticalPickModal();
  const n = state.currentNation;
  if (!n) return;

  // Restore the in-modal SWAP IN button (Tactical hides it).
  const pickSwapBtn = document.getElementById('pickSwapBtn');
  if (pickSwapBtn) pickSwapBtn.style.display = '';

  // figure which positions/roles are still open
  highlightOpenSlots(n.players);

  $('modalTitle').innerHTML = `<img src="${flagURL(n.iso, 80)}" srcset="${flagURL2x(n.iso, 80)} 2x" alt="${n.name}" class="modal-title-flag" /> ${n.name}${fifaRankBadge(n.code)}`;
  $('modalLede').textContent = `Pick one player from ${n.name}. Players in already-filled positions are locked.`;

  const html = n.players.map((p, idx) => {
    const fit = bestSlotForPlayer(p);
    const canPick = fit !== null;
    const league = clubToLeague(p.club);
    const tag = canPick && fit.exact ? 'NATURAL' : (canPick ? 'OUT OF POS' : 'LOCKED');
    // Only preview chem on pickable cards — a LOCKED player (position already
    // filled) can't be added, so advertising "+N CHEM" on it is misleading.
    // In EXPERT mode chem is a number, so it's hidden too.
    let chemBadge = '';
    if (canPick && !ratingsHidden()) {
      const d = previewChemDelta(p);
      const tier = d >= 3 ? 'great' : d >= 1 ? 'good' : 'neutral';
      chemBadge = `<span class="player__chem player__chem--${tier}">+${d} CHEM</span>`;
    }
    return `
      <button class="player" data-idx="${idx}" ${canPick ? '' : 'disabled'}>
        <div class="player__top">
          <span class="player__pos player__pos--${p.pos.toLowerCase()}">${p.role}</span>
          <span class="player__rating">${maskRating(p.rating)}</span>
        </div>
        <div class="player__name">${p.name}${ratingsHidden() ? '' : formChipFor({ ...p, code: n.code }, 'roster__form')}</div>
        <div class="player__meta">
          <span class="player__club">${p.club}</span>
          <span class="player__league player__league--${league.toLowerCase()}">${league}</span>
          ${chemBadge}
        </div>
        ${ratingsHidden() ? '' : liveStatsBadge(p.name)}
        <div class="player__fit player__fit--${canPick ? (fit.exact ? 'natural' : 'oop') : 'locked'}">${tag}</div>
      </button>
    `;
  }).join('');

  $('modalPlayers').innerHTML = html;
  hidePickResumeBar();
  $('pickModal').hidden = false;

  $('modalPlayers').querySelectorAll('.player').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx, 10);
      pickPlayer(n.players[idx]);
    });
  });
}

function closePickModal() {
  $('pickModal').hidden = true;
  hidePickResumeBar();
  clearSlotHighlights();
  $('spinBtn').disabled = false;
  resetStickySpin();
  refreshStickySpin();
}

// ============================================================
// MINIMIZE / RESUME the pick modal — peek at your team mid-pick.
// Hides the modal WITHOUT spending a skip or losing the spun nation,
// keeps the open-slot highlights visible, and drops a resume bar so you
// can jump back in. (On mobile the modal covers the whole pitch, so you
// couldn't see which slots still need filling without committing.)
// ============================================================
function minimizePickModal() {
  if (!state.currentNation && state.currentSlot == null) { closePickModal(); return; }
  $('pickModal').hidden = true;            // hide, but keep the spun nation/slot + highlights
  const bar = $('pickResumeBar');
  const nm  = $('pickResumeNation');
  if (nm) {
    if (state.mode === 'tactical' && state.currentSlot != null) {
      nm.innerHTML = `<span class="pick-resume__pos">${SLOT_DEF[state.currentSlot].role}</span>`;
    } else if (state.currentNation) {
      nm.innerHTML = `<img class="pick-resume__flag" src="${flagURL(state.currentNation.iso, 40)}" alt="" /> ${state.currentNation.code}`;
    }
  }
  if (bar) bar.hidden = false;
  // Bring the pitch into view so the open (highlighted) slots are visible.
  const pitch = document.getElementById('pitch');
  if (pitch) pitch.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function resumePickModal() {
  hidePickResumeBar();
  if (!state.currentNation && state.currentSlot == null) return;
  if (state.pickSwapMode) {
    $('pickModal').hidden = false;
    rerenderPickModalForSwapIn();
  } else {
    openPickModal();                       // re-renders from current nation OR tactical slot
  }
}

function hidePickResumeBar() {
  const bar = $('pickResumeBar');
  if (bar) bar.hidden = true;
}

function pickPlayer(p) {
  // Tactical never uses the classic pick-swap flow — route it first so a stray
  // pickSwapMode flag can't divert a tactical pick into the nation-based swap.
  if (state.mode === 'tactical') return pickTacticalPlayer(p);
  // If we're in pick-swap mode, divert to the swap-in flow
  if (state.pickSwapMode) {
    executePickSwap(p);
    return;
  }
  // Is there an OPEN slot where this player is a NATURAL fit?
  const naturalIdx = Object.keys(SLOT_DEF).find(
    i => !state.roster[i] && (ROLE_FIT[p.role] || []).includes(SLOT_DEF[i].role)
  );
  if (naturalIdx != null) {
    placePlayerAt(p, naturalIdx);                 // clean natural fit → place it, no fuss
    return;
  }
  // No natural slot open → let the user CHOOSE where to play them out of position
  // (e.g. a left-back at right-back −1 vs centre-back −2), instead of auto-dumping
  // them in the first open defender slot.
  enterPlacementMode(p);
}

// Place `player` (from state.currentNation) into a specific slot with the correct
// tiered OOP penalty. Shared by the natural-fit auto-place and manual placement.
function placePlayerAt(player, slotIdx) {
  if (!state.currentNation || state.roster[slotIdx]) return;
  const oop = oopPenalty(player.role, SLOT_DEF[slotIdx].role);
  state.roster[slotIdx] = {
    ...player,
    nation: state.currentNation.name,
    flag: state.currentNation.flag,
    code: state.currentNation.code,
    iso: state.currentNation.iso,
    league: clubToLeague(player.club),
    naturalFit: oop === 0,
    oop,
  };
  state.usedNations.add(state.currentNation.code);
  state.currentNation = null;
  exitPlacementMode();
  fillSlot(slotIdx);
  updateProgress();
  updateChemistryViz();
  closePickModal();
  $('spinnerResult').classList.remove('show');
  if (Object.keys(state.roster).length === 11) setTimeout(showCompleteModal, 400);
}

// ----- MANUAL PLACEMENT — tap an open slot to choose where an OOP player goes -----
function enterPlacementMode(player) {
  state.placing = { player };
  closePickModal();
  $('spinnerResult').classList.remove('show');
  const order = ['', '−1', '−2'];   // badge by penalty
  let cheapest = 2;
  document.querySelectorAll('.slot').forEach(el => {
    const i = el.dataset.slot;
    if (state.roster[i]) return;                  // only open slots are targets
    const pen = oopPenalty(player.role, SLOT_DEF[i].role);
    if (pen < cheapest) cheapest = pen;
    el.classList.add('slot--place-target');
    el.classList.toggle('slot--place-natural', pen === 0);
    const tag = pen === 0 ? '✓ NATURAL' : order[pen];
    el.innerHTML = `<span class="slot__open">OPEN</span><span class="slot__place-cost slot__place-cost--${pen}">${tag}</span>`;
    el.addEventListener('click', onPlaceSlotClick);
  });
  // mark the cheapest open slots as recommended
  document.querySelectorAll('.slot--place-target').forEach(el => {
    const i = el.dataset.slot;
    if (oopPenalty(player.role, SLOT_DEF[i].role) === cheapest) el.classList.add('slot--place-best');
  });
  showPlacementBar(player, cheapest);
  document.getElementById('pitch')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function onPlaceSlotClick(e) {
  const i = e.currentTarget.dataset.slot;
  if (!state.placing || state.roster[i]) return;
  placePlayerAt(state.placing.player, i);
}
function exitPlacementMode() {
  document.querySelectorAll('.slot--place-target').forEach(el => {
    el.classList.remove('slot--place-target', 'slot--place-natural', 'slot--place-best');
    el.removeEventListener('click', onPlaceSlotClick);
    if (!state.roster[el.dataset.slot]) el.innerHTML = '<span class="slot__open">OPEN</span>';
  });
  const bar = document.getElementById('placementBar');
  if (bar) bar.remove();
  state.placing = null;
}
function showPlacementBar(player, cheapest) {
  const old = document.getElementById('placementBar');
  if (old) old.remove();
  const costTxt = cheapest === 0 ? 'NATURAL FITS OPEN' : `BEST FIT IS −${cheapest}`;
  const bar = document.createElement('div');
  bar.id = 'placementBar';
  bar.className = 'placement-bar';
  bar.innerHTML = `
    <span class="placement-bar__txt">⤵ TAP A SLOT FOR <b>${shortName(player.name)}</b> · ${costTxt}</span>
    <button class="placement-bar__cancel" type="button">CANCEL</button>`;
  bar.querySelector('.placement-bar__cancel').addEventListener('click', cancelPlacement);
  document.body.appendChild(bar);
}
function cancelPlacement() {
  // Put the spun nation back in play and re-open its pick list.
  exitPlacementMode();
  if (state.currentNation) openPickModal();
}

// ============================================================
// PICK-SWAP MODE — pick a player from this nation to swap IN
// for a filled slot of the same position
// ============================================================
function findFilledSlotForSwap(player) {
  const all = findAllFilledSlotsForSwap(player);
  return all[0] || null;
}

function findAllFilledSlotsForSwap(player) {
  const matches = [];
  const seen = new Set();
  // Exact role matches first
  const fits = ROLE_FIT[player.role] || [];
  for (const slotRole of fits) {
    for (const [slotIdxStr, def] of Object.entries(SLOT_DEF)) {
      if (def.role === slotRole && state.roster[slotIdxStr] && !seen.has(slotIdxStr)) {
        matches.push({ slotIdx: slotIdxStr, exact: true });
        seen.add(slotIdxStr);
      }
    }
  }
  // Same pos group fallback
  for (const [slotIdxStr, def] of Object.entries(SLOT_DEF)) {
    if (def.pos === player.pos && state.roster[slotIdxStr] && !seen.has(slotIdxStr)) {
      matches.push({ slotIdx: slotIdxStr, exact: false });
      seen.add(slotIdxStr);
    }
  }
  return matches;
}

function enterPickSwapMode() {
  if (state.swapsLeft <= 0) { toast('NO SWAPS LEFT'); return; }
  if (Object.keys(state.roster).length === 0) { toast('NOTHING TO SWAP — PICK A PLAYER FIRST'); return; }
  state.pickSwapMode = true;
  // re-render the player cards with swap-target labels
  rerenderPickModalForSwapIn();
  const btn = document.getElementById('pickSwapBtn');
  if (btn) {
    btn.innerHTML = '<span>CANCEL SWAP</span><span class="xi-btn__arrow">×</span>';
    btn.onclick = exitPickSwapMode;
  }
  toast('PICK A PLAYER TO SWAP IN');
}

function exitPickSwapMode() {
  state.pickSwapMode = false;
  // re-render normal
  openPickModal();
  const btn = document.getElementById('pickSwapBtn');
  if (btn) {
    btn.innerHTML = `<span>SWAP IN (<span class="swap-count-num">${state.swapsLeft}</span>)</span><span class="xi-btn__arrow">⇆</span>`;
    btn.onclick = enterPickSwapMode;
  }
}

function rerenderPickModalForSwapIn() {
  const n = state.currentNation;
  if (!n) return;
  $('modalLede').textContent = `Pick a player from ${n.name} to SWAP IN. They'll replace your current player in that position.`;

  const html = n.players.map((p, idx) => {
    const matches = findAllFilledSlotsForSwap(p);
    const canSwap = matches.length > 0;
    const league = clubToLeague(p.club);
    let tag;
    if (!canSwap) {
      tag = '✕ NO SLOT TO SWAP';
    } else if (matches.length === 1) {
      tag = `↪ REPLACES ${state.roster[matches[0].slotIdx].name.toUpperCase()}`;
    } else {
      // Show the slot roles the user can pick from (e.g., "LCM / RCM / CDM")
      const roles = matches.map(m => SLOT_DEF[m.slotIdx]?.role).filter(Boolean).join(' / ');
      tag = `↪ CHOOSE: ${roles}`;
    }
    // Chem preview only when the swap target is unambiguous — otherwise the
    // delta depends on which slot the user picks in the next overlay.
    // Hidden in EXPERT mode (it's a number).
    let chemBadge = '';
    if (canSwap && matches.length === 1 && !ratingsHidden()) {
      const d = previewChemDelta(p, matches[0].slotIdx);
      const sign = d >= 0 ? '+' : '';
      const tier = d >= 3 ? 'great' : d >= 1 ? 'good' : d >= 0 ? 'neutral' : 'bad';
      chemBadge = `<span class="player__chem player__chem--${tier}">${sign}${d} CHEM</span>`;
    }
    return `
      <button class="player ${canSwap ? 'player--swap-in' : ''}" data-idx="${idx}" ${canSwap ? '' : 'disabled'}>
        <div class="player__top">
          <span class="player__pos player__pos--${p.pos.toLowerCase()}">${p.role}</span>
          <span class="player__rating">${maskRating(p.rating)}</span>
        </div>
        <div class="player__name">${p.name}${ratingsHidden() ? '' : formChipFor({ ...p, code: n.code }, 'roster__form')}</div>
        <div class="player__meta">
          <span class="player__club">${p.club}</span>
          <span class="player__league player__league--${league.toLowerCase()}">${league}</span>
          ${chemBadge}
        </div>
        <div class="player__fit ${canSwap ? 'player__fit--swap' : 'player__fit--locked'}">${tag}</div>
      </button>
    `;
  }).join('');

  $('modalPlayers').innerHTML = html;
  $('modalPlayers').querySelectorAll('.player').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx, 10);
      pickPlayer(n.players[idx]);
    });
  });
}

function executePickSwap(p) {
  const matches = findAllFilledSlotsForSwap(p);
  if (!matches.length) { toast('NO SLOT MATCHES THAT POSITION'); return; }
  if (matches.length > 1) {
    showSwapTargetPicker(p, matches);
    return;
  }
  doPickSwap(p, matches[0]);
}

function showSwapTargetPicker(p, matches) {
  const overlay = document.createElement('div');
  overlay.id = 'swapTargetPicker';
  overlay.className = 'swap-picker';
  const incoming = ratingsHidden() ? `${p.name} (${p.role})` : `${p.name} (${p.role} · ${p.rating})`;
  const rows = matches.map((m, i) => {
    const cur = state.roster[m.slotIdx];
    const slotLabel = SLOT_DEF[m.slotIdx]?.role || '?';
    const fitTag = m.exact ? 'NATURAL' : 'OUT OF POS';
    return `
      <button class="swap-picker__row" data-pick-idx="${i}">
        <span class="swap-picker__slot">${slotLabel}</span>
        <img class="swap-picker__flag" src="${flagURL(cur.iso, 80)}" srcset="${flagURL2x(cur.iso, 80)} 2x" alt="${cur.nation}" />
        <span class="swap-picker__name">${cur.name}</span>
        <span class="swap-picker__rating">${maskRating(cur.rating)}</span>
        <span class="swap-picker__fit swap-picker__fit--${m.exact ? 'nat' : 'oop'}">${fitTag}</span>
      </button>
    `;
  }).join('');
  overlay.innerHTML = `
    <div class="swap-picker__panel">
      <div class="swap-picker__head">
        <span class="swap-picker__title">SWAP IN ${p.name.toUpperCase()}</span>
        <button class="swap-picker__cancel" id="swapPickerCancel">CANCEL</button>
      </div>
      <div class="swap-picker__sub">REPLACE WHICH PLAYER?</div>
      <div class="swap-picker__rows">${rows}</div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelectorAll('.swap-picker__row').forEach((btn, i) => {
    btn.addEventListener('click', () => {
      overlay.remove();
      doPickSwap(p, matches[i]);
    });
  });
  document.getElementById('swapPickerCancel').addEventListener('click', () => overlay.remove());
}

function doPickSwap(p, target) {
  const slotIdx = target.slotIdx;
  const oldPlayer = state.roster[slotIdx];

  // Free up old player's nation (it's no longer locked)
  state.usedNations.delete(oldPlayer.code);
  // Lock the new player's nation
  state.usedNations.add(state.currentNation.code);

  // Replace roster entry
  state.roster[slotIdx] = {
    ...p,
    nation: state.currentNation.name,
    flag: state.currentNation.flag,
    code: state.currentNation.code,
    iso: state.currentNation.iso,
    league: clubToLeague(p.club),
    naturalFit: target.exact,
  };

  // Re-render the slot on the pitch
  const el = document.querySelector(`.slot[data-slot="${slotIdx}"]`);
  if (el) {
    el.classList.remove('slot--oop');
    if (!target.exact) el.classList.add('slot--oop');
    el.classList.add('slot--filled');
    el.innerHTML = `
      <img class="slot__filled-flag" src="${flagURL(state.currentNation.iso, 80)}" srcset="${flagURL2x(state.currentNation.iso, 80)} 2x" alt="${state.currentNation.name}" />
      <span class="slot__filled-name"${nameFit(p.name)}>${shortName(p.name)}</span>
      <span class="slot__filled-rating">${maskRating(p.rating)}</span>
      <span class="slot__filled-chem" data-slot-chem="${slotIdx}"></span>
    `;
  }

  // Burn the swap
  state.swapsLeft--;
  state.pickSwapMode = false;

  // Close pick modal + reset
  $('pickModal').hidden = true;
  clearSlotHighlights();
  $('spinBtn').disabled = false;
  resetStickySpin();
  refreshStickySpin();
  state.currentNation = null;
  $('spinnerResult').classList.remove('show');

  updateProgress();
  updateChemistryViz();

  toast(`${p.name.toUpperCase()} REPLACED ${oldPlayer.name.toUpperCase()}`);

  // Reset pick-swap button text for next time
  const btn = document.getElementById('pickSwapBtn');
  if (btn) {
    btn.innerHTML = `<span>SWAP IN (<span class="swap-count-num">${state.swapsLeft}</span>)</span><span class="xi-btn__arrow">⇆</span>`;
    btn.onclick = enterPickSwapMode;
  }
}

function isUnlimitedSkipsMode() {
  return state.mode === 'u25';
}

function passSpin() {
  // U-25 mode: unlimited skips — the wonderkid pool is huge
  if (isUnlimitedSkipsMode()) {
    closePickModal();
    state.currentNation = null;
    $('spinnerResult').classList.remove('show');
    toast('SPIN AGAIN — U-25 HAS UNLIMITED SKIPS');
    return;
  }
  if (state.skipsLeft <= 0) {
    // Offer rewarded ad instead of just blocking
    offerRewardedSkip();
    return;
  }
  state.skipsLeft--;
  updateResources();
  closePickModal();
  state.currentNation = null;
  state.currentSlot = null;   // TACTICAL — drop the spun position too
  $('spinnerResult').classList.remove('show');
  toast(`SKIP USED. ${state.skipsLeft} LEFT.`);
}

// ============================================================
// REWARDED VIDEO AD — gives +1 skip when out (mocked SDK)
// Real swap: replace `runRewardedAd()` body with AdMob H5 / AdSense H5 SDK
// docs: https://developers.google.com/admob/web
// ============================================================
function offerRewardedSkip() {
  // Hard cap per session to prevent abuse
  if ((state.rewardedSkipsThisSession || 0) >= 5) {
    toast('NO SKIPS LEFT — PICK A PLAYER OR UNLOCK PREMIUM');
    return;
  }
  // Build the rewarded-ad modal on demand
  const existing = document.getElementById('rewardedAdModal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'rewardedAdModal';
  modal.className = 'rewarded-ad';
  modal.innerHTML = `
    <div class="rewarded-ad__backdrop"></div>
    <div class="rewarded-ad__panel">
      <div class="rewarded-ad__head">
        <span class="rewarded-ad__pill">⚡ EXTRA SKIP</span>
        <button class="rewarded-ad__close" aria-label="Close">×</button>
      </div>
      <h3 class="rewarded-ad__title">OUT OF SKIPS?</h3>
      <p class="rewarded-ad__body">Watch a short ad to earn <strong>+1 SKIP</strong>. Or unlock <strong>PREMIUM</strong> for unlimited modes.</p>
      <button class="rewarded-ad__watch xi-btn xi-btn--gold">▶ WATCH A QUICK AD</button>
      <button class="rewarded-ad__premium xi-btn xi-btn--ghost">UNLOCK PREMIUM $4.99</button>
      <p class="rewarded-ad__small">ADS HELP KEEP PERFECT ELEVEN FREE · ${(state.rewardedSkipsThisSession || 0)}/5 USED</p>
    </div>
  `;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('.rewarded-ad__backdrop').onclick = close;
  modal.querySelector('.rewarded-ad__close').onclick = close;
  modal.querySelector('.rewarded-ad__premium').onclick = () => {
    close();
    if (typeof showPaywall === 'function') showPaywall(); else $('paywallModal').hidden = false;
  };
  modal.querySelector('.rewarded-ad__watch').onclick = () => {
    runRewardedAd(modal, () => {
      state.skipsLeft++;
      state.rewardedSkipsThisSession = (state.rewardedSkipsThisSession || 0) + 1;
      updateResources();
      close();
      toast(`+1 SKIP EARNED. ${state.skipsLeft} TOTAL.`);
    });
  };
}

function runRewardedAd(modal, onComplete) {
  // === SDK PLACEHOLDER ===
  // TODO: swap with real AdMob H5 / AdSense H5 / Funding Choices rewarded ad SDK
  // Real shape:
  //   const ad = await adSdk.loadRewarded('UNIT-ID');
  //   ad.on('reward', onComplete);
  //   ad.show();
  // For now: 5-second simulated countdown so the UX is fully wired up.
  const panel = modal.querySelector('.rewarded-ad__panel');
  panel.innerHTML = `
    <div class="rewarded-ad__ad-stub">
      <div class="rewarded-ad__ad-label">▶ AD</div>
      <div class="rewarded-ad__ad-content">YOUR AD HERE</div>
      <div class="rewarded-ad__ad-timer" id="rewardedTimer">5</div>
      <div class="rewarded-ad__ad-note">REWARDED AD STUB — REAL SDK GOES HERE</div>
    </div>
  `;
  let t = 5;
  const timer = setInterval(() => {
    t--;
    const el = document.getElementById('rewardedTimer');
    if (el) el.textContent = t;
    if (t <= 0) {
      clearInterval(timer);
      onComplete();
    }
  }, 1000);
}

// ============================================================
// SWAP MECHANIC
// ============================================================
function enterSwapMode() {
  if (state.swapsLeft <= 0) {
    toast('NO SWAPS LEFT');
    return;
  }
  if (Object.keys(state.roster).length === 0) {
    toast('NOTHING TO SWAP — PICK A PLAYER FIRST');
    return;
  }
  state.swapMode = true;
  document.body.classList.add('swap-mode');
  document.querySelectorAll('.slot--filled').forEach(el => {
    el.classList.add('slot--swappable');
    el.addEventListener('click', onSwapSlotClick);
  });
  $('swapBtn').textContent = 'CANCEL SWAP';
  $('swapBtn').onclick = exitSwapMode;
  const swapTop = document.getElementById('swapBtnTop');
  if (swapTop) {
    swapTop.textContent = 'CANCEL SWAP';
    swapTop.onclick = exitSwapMode;
  }
  // smooth scroll to pitch so user can see the swappable slots
  document.getElementById('pitch')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  toast('TAP A FILLED SLOT TO REMOVE THAT PLAYER');
}

function exitSwapMode() {
  state.swapMode = false;
  document.body.classList.remove('swap-mode');
  document.querySelectorAll('.slot--swappable').forEach(el => {
    el.classList.remove('slot--swappable');
    el.removeEventListener('click', onSwapSlotClick);
  });
  $('swapBtn').innerHTML = `<span>SWAP (<span class="swap-count-num">${state.swapsLeft}</span>)</span><span class="xi-btn__arrow">⇆</span>`;
  $('swapBtn').onclick = enterSwapMode;
  const swapTop = document.getElementById('swapBtnTop');
  if (swapTop) {
    swapTop.innerHTML = `<span>SWAP OUT (<span class="swap-count-num">${state.swapsLeft}</span> LEFT)</span><span class="xi-btn__arrow">⇆</span>`;
    swapTop.onclick = enterSwapMode;
  }
  updateResources();
}

function onSwapSlotClick(e) {
  const el = e.currentTarget;
  const slotIdx = el.dataset.slot;
  const p = state.roster[slotIdx];
  if (!p) return;
  // remove the player
  delete state.roster[slotIdx];
  if (state.mode === 'tactical') state.usedPlayers.delete(p.name);  // free the player to be re-drawable
  else state.usedNations.delete(p.code);
  // reset the slot visually
  el.classList.remove('slot--filled', 'slot--oop', 'slot--swappable');
  el.innerHTML = '<span class="slot__open">OPEN</span>';
  // burn the swap
  state.swapsLeft--;
  exitSwapMode();
  updateProgress();
  updateChemistryViz();
  toast(`${p.name.toUpperCase()} REMOVED — ${p.nation} UNLOCKED`);
}

// ============================================================
// RESOURCES UI (skips + swaps)
// ============================================================
function updateResources() {
  const unlimited = isUnlimitedSkipsMode();
  // skip pips — show all green-glowing when unlimited
  document.querySelectorAll('#skipPips .xi-res__pip').forEach((p, i) => {
    p.classList.toggle('on', unlimited || i < state.skipsLeft);
    p.classList.toggle('xi-res__pip--inf', unlimited);
  });
  const pc = $('passCount');
  if (pc) pc.textContent = unlimited ? '∞' : state.skipsLeft;
  $('passBtn').disabled = !unlimited && state.skipsLeft <= 0;

  // swap pips (now handles multiple)
  document.querySelectorAll('#swapPips .xi-res__pip').forEach((p, i) => {
    p.classList.toggle('on', i < state.swapsLeft);
  });
  const filledCount = Object.keys(state.roster).length;
  const swapDisabled = state.swapsLeft <= 0 || filledCount === 0 || state.isSpinning;
  $('swapBtn').disabled = swapDisabled;
  const swapTop = document.getElementById('swapBtnTop');
  if (swapTop) swapTop.disabled = swapDisabled;
  const pickSwap = document.getElementById('pickSwapBtn');
  if (pickSwap) pickSwap.disabled = swapDisabled;
  // sync all swap counter spans
  document.querySelectorAll('.swap-count-num').forEach(el => {
    el.textContent = String(Math.max(0, state.swapsLeft | 0));   // never blank/NaN
  });
}

// ============================================================
// SLOTS
// ============================================================
function highlightOpenSlots(playersOfCurrentNation) {
  // highlight every slot a player from this nation could fill
  const openRoles = new Set();
  (playersOfCurrentNation || []).forEach(p => {
    const fit = bestSlotForPlayer(p);
    if (fit) openRoles.add(fit.slotIdx);
  });
  document.querySelectorAll('.slot').forEach(el => {
    if (openRoles.has(el.dataset.slot)) {
      el.classList.add('slot--empty-target');
    }
  });
}
function clearSlotHighlights() {
  document.querySelectorAll('.slot--empty-target').forEach(el => el.classList.remove('slot--empty-target'));
}

function fillSlot(slotIdx) {
  const p = state.roster[slotIdx];
  const el = document.querySelector(`.slot[data-slot="${slotIdx}"]`);
  if (!el) return;
  el.classList.add('slot--filled');
  if (!p.naturalFit) el.classList.add('slot--oop');
  el.classList.remove('slot--empty-target');
  el.innerHTML = `
    <img class="slot__filled-flag" src="${flagURL(p.iso, 80)}" srcset="${flagURL2x(p.iso, 80)} 2x" alt="${p.nation}" />
    <span class="slot__filled-name"${nameFit(p.name)}>${shortName(p.name)}</span>
    <span class="slot__filled-rating">${maskRating(p.rating)}</span>
    <span class="slot__filled-chem" data-slot-chem="${slotIdx}"></span>
    ${(typeof liveChipFor === 'function') ? liveChipFor(p) : ''}
    ${formChipFor(p)}
  `;
  updateChemistryViz();
}

function shortName(name) {
  const cleaned = name.replace(/\s*\(peak\)\s*$/i, '').trim();
  const parts = cleaned.split(' ');
  if (parts.length === 1) return parts[0].toUpperCase();
  const SUFFIX = /^(jr\.?|junior|júnior|sr\.?|senior|ii|iii|iv)$/i;
  let idx = parts.length - 1;
  while (idx > 0 && SUFFIX.test(parts[idx])) idx--;
  const last = parts[idx].toUpperCase();
  // Don't chop mid-word ("DONNARUMM", "AUBAMEYAN") — surnames run to ~12 chars.
  // CSS auto-shrinks the card name so the full last name fits. Only genuinely
  // huge tokens (14+) get clipped, and with an ellipsis so it reads as cut.
  if (last.length > 14) return last.slice(0, 13) + '…';
  return last;
}
// Inline font-shrink for long surnames so they FIT a card instead of overflowing
// (em-relative → works on every card size). DONNARUMMA, AUBAMEYANG, LEWANDOWSKI…
function nameFit(name) {
  const n = shortName(name).length;
  if (n >= 13) return ' style="font-size:0.68em;letter-spacing:-0.02em;"';
  if (n >= 12) return ' style="font-size:0.72em;letter-spacing:-0.02em;"';
  if (n >= 11) return ' style="font-size:0.78em;letter-spacing:-0.01em;"';
  if (n >= 10) return ' style="font-size:0.84em;letter-spacing:-0.01em;"';
  return '';
}

// ============================================================
// CHEMISTRY — FIFA-style same-league links
// ============================================================
function chemistryForPlayer(slotIdx) {
  const p = state.roster[slotIdx];
  if (!p) return 0;
  let links = 0;
  for (const [otherIdx, other] of Object.entries(state.roster)) {
    if (otherIdx === slotIdx) continue;
    if (other.league === p.league && p.league !== 'OTH') links++;
  }
  return Math.min(3, links);
}

// How much would picking this candidate change total team chemistry?
// Used to show "+N CHEM" badges on the pick modal so players actually
// see which choice helps their lineup cohere. Pass `replaceSlotIdx`
// when previewing a swap so the outgoing player is properly removed
// before scoring.
function previewChemDelta(candidate, replaceSlotIdx = null) {
  const candidateLeague = clubToLeague(candidate.club);
  // Snapshot, apply hypothetical change, score, restore. Chemistry only
  // depends on roster membership + league, not on which slot — so we use
  // a sentinel slot key for the "preview" placement. try/finally guarantees
  // the snapshot is restored even if scoring throws — otherwise a leftover
  // __preview__ entry (no rating) would NaN-poison computeFinalOVR and the
  // share card.
  const saved = { ...state.roster };
  try {
    const before = teamChemistry();
    if (replaceSlotIdx !== null && replaceSlotIdx !== undefined) {
      delete state.roster[replaceSlotIdx];
    }
    state.roster['__preview__'] = { league: candidateLeague };
    const after = teamChemistry();
    return after - before;
  } catch (e) {
    // Never let a chem-preview failure blank the whole pick modal — degrade
    // to a neutral +0 badge instead.
    return 0;
  } finally {
    state.roster = saved;
  }
}

function teamChemistry() {
  let total = 0;
  for (const slotIdx of Object.keys(state.roster)) {
    total += chemistryForPlayer(slotIdx);
  }
  return total; // max = 11 * 3 = 33
}

function updateChemistryViz() {
  const hide = ratingsHidden();
  for (const slotIdx of Object.keys(state.roster)) {
    const el = document.querySelector(`[data-slot-chem="${slotIdx}"]`);
    if (!el) continue;
    if (hide) {
      // EXPERT mode — chem is info, keep the dots neutral (all off) until reveal
      el.innerHTML = `<span class="chem-dot"></span><span class="chem-dot"></span><span class="chem-dot"></span>`;
      continue;
    }
    const chem = chemistryForPlayer(slotIdx);
    el.innerHTML = `<span class="chem-dot ${chem >= 1 ? 'on' : ''}"></span><span class="chem-dot ${chem >= 2 ? 'on' : ''}"></span><span class="chem-dot ${chem >= 3 ? 'on' : ''}"></span>`;
  }
}

// ============================================================
// PROGRESS / RATINGS — applies -1 OOP penalty per out-of-position player
// ============================================================
// LIVE FORM — real World Cup match ratings (avg, ≥20-min games) + goals move a
// player's effective rating by a bounded delta (server-computed: +5 hot … −5 cold).
// Applies in ALL modes incl. Daily/H2H (user: real form should make players rise
// and fall in value everywhere) — the daily challenge stays the SAME 11 spins for
// everyone (form changes ratings, not which nations spin), so it's still fair: a
// live contest where picking the in-form player matters.
function liveFormDelta(p) {
  if (typeof liveStatFor !== 'function') return 0;
  const s = liveStatFor(p);
  return (s && typeof s.f === 'number') ? s.f : 0;
}
// cls picks the placement style: slot__form-chip (absolute, pitch cards)
// or roster__form (inline pill — rosters tab, pick/swap modal cards).
function formChipFor(p, cls = 'slot__form-chip') {
  const f = liveFormDelta(p);
  if (!f) return '';
  return `<span class="${cls} ${cls}--${f > 0 ? 'up' : 'down'}" title="Real World Cup form (match ratings + goals/assists)">${f > 0 ? '▲+' + f : '▼' + f}</span>`;
}
function effectiveRating(p) {
  // p.oop is the tiered penalty (0/1/2). Legacy entries without it fall back to
  // the old flat −1 for any non-natural placement.
  const oop = (typeof p.oop === 'number') ? p.oop : (p.naturalFit ? 0 : 1);
  return p.rating - oop + liveFormDelta(p);
}
// Total OOP penalty across the XI (sum of tiered penalties, not just a count).
function totalOOPPenalty() {
  return Object.values(state.roster).reduce((s, p) => {
    return s + ((typeof p.oop === 'number') ? p.oop : (p.naturalFit ? 0 : 1));
  }, 0);
}

// Squad base rating — the average of the 11 effective player ratings (caps ~99).
function computeBaseOVR() {
  const eff = Object.values(state.roster).map(effectiveRating);
  if (!eff.length) return null;
  return Math.round(eff.reduce((a, b) => a + b, 0) / eff.length);
}

// DISPLAY rating. Chemistry is a real, uncapped boost (≈ chem/3, max +11), so a
// well-linked squad can break 100 — e.g. 92 avg + 27 chem → 92 + 9 = 101.
function computeFinalOVR() {
  const base = computeBaseOVR();
  if (base == null) return null;
  return base + Math.round(teamChemistry() / 3);
}

function countOOP() {
  return Object.values(state.roster).filter(p => !p.naturalFit).length;
}

// ----- Sticky mobile SPIN bar -----
// Shows when the main SPIN button is scrolled off-screen during an active build,
// so you can spin again from your pitch without scrolling back up.
let _spinBtnOnScreen = true;
let _pitchInView = true;
let _sponsorEl = null;   // cached so the scroll path doesn't re-query the DOM
let _sponsorH = 0;       // cached docked height (re-measured on resize only)
function refreshStickySpin() {
  const sticky = $('stickySpin');
  if (!sticky) return;
  const view = $('stickySpinView');
  const showingSpin = !!(view && !view.hidden);   // the flash/result is on screen here
  const filled = Object.keys(state.roster).length;
  // Show only while you're actually on the pitch (spin button scrolled off, build
  // incomplete) — so it never floats over the leaderboard below. Stays pinned
  // mid-spin regardless, so scrolling doesn't hide the flags.
  const show = showingSpin || (!_spinBtnOnScreen && _pitchInView && filled < 11);
  sticky.hidden = !show;
  // The sponsor ticker is ALWAYS docked at the bottom — sit the spin bar flush
  // above it when it shows. Measure the height only once the bar is showing (by
  // then the marquee has populated and the height is correct), then cache it so
  // the scroll path never reads layout.
  if (!_sponsorEl) _sponsorEl = document.querySelector('.sponsor-ticker');
  if (show && _sponsorEl && !_sponsorH) {
    const h = Math.round(_sponsorEl.getBoundingClientRect().height);
    if (h >= 28) _sponsorH = h;   // ignore the pre-populated (label-only) height
  }
  sticky.style.bottom = `${_sponsorH || 44}px`;
  // Mirror the main button's label + disabled state
  $('stickyRound') && ($('stickyRound').textContent = filled);
  const inline = $('spinBtn'), sBtn = $('stickySpinBtn'), sLbl = $('stickySpinLabel');
  if (inline && sBtn) sBtn.disabled = inline.disabled;
  if (sLbl) sLbl.textContent = state.mode === 'tactical' ? 'SPIN POSITION' : 'SPIN THE WORLD';
}
// While spinning from the sticky bar, flash the ribbon there (flags in nation
// modes, POSITIONS in Tactical) then the landed result — so you see what you got
// without scrolling up to the wheel.
let _stickyInitiatedSpin = false;
let _stickyFlashTimer = null;
function setStickyView(iso, name) {
  const flag = $('stickySpinFlag'), nm = $('stickySpinName');
  if (flag) {
    if (iso) { flag.src = flagURL(iso, 80); flag.style.display = ''; }
    else { flag.style.display = 'none'; }   // Tactical positions have no flag
  }
  if (nm) nm.textContent = name || '';
}
// Items to flash for the current mode: {iso, name}. Tactical → open positions.
function stickyFlashItems() {
  if (state.mode === 'tactical') {
    return Object.keys(SLOT_DEF)
      .filter(i => !state.roster[i])
      .map(i => ({ iso: null, name: (POS_FULL[SLOT_DEF[i].role] || SLOT_DEF[i].role) }));
  }
  const pool = (typeof getNationPool === 'function') ? getNationPool(state.mode) : [];
  return pool.map(n => ({ iso: n.iso, name: n.name }));
}
let _stickyFlagPreload = [];
function startStickySpinFlash() {
  const view = $('stickySpinView'), sticky = $('stickySpin');
  if (!view || !sticky) return;
  const items = stickyFlashItems();
  if (!items.length) return;
  sticky.hidden = false;          // force the bar visible so the spin shows
  view.hidden = false;
  const tactical = state.mode === 'tactical';
  // Preload flags so we only ever show a FULLY-LOADED one (swapping src to an
  // unloaded flag blanks the <img> — that's the "flag hiding" flicker).
  _stickyFlagPreload = tactical ? [] : items.filter(it => it.iso).map(it => {
    const img = new Image(); img.src = flagURL(it.iso, 80);
    return { iso: it.iso, name: it.name, img };
  });
  const flash = () => {
    if (tactical) {
      const it = items[Math.floor(Math.random() * items.length)];
      setStickyView(null, it.name);
      return;
    }
    const loaded = _stickyFlagPreload.filter(c => c.img.complete && c.img.naturalWidth > 0);
    if (loaded.length) {
      const c = loaded[Math.floor(Math.random() * loaded.length)];
      setStickyView(c.iso, c.name);
    } else {
      // none cached yet — flash a name only (no blank flag)
      const it = items[Math.floor(Math.random() * items.length)];
      setStickyView(null, it.name);
    }
  };
  flash();
  if (_stickyFlashTimer) clearInterval(_stickyFlashTimer);
  _stickyFlashTimer = setInterval(flash, 90);
}
// Land on the result — pass a nation ({iso,name}) or a position ({iso:null,name}).
function landStickySpin(item) {
  if (_stickyFlashTimer) { clearInterval(_stickyFlashTimer); _stickyFlashTimer = null; }
  const view = $('stickySpinView');
  if (!view || view.hidden || !item) return;
  setStickyView(item.iso, item.name);
}
function resetStickySpin() {
  if (_stickyFlashTimer) { clearInterval(_stickyFlashTimer); _stickyFlashTimer = null; }
  const view = $('stickySpinView');
  if (view) view.hidden = true;
}
function initStickySpin() {
  const inline = $('spinBtn'), sBtn = $('stickySpinBtn');
  if (!inline || !sBtn) return;
  sBtn.addEventListener('click', () => { if (!sBtn.disabled) { _stickyInitiatedSpin = true; spin(); } });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      _spinBtnOnScreen = entries[0].isIntersecting;
      refreshStickySpin();
    }, { rootMargin: '-8px 0px -120px 0px' }).observe(inline);
    // Only show the bar while the pitch is on screen — hide it once you scroll
    // down to the leaderboard so it never covers it.
    const pitch = document.getElementById('pitch');
    if (pitch) {
      new IntersectionObserver((entries) => {
        _pitchInView = entries[0].isIntersecting;
        refreshStickySpin();
      }, { rootMargin: '0px 0px -40px 0px' }).observe(pitch);
    }
  }
  // Re-measure the cached sponsor height after a resize / orientation change.
  window.addEventListener('resize', () => { _sponsorH = 0; refreshStickySpin(); });
  refreshStickySpin();
}

function updateProgress() {
  const filled = Object.keys(state.roster).length;
  $('roundNum').textContent = filled;
  $('progressFill').style.width = `${(filled / 11) * 100}%`;
  refreshStickySpin();
  if (filled > 0 && ratingsHidden()) {
    // EXPERT mode — hide the running total; show how many are still blind-drafted
    $('overallRating').innerHTML = `<span style="letter-spacing:.06em;">?? <span style="color:var(--mute);font-size:.6em;">OVR</span> · <span style="color:var(--pitch);font-size:.55em;">BLIND DRAFT</span></span>`;
  } else if (filled > 0) {
    const final = computeFinalOVR();
    const chem = teamChemistry();
    const oop = countOOP();
    const oopPen = totalOOPPenalty();
    const oopNote = oop > 0 ? ` · <span style="color:var(--gold);font-size:.55em;">${oop} OOP −${oopPen}</span>` : '';
    $('overallRating').innerHTML = `${final} <span style="color:var(--mute);font-size:.6em;">OVR</span> · ${chem} <span style="color:var(--mute);font-size:.6em;">CHEM</span>${oopNote}`;
  } else {
    $('overallRating').innerHTML = `— <span style="color:var(--mute);font-size:.6em;">OVR</span>`;
  }
  $('shareBtn').disabled = filled < 11;
  updateBlindToggleLock();   // lock the expert toggle once the draft is underway
  if (typeof syncFormationPicker === 'function') syncFormationPicker();   // lock formation too
  updateResources();
}

// ============================================================
// COMPLETE
// ============================================================
// ============================================================
// GRADE + PROJECTED FINISH (firstdown.studio-style)
// ============================================================
function gradeFromOVR(ovr, chem) {
  const score = ovr + chem * 0.3;   // chem matters — max chem (33) = +9.9 grade swing
  if (score >= 95) return { letter: 'S',  color: 'var(--gold)',    blurb: 'Elite in every line. A squad built to win.' };
  if (score >= 91) return { letter: 'A+', color: 'var(--pitch)',   blurb: 'A genuine super-team. Bookmark this lineup.' };
  if (score >= 88) return { letter: 'A',  color: 'var(--pitch)',   blurb: 'Elite talent in every line.' };
  if (score >= 85) return { letter: 'B+', color: '#7ed957',        blurb: 'Top-tier squad. A dangerous outfit.' };
  if (score >= 82) return { letter: 'B',  color: '#7ed957',        blurb: 'Solid mid-table magic. Inspired in places.' };
  if (score >= 78) return { letter: 'C+', color: 'var(--gold)',    blurb: 'Mixed bag with flashes of quality.' };
  if (score >= 74) return { letter: 'C',  color: 'var(--gold)',    blurb: 'A cult classic. The neutrals\' team.' };
  return            { letter: 'D',  color: 'var(--crimson)', blurb: 'Hard to defend. Bring snacks.' };
}

// ============================================================
// CONFETTI — pure canvas, fires when team wins the World Cup
// ============================================================
function fireConfetti(durationMs = 6000) {
  const existing = document.getElementById('confettiCanvas');
  if (existing) existing.remove();
  const canvas = document.createElement('canvas');
  canvas.id = 'confettiCanvas';
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:9999;';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const resize = () => {
    canvas.width = window.innerWidth * devicePixelRatio;
    canvas.height = window.innerHeight * devicePixelRatio;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  };
  resize();
  const onResize = () => resize();
  window.addEventListener('resize', onResize);

  const colors = ['#00ff85', '#ffce00', '#ff2e4d', '#4d8aff', '#ffffff', '#ff8800'];
  const W = window.innerWidth;
  const H = window.innerHeight;
  const particles = [];

  // Multiple burst points across the top for a fuller spread
  const burstPoints = [W * 0.2, W * 0.5, W * 0.8];

  function spawnBurst(originX, originY, count) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.random() - 0.5) * Math.PI * 0.8 - Math.PI / 2;
      const speed = 6 + Math.random() * 10;
      particles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 12,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 8 + Math.random() * 6,
        shape: Math.random() < 0.6 ? 'rect' : 'circle',
        life: 1,
      });
    }
  }

  // Initial bursts
  burstPoints.forEach(x => spawnBurst(x, H * 0.2, 80));
  // Second wave after a beat
  setTimeout(() => burstPoints.forEach(x => spawnBurst(x, H * 0.2, 60)), 400);
  setTimeout(() => burstPoints.forEach(x => spawnBurst(x, H * 0.2, 60)), 900);

  const startTime = performance.now();
  function animate(now) {
    const elapsed = now - startTime;
    ctx.clearRect(0, 0, W, H);
    let alive = 0;
    particles.forEach(p => {
      if (p.y > H + 50) return;
      alive++;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.25;          // gravity
      p.vx *= 0.99;          // air resistance
      p.rotation += p.rotationSpeed;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      if (p.shape === 'rect') {
        ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.55);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
    if (alive === 0 && elapsed > durationMs) {
      window.removeEventListener('resize', onResize);
      canvas.remove();
      return;
    }
    requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
}

// ============================================================
// BRACKET SIMULATION — each tier has an opponent + a result
// score gap between your XI and the opp determines the margin
// ============================================================
// Winning the cup REQUIRES chemistry, not just rating. Max score with 95 OVR
// and 0 chem = 95 (only reaches QF). To hit CHAMPIONS (108+) you need either
// elite chemistry OR top-end OVR with decent chem. Three viable paths:
//   - 95 OVR + 27 chem = 108.5  (elite + balanced)
//   - 92 OVR + 33 chem = 108.5  (pure chemistry)
//   - 98 OVR + 20 chem = 108.0  (peak talent + decent chem)
const BRACKET = [
  { tier:'CHAMPIONS',    label:'🏆 WORLD CUP WINNER',      threshold:108, opp:'BRAZIL',      oppRating:90, result:'WIN',  stage:'WON FINAL' },
  { tier:'RUNNERS_UP',   label:'🥈 RUNNERS-UP',            threshold:103, opp:'FRANCE',      oppRating:93, result:'LOSS', stage:'LOST FINAL' },
  { tier:'THIRD',        label:'🥉 THIRD PLACE',            threshold:99,  opp:'NETHERLANDS', oppRating:87, result:'WIN',  stage:'WON 3RD-PLACE' },
  { tier:'FOURTH',       label:'4TH PLACE',                 threshold:95,  opp:'GERMANY',     oppRating:87, result:'LOSS', stage:'LOST 3RD-PLACE' },
  { tier:'QUARTERFINAL', label:'QUARTERFINAL',              threshold:90,  opp:'SPAIN',       oppRating:91, result:'LOSS', stage:'LOST QF' },
  { tier:'R16',          label:'ROUND OF 16',               threshold:84,  opp:'PORTUGAL',    oppRating:88, result:'LOSS', stage:'LOST R16' },
  { tier:'R32',          label:'ROUND OF 32',               threshold:78,  opp:'ENGLAND',     oppRating:89, result:'LOSS', stage:'LOST R32' },
  { tier:'GROUP_OUT',    label:'GROUP STAGE EXIT',          threshold:0,   opp:null,          oppRating:0,  result:null,   stage:'GROUP STAGE OUT' },
];

// ============================================================
// INJURY SYSTEM — random injuries during the tournament
// ============================================================
const INJURY_TYPES = [
  { name:'HAMSTRING',     out:'GROUP STAGE',    ovrLoss:1 },
  { name:'KNOCK',         out:'ONE MATCH',      ovrLoss:1 },
  { name:'CALF STRAIN',   out:'R16',            ovrLoss:2 },
  { name:'ANKLE SPRAIN',  out:'QF',             ovrLoss:2 },
  { name:'CONCUSSION',    out:'KNOCKOUTS',      ovrLoss:2 },
  { name:'KNEE LIGAMENT', out:'TOURNAMENT',     ovrLoss:3 },
  { name:'ACL',           out:'TOURNAMENT',     ovrLoss:3 },
  { name:'MUSCLE TEAR',   out:'TOURNAMENT',     ovrLoss:3 },
];

function rollInjuries(roster) {
  const players = Object.entries(roster);
  if (!players.length) return [];

  // LIVE override: during the tournament, use real confirmed injuries instead of random rolls
  if (isTournamentLive() && window.LIVE_STATS.injuries.length) {
    const realInj = window.LIVE_STATS.injuries;
    const injured = [];
    Object.entries(roster).forEach(([slotIdx, p]) => {
      const hit = realInj.find(i => i.name === p.name);
      if (hit) injured.push({ slotIdx, player: p, name: hit.reason, out: hit.out, severity: 'CONFIRMED' });
    });
    return injured.slice(0, 3);
  }

  // Simulated (default): roughly 0-3 injuries per tournament — try each player at 10% base
  const injured = [];
  players.forEach(([slotIdx, p]) => {
    if (Math.random() < 0.11) {
      const injury = INJURY_TYPES[Math.floor(Math.random() * INJURY_TYPES.length)];
      injured.push({
        slotIdx,
        player: p,
        ...injury,
      });
    }
  });
  // Cap at 3 to keep things playable
  return injured.slice(0, 3);
}

// ============================================================
// LIVE TOURNAMENT STATS — read from window.LIVE_STATS (live-stats.js)
// ============================================================
function isTournamentLive() {
  return window.LIVE_STATS && window.LIVE_STATS.status && window.LIVE_STATS.status !== 'PRE';
}
function liveStatsForPlayer(name) {
  if (!window.LIVE_STATS || !window.LIVE_STATS.players) return null;
  return window.LIVE_STATS.players[name] || null;
}
function liveStatsBadge(name) {
  const s = liveStatsForPlayer(name);
  if (!s) return '';
  const bits = [];
  if (s.G)  bits.push(`<span class="player__livestat">⚽ ${s.G}</span>`);
  if (s.A)  bits.push(`<span class="player__livestat">🎯 ${s.A}</span>`);
  if (s.redCards) bits.push(`<span class="player__livestat player__livestat--red">🟥</span>`);
  if (!bits.length) return '';
  return `<div class="player__livestrip">${bits.join('')}</div>`;
}
// ============================================================
// YOUR XI TODAY — your last built XI comes alive on matchday: who plays today,
// their real goals/assists, and a celebration the moment one scores for real.
// Reuses the live pipeline (matches cache + liveStatFor). Tab-open only (no push).
// ============================================================
function saveLastXI() {
  try {
    const ids = Object.keys(state.roster);
    if (ids.length !== 11) return;
    const players = ids.map(k => {
      const p = state.roster[k];
      return { name: p.name, code: p.code, iso: p.iso, nation: p.nation };
    });
    // Default captain = your highest-rated player; preserve a manual pick if the
    // very same 11 are being re-saved (re-opening the complete modal shouldn't
    // reset the armband).
    let cap = null, best = -1;
    for (const k of ids) {
      const p = state.roster[k];
      const r = (typeof effectiveRating === 'function' ? effectiveRating(p) : p.rating) || p.rating || 0;
      if (r > best) { best = r; cap = p.code + '|' + p.name; }
    }
    const sig = players.map(p => p.code + '|' + p.name).sort().join(',');
    const prev = loadLastXI();
    const prevSig = prev ? prev.players.map(p => p.code + '|' + p.name).sort().join(',') : null;
    const captain = (prev && prevSig === sig && prev.captain) ? prev.captain : cap;
    localStorage.setItem('pe_last_xi', JSON.stringify({ at: Date.now(), players, captain }));
  } catch (e) {}
}
function loadLastXI() {
  try { const x = JSON.parse(localStorage.getItem('pe_last_xi') || 'null'); return (x && x.players && x.players.length === 11) ? x : null; }
  catch (e) { return null; }
}
function getCaptain() { const xi = loadLastXI(); return xi ? (xi.captain || null) : null; }
function setCaptain(key) {
  const xi = loadLastXI();
  if (!xi || !xi.players.some(p => p.code + '|' + p.name === key)) return;
  xi.captain = key;
  try { localStorage.setItem('pe_last_xi', JSON.stringify(xi)); } catch (e) {}
  renderCaptainPicker();
  if (typeof renderXITodayPanel === 'function') { try { renderXITodayPanel(); } catch (e) {} }
}
// Captain picker on the complete screen — your bet on who'll deliver in real life.
function renderCaptainPicker() {
  const el = document.getElementById('xiCaptain');
  if (!el) return;
  const xi = loadLastXI();
  if (!xi || !isTournamentLive()) { el.hidden = true; return; }   // only meaningful once the WC is live
  const cap = xi.captain;
  const opts = xi.players.map(p => {
    const k = p.code + '|' + p.name;
    return `<option value="${k}"${k === cap ? ' selected' : ''}>${p.name} · ${p.nation}</option>`;
  }).join('');
  el.hidden = false;
  el.innerHTML = `
    <div class="xi-captain__label">🅒 CAPTAIN <span class="xi-captain__hint">— their real World Cup goals &amp; assists count DOUBLE on your live tally</span></div>
    <select class="xi-captain__select" id="xiCaptainSelect" aria-label="Pick your captain">${opts}</select>`;
  const sel = document.getElementById('xiCaptainSelect');
  if (sel) sel.onchange = () => setCaptain(sel.value);
}
// Codes whose nation has a match TODAY (ET) or is live right now.
function _xiTodayCodes() {
  const set = new Set();
  const etDay = (typeof _etDayStr === 'function') ? _etDayStr : (ms) => new Date(ms).toISOString().slice(0, 10);
  const today = etDay(Date.now());
  for (const m of (window._liveMatchesCache || [])) {
    const isToday = m.status === 'in_progress'
      || (m.dt && !isNaN(Date.parse(m.dt)) && etDay(Date.parse(m.dt)) === today);
    if (!isToday) continue;
    if (m.home && m.home.code) set.add(m.home.code);
    if (m.away && m.away.code) set.add(m.away.code);
  }
  return set;
}
function xiPlayersToday() {
  const xi = loadLastXI();
  if (!xi) return [];
  const codes = _xiTodayCodes();
  return xi.players.filter(p => codes.has(p.code)).map(p => {
    const s = (typeof liveStatFor === 'function') ? liveStatFor({ code: p.code, name: p.name }) : null;
    return Object.assign({}, p, { g: (s && s.g) || 0, a: (s && s.a) || 0 });
  });
}
// ---- SURVIVOR — your XI's nations live or die with the real bracket ----
// "Alive" = the nation still has a scheduled or in-progress match (i.e. it's
// still in the tournament). This is the SAFE direction: a team with a future
// fixture is unambiguously still in it, so we never falsely eliminate anyone.
const _STAGE_RANK = {
  'Group Stage': 0, 'Round of 32': 1, 'Round of 16': 2,
  'Quarter-finals': 3, 'Quarter-final': 3, 'Semi-finals': 4, 'Semi-final': 4,
  'Third place play-off': 4, 'Final': 5,
};
const _STAGE_SHORT = ['GROUP', 'R32', 'R16', 'QF', 'SF', 'FINAL'];
function nationStatusMap() {
  const map = {};
  const etDay = (typeof _etDayStr === 'function') ? _etDayStr : (ms) => new Date(ms).toISOString().slice(0, 10);
  const today = etDay(Date.now());
  const touch = (c) => (map[c] || (map[c] = { alive: false, today: false, live: false, played: false, stage: -1 }));
  for (const m of (window._liveMatchesCache || [])) {
    const rank = _STAGE_RANK[m.stage] != null ? _STAGE_RANK[m.stage] : -1;
    for (const side of [m.home, m.away]) {
      if (!side || !side.code) continue;
      const s = touch(side.code);
      if (rank > s.stage) s.stage = rank;
      if (m.status === 'in_progress') { s.alive = true; s.live = true; s.today = true; }
      else if (m.status === 'completed') { s.played = true; }
      else {                                              // scheduled = a future game = still in it
        s.alive = true;
        const t = m.dt ? Date.parse(m.dt) : NaN;
        if (!isNaN(t) && etDay(t) === today) s.today = true;
      }
    }
  }
  return map;
}
function xiSurvivalSummary() {
  const xi = loadLastXI();
  if (!xi) return null;
  const map = nationStatusMap();
  let alive = 0, deepest = -1;
  const outCodes = [];
  for (const p of xi.players) {
    const s = map[p.code];
    const isAlive = s ? s.alive : true;                   // unknown nation → assume alive (safe)
    if (isAlive) { alive++; if (s && s.stage > deepest) deepest = s.stage; }
    else if (s && s.played) outCodes.push(p.code);
  }
  return { alive, total: xi.players.length, deepest, outCodes };
}

function renderXITodayPanel() {
  const el = document.getElementById('xiTodayPanel');
  if (!el) return;
  if (!isTournamentLive() || !loadLastXI()) { el.hidden = true; return; }
  const surv = xiSurvivalSummary();
  const stageTxt = (surv && surv.deepest > 0) ? ` · DEEPEST ${_STAGE_SHORT[surv.deepest]}` : '';
  const survHit = surv && surv.alive < surv.total ? ' xitoday__survive--hit' : '';
  const survLine = surv
    ? `<div class="xitoday__survive${survHit}">🛡️ <b>${surv.alive}/${surv.total}</b> STILL ALIVE${stageTxt}</div>`
    : '';

  const players = xiPlayersToday();
  if (!players.length) {                                  // off-day: slim survival-only tracker
    el.hidden = false;
    el.innerHTML = `<div class="xitoday__head"><span class="xitoday__label">⚡ YOUR XI</span></div>${survLine}`;
    return;
  }
  const anyLive = (window._liveMatchesCache || []).some(m => m.status === 'in_progress');
  const cap = getCaptain();   // captain's real goals + assists count DOUBLE on the tally
  const wt = (p) => ((p.code + '|' + p.name) === cap ? 2 : 1);
  const totG = players.reduce((s, p) => s + p.g * wt(p), 0);
  const totA = players.reduce((s, p) => s + p.a * wt(p), 0);
  const chips = players.map(p => {
    const isCap = (p.code + '|' + p.name) === cap;
    const stat = (p.g || p.a)
      ? ` <b class="xitoday__stat">${p.g ? '⚽' + p.g : ''}${p.a ? ' 🅰️' + p.a : ''}${isCap ? ' ×2' : ''}</b>` : '';
    return `<span class="xitoday__chip${p.g ? ' xitoday__chip--scored' : ''}${isCap ? ' xitoday__chip--cap' : ''}">`
      + `${isCap ? '<b class="xitoday__armband">🅒</b>' : ''}<img src="${flagURL(p.iso, 40)}" alt="${p.nation}" />${shortName(p.name)}${stat}</span>`;
  }).join('');
  el.hidden = false;
  el.innerHTML = `
    <div class="xitoday__head">
      <span class="xitoday__label">${anyLive ? '🔴 YOUR XI — LIVE NOW' : '⚡ YOUR XI TODAY'}</span>
      <span class="xitoday__tally">${players.length} PLAYING${(totG || totA) ? ` · ⚽${totG} 🅰️${totA}` : ''}</span>
    </div>
    <div class="xitoday__track">${chips}</div>
    ${survLine}`;
}
// 💀 Toast the moment one of your XI's nations gets knocked out of the real
// tournament. Baselines on a new/changed XI; persists so it fires once per exit.
function checkXIElimination() {
  const xi = loadLastXI();
  if (!xi) return;
  const map = nationStatusMap();
  const sig = xi.players.map(p => p.code + '|' + p.name).join(',');
  const curOut = [...new Set(xi.players.filter(p => { const s = map[p.code]; return s && s.played && !s.alive; }).map(p => p.code))];
  let rec; try { rec = JSON.parse(localStorage.getItem('pe_xi_survive') || 'null'); } catch (e) { rec = null; }
  if (!rec || rec.sig !== sig) { try { localStorage.setItem('pe_xi_survive', JSON.stringify({ sig, out: curOut })); } catch (e) {} return; }
  for (const code of curOut.filter(c => !rec.out.includes(c))) {
    const n = NATIONS.find(x => x.code === code);
    const cnt = xi.players.filter(p => p.code === code).length;
    xiGoalToast(`💀 ${(n ? n.name : code).toUpperCase()} ARE OUT — ${cnt} OF YOUR XI ELIMINATED`, 'out');
  }
  try { localStorage.setItem('pe_xi_survive', JSON.stringify({ sig, out: curOut })); } catch (e) {}
}
// Toast the moment a drafted player's REAL goal count ticks up. Baselines on a
// new XI (no alert flood) and persists last-seen so a reload mid-match is quiet.
function checkXIGoalAlerts() {
  const xi = loadLastXI();
  if (!xi || typeof liveStatFor !== 'function') return;
  const sig = xi.players.map(p => p.code + '|' + p.name).join(',');
  let rec; try { rec = JSON.parse(localStorage.getItem('pe_xi_goalseen') || 'null'); } catch (e) { rec = null; }
  const cur = {};
  for (const p of xi.players) { const s = liveStatFor({ code: p.code, name: p.name }); cur[p.code + '|' + p.name] = (s && s.g) || 0; }
  if (!rec || rec.sig !== sig) {                       // new/changed XI → baseline silently
    try { localStorage.setItem('pe_xi_goalseen', JSON.stringify({ sig, seen: cur })); } catch (e) {}
    return;
  }
  for (const p of xi.players) {
    const k = p.code + '|' + p.name;
    if ((cur[k] || 0) > (rec.seen[k] || 0)) {
      if (k === xi.captain) xiGoalToast(`🅒🔥 CAPTAIN ${shortName(p.name)} SCORED — COUNTS DOUBLE!`, 'cap');
      else xiGoalToast(`⚽ ${shortName(p.name)} JUST SCORED FOR YOUR XI!`);
    }
  }
  try { localStorage.setItem('pe_xi_goalseen', JSON.stringify({ sig, seen: cur })); } catch (e) {}
}
function xiGoalToast(msg, kind = 'goal') {
  const t = document.createElement('div');
  t.className = `toast toast--${kind}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), kind === 'out' ? 5200 : 4200);
}

function initLiveBadge() {
  if (!isTournamentLive()) return;
  const target = document.querySelector('.topbar__inner') || document.querySelector('.topbar');
  if (!target) return;
  const phase = window.LIVE_STATS.status; // GROUP, RO32, RO16, QF, SF, FINAL, COMPLETE
  const badge = document.createElement('span');
  badge.className = 'topbar__livebadge';
  badge.textContent = `LIVE · ${phase}`;
  target.appendChild(badge);
}
function predictMatchScore(yourRating, oppRating, result) {
  const diff = yourRating - oppRating;
  if (result === 'WIN') {
    if (diff > 5)  return '3-0';
    if (diff > 2)  return '2-0';
    if (diff > -1) return '2-1';
    return '1-0';                    // gritty upset
  }
  if (result === 'LOSS') {
    if (diff < -5) return '0-3';
    if (diff < -2) return '0-2';
    if (diff < 1)  return '1-2';
    return '0-1';                    // tight loss
  }
  return null;
}

function projectedFinish(ovr, chem, injuryLoss = 0) {
  const effOvr = ovr - injuryLoss;
  const score = effOvr + chem * 0.5;   // chem is a real lever — max chem (33) = +16.5
  for (const tier of BRACKET) {
    if (score >= tier.threshold) {
      if (!tier.opp) {
        return { tier: tier.tier, label: tier.label, stage: tier.stage, line: tier.label, won: false };
      }
      const matchScore = predictMatchScore(effOvr, tier.oppRating, tier.result);
      return {
        tier: tier.tier,
        label: tier.label,
        line: `${tier.stage} ${matchScore} vs ${tier.opp}`,
        result: tier.result,
        opp: tier.opp,
        scoreLine: matchScore,
      };
    }
  }
  return { tier: 'NONE', label: 'NO RESULT', line: '—' };
}

// ============================================================
// TOURNAMENT AWARDS — pool = entire WC, Captain = your XI
// each comes with a plausible stat (goals/assists/clean sheets)
// ============================================================
function buildFullTournamentPool() {
  // Use the CURRENT mode's pool — LEGENDS mode should award Pelé/Cruyff,
  // not Mbappé/Kane. Top 50 includes missed nations (Italy/Nigeria/etc).
  const pool = (typeof getNationPool === 'function')
    ? getNationPool(state.mode)
    : NATIONS;
  const all = [];
  pool.forEach(n => n.players.forEach(p => {
    all.push({ ...p, nation: n.name, flag: n.flag, iso: n.iso, code: n.code });
  }));
  return all;
}

// Plausible tournament stat for an award type, scaled by rating
// Canonical per-player tournament stats. Same player → same numbers across
// every award card they appear in. Deterministic seed from name for variety.
// Tuned to real WC tournament ranges: top scorers 5-8 G, top assisters 3-6 A.
function playerCanonicalStats(p) {
  if (!p) return null;
  const r = p.rating;
  // Deterministic per-player offset (0–6).
  const seed = (p.name || '').split('').reduce((s, c) => (s + c.charCodeAt(0)) % 7, 0);
  // Tier-based baseline (modest — role bias does the heavy lifting)
  let baseG, baseA, baseCS, baseSv, baseT;
  if (r >= 96)      { baseG = 4; baseA = 3; baseCS = 5; baseSv = 26; baseT = 28; }
  else if (r >= 93) { baseG = 3; baseA = 3; baseCS = 4; baseSv = 23; baseT = 26; }
  else if (r >= 90) { baseG = 2; baseA = 2; baseCS = 3; baseSv = 21; baseT = 24; }
  else if (r >= 87) { baseG = 2; baseA = 2; baseCS = 2; baseSv = 19; baseT = 22; }
  else              { baseG = 1; baseA = 1; baseCS = 1; baseSv = 17; baseT = 20; }
  // Role-specific weighting — keeps numbers realistic per position
  const isGK   = p.role === 'GK';
  const isFwd  = ['ST','LW','RW'].includes(p.role);
  const isMid  = ['CAM','CM','CDM','LCM','RCM'].includes(p.role);
  const isDef  = ['CB','LB','RB','LCB','RCB'].includes(p.role);
  const goalsBias  = isGK ? -10 : isFwd ? 3 : isMid ? 0 : isDef ? -2 : 0;
  const assistsBias = isGK ? -10 : isMid ? 1 : isFwd ? 0 : isDef ? -1 : 0;
  const seedG = seed % 2;        // 0 or 1
  const seedA = (seed * 2) % 2;  // 0 or 1
  return {
    G:  Math.max(0, baseG + seedG + goalsBias),
    A:  Math.max(0, baseA + seedA + assistsBias),
    CS: baseCS + (seed % 2),
    Sv: baseSv + (seed % 4),
    T:  baseT + ((seed * 3) % 5),
  };
}

function statFor(awardType, p) {
  if (!p) return '';
  const s = p._stat || playerCanonicalStats(p);   // _stat = display-consistent (capped) stats
  switch (awardType) {
    case 'goldenBoot':  return `${s.G} GOALS`;
    case 'topAssister': return `${s.A} ASSISTS`;
    case 'goldenGlove': return `${s.CS} CLEAN SHEETS · ${s.Sv} SAVES`;
    case 'goldenBall':  return `${s.G} G · ${s.A} A`;
    case 'captain':     return `${p.rating} OVR · ARMBAND`;
    case 'youngPlayer': return `${s.G} G · ${s.A} A`;
    case 'bestDefender':return `${s.CS} CLEAN SHEETS · ${s.T} TACKLES`;
    case 'bestMid':     return `${s.G} G · ${s.A} A`;
    default: return `${p.rating} OVR`;
  }
}

function computeAwards() {
  const all = buildFullTournamentPool();
  if (!all.length) return null;

  // AWARD_BIAS — Golden Boot tier:
  //   Mbappe > Kane > Haaland = Yamal > Messi = Ronaldo > Salah/others
  const AWARD_BIAS = {
    'Kylian Mbappé':     3,   // base 97 → 100 (tier 1)
    'Harry Kane':        5,   // base 94 → 99 (tier 2)
    'Erling Haaland':    1,   // base 96 → 97 (tier 3)
    'Lamine Yamal':     -1,   // base 98 → 97 (tier 3)
    'Lionel Messi':      5,   // base 91 → 96 (tier 4)
    'Cristiano Ronaldo': 4,   // base 92 → 96 (tier 4) — tied with Messi
    'Mohamed Salah':     0,
    'Vinícius Júnior':  -1,
    'Jude Bellingham':   2,
  };

  // TOP_ASSISTER_BIAS — specifically for assister award:
  //   Yamal > Dembele > Rashford > Saka > Doue, with Olise + Vinicius as contenders
  const TOP_ASSISTER_BIAS = {
    'Lamine Yamal':      4,   // base 98 → 102 (#1)
    'Ousmane Dembélé':   7,   // base 93 → 100 (#2)
    'Marcus Rashford':  15,   // base 84 → 99 (#3)
    'Bukayo Saka':       5,   // base 93 → 98 (#4)
    'Désiré Doué':       8,   // base 89 → 97 (#5)
    'Michael Olise':     5,   // base 91 → 96 (contender tier)
    'Vinícius Júnior':   1,   // base 95 → 96 (contender tier)
    // Pull striker-types out of the assister race
    'Kylian Mbappé':    -4,
    'Harry Kane':       -6,
    'Cristiano Ronaldo':-5,
    'Erling Haaland':   -4,
    // Modest dampers so the top 5 stay on top
    'Jude Bellingham':  -2,
    'Bruno Fernandes':  -2,
    'Mohamed Salah':    -3,
    'Jamal Musiala':    -2,
  };

  // Bias-aware weighted top-N. Pass a bias map to override the default AWARD_BIAS.
  const weightedTopPick = (arr, topN = 8, bias = AWARD_BIAS) => {
    if (!arr.length) return null;
    const eff = p => p.rating + (bias[p.name] || 0);
    const sorted = arr.slice().sort((a, b) => eff(b) - eff(a));
    const top = sorted.slice(0, Math.min(topN, sorted.length));
    const floor = eff(top[top.length - 1]) - 1;
    const weights = top.map(p => Math.pow(eff(p) - floor, 1.8));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < top.length; i++) {
      r -= weights[i];
      if (r <= 0) return top[i];
    }
    return top[0];
  };

  // Modern-era biases don't apply in LEGENDS mode — ratings are already a
  // curated all-time tier. Disable bias so Pelé/Maradona/etc. win on rating alone.
  const isLegendsMode = state.mode === 'legends';
  const generalBias  = isLegendsMode ? {} : AWARD_BIAS;
  const assisterBias = isLegendsMode ? {} : TOP_ASSISTER_BIAS;

  // Track winners to prevent the same player from sweeping multiple awards.
  const taken = new Set();
  const exclude = (arr) => arr.filter(p => !taken.has(p.name));
  const claim = (player) => { if (player?.name) taken.add(player.name); return player; };

  // Helper: pick the top player by a canonical stat (G/A/CS) with weighted-random
  // tiebreak among players sharing the top stat. Guarantees Boot winner actually
  // has more goals than anyone else — same for Top Assister + Golden Glove.
  const pickTopByStat = (pool, statKey, bias) => {
    if (!pool.length) return null;
    const stats = pool.map(p => ({ player: p, stat: playerCanonicalStats(p)[statKey], eff: p.rating + (bias[p.name] || 0) }));
    const topStat = Math.max(...stats.map(s => s.stat));
    const tied = stats.filter(s => s.stat === topStat);
    if (tied.length === 1) return tied[0].player;
    // Weighted random among ties (higher effRating → more likely)
    const floor = Math.min(...tied.map(t => t.eff)) - 1;
    const weights = tied.map(t => Math.pow(t.eff - floor, 1.8));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < tied.length; i++) {
      r -= weights[i];
      if (r <= 0) return tied[i].player;
    }
    return tied[0].player;
  };

  // === GOLDEN BOOT FIRST — top scorer by goals, NOT by rating ===
  // (Real World Cup logic — guarantees Boot winner has the most goals)
  const attackers = all.filter(p => ['ST','LW','RW'].includes(p.role));
  const goldenBoot = attackers.length ? claim(pickTopByStat(attackers, 'G', generalBias)) : null;

  // === TOP ASSISTER — most assists, excluding Boot winner ===
  const playmakers = exclude(all.filter(p => ['CAM','CM','LW','RW'].includes(p.role)));
  const topAssister = playmakers.length ? claim(pickTopByStat(playmakers, 'A', assisterBias)) : null;

  // === GOLDEN GLOVE — most clean sheets among keepers ===
  const keepers = exclude(all.filter(p => p.role === 'GK'));
  const goldenGlove = keepers.length ? claim(pickTopByStat(keepers, 'CS', generalBias)) : null;

  // === GOLDEN BALL — best overall player, weighted by rating, EXCLUDES Boot ===
  // (So Ball winner naturally has fewer goals than Boot winner. Real WC pattern:
  //  Messi '22 Ball [7 G] · Mbappé '22 Boot [8 G], Forlán '10 Ball · Müller '10 Boot, etc.)
  const goldenBall = claim(weightedTopPick(exclude(all), 10, generalBias));

  // Best YOUNG PLAYER must actually be young — U-23 at the 2026 WC (born 2003+),
  // not the old U25 pool that by now includes 25-27 yo stars (Mbappé/Haaland/Saka).
  const youngs = exclude(all.filter(p => typeof U23_PLAYERS !== 'undefined' && U23_PLAYERS.has(p.name)));
  const youngPlayer = youngs.length ? claim(weightedTopPick(youngs, 8, generalBias)) : null;

  const defenders = exclude(all.filter(p => ['CB','LB','RB'].includes(p.role)));
  const bestDefender = defenders.length ? claim(weightedTopPick(defenders, 8, generalBias)) : null;

  const mids = exclude(all.filter(p => ['CDM','CM','CAM'].includes(p.role)));
  const bestMid = mids.length ? claim(weightedTopPick(mids, 8, generalBias)) : null;

  // CAPTAIN — from the user's XI (highest outfield rating). Deterministic, not weighted.
  const userPlayers = Object.values(state.roster);
  const outfield = userPlayers.filter(p => p.role !== 'GK');
  const captain = outfield.length
    ? outfield.reduce((m, p) => p.rating > m.rating ? p : m)
    : userPlayers[0];

  const awards = { goldenBall, captain, goldenBoot, topAssister, goldenGlove, youngPlayer, bestDefender, bestMid };

  // Display consistency: the headline stat winners must be the UNIQUE leaders on
  // the cards shown — no other award card may tie or beat the Boot's goals, the
  // Assister's assists, or the Glove's clean sheets. (Each card otherwise renders
  // its own canonical stat, so e.g. two mids could both show 4 assists.)
  const capTo = (statKey, leaderKey) => {
    const leader = awards[leaderKey];
    const lead = leader ? playerCanonicalStats(leader)[statKey] : Infinity;
    Object.entries(awards).forEach(([k, p]) => {
      if (!p || k === leaderKey) return;
      const s = p._stat || { ...playerCanonicalStats(p) };
      if (s[statKey] >= lead) s[statKey] = Math.max(0, lead - 1);
      p._stat = s;
    });
  };
  capTo('G',  'goldenBoot');     // Boot has the most goals
  capTo('A',  'topAssister');    // Assister has the most assists
  capTo('CS', 'goldenGlove');    // Glove has the most clean sheets

  // PURE SIMULATION, deliberately: these awards are the story of YOUR simulated
  // tournament ("you won the World Cup"), so they must not be overridden by
  // real-world data — on day 1 that produced "champions… and the Golden Boot has
  // 1 goal". The REAL tournament leaders get their own clearly-labeled strip
  // (buildRealLeadersStrip) rendered alongside. applyLiveAwards is retired.
  return awards;
}

function awardCardHTML(emoji, label, awardKey, player) {
  if (!player) return '';
  // TBD card — when tournament has started but no data yet for this award
  if (player.__tbd) {
    return `
      <div class="xi-award xi-award--tbd">
        <span class="xi-award__icon">${emoji}</span>
        <div class="xi-award__body">
          <span class="xi-award__label">${label}</span>
          <span class="xi-award__player">TBD</span>
          <span class="xi-award__stat">${player.tbdLabel || 'AWAITING DATA'}</span>
          <span class="xi-award__meta">UPDATES WHEN MATCHES HAPPEN</span>
        </div>
      </div>
    `;
  }
  const stat = statFor(awardKey, player);
  // Is this award winner in the user's XI?
  const userNames = new Set(Object.values(state.roster).map(p => p.name));
  const inXI = userNames.has(player.name);
  const xiClass = inXI ? 'xi-award--in-xi' : '';
  const xiBadge = inXI ? `<span class="xi-award__xi-badge">★ IN YOUR XI</span>` : '';
  return `
    <div class="xi-award ${xiClass}">
      <span class="xi-award__icon">${emoji}</span>
      <div class="xi-award__body">
        <span class="xi-award__label">${label}${xiBadge}</span>
        <span class="xi-award__player">${player.name}</span>
        <span class="xi-award__stat">${stat}</span>
        <span class="xi-award__meta">
          <img src="${flagURL(player.iso, 40)}" alt="${player.nation}" class="xi-award__flag" />
          ${player.nation} · ${player.rating} OVR
        </span>
      </div>
    </div>
  `;
}

function showCompleteModal() {
  saveLastXI();                       // remember this XI so it can come alive on matchday
  if (typeof renderXITodayPanel === 'function') { try { renderXITodayPanel(); } catch (e) {} }
  if (typeof renderCaptainPicker === 'function') { try { renderCaptainPicker(); } catch (e) {} }
  // 🎭 THE REVEAL — if this was an EXPERT/blind draft, flip everything visible
  // now and re-paint the pitch behind the modal so the numbers appear.
  const wasBlind = state.blind && !state.revealed;
  state.revealed = true;
  if (wasBlind) {
    Object.keys(state.roster).forEach(fillSlot);
    updateChemistryViz();
    updateProgress();
  }

  const baseFinal = computeFinalOVR();   // DISPLAY rating — chem can push it >100
  const chem = teamChemistry();
  const oop = countOOP();
  // Roll injuries for this tournament run
  const injuries = rollInjuries(state.roster);
  const injuryLoss = injuries.reduce((sum, i) => sum + i.ovrLoss, 0);
  const final = Math.max(60, baseFinal - injuryLoss);
  const grade = gradeFromOVR(final, chem);
  // The World Cup finish keeps its original (harder) basis — avg + chem/6 — so
  // the bigger display boost doesn't make winning easier than the calibrated bar.
  const finishBasis = computeBaseOVR() + Math.floor(chem / 6);
  const finish = projectedFinish(finishBasis, chem, injuryLoss);
  track('xi_complete', { mode: state.mode, ovr: final, finish: finish.tier, blind: state.blind });
  state.lastFinishTier = finish.tier;   // remembered for the leaderboard submit
  // The share card + tweet MUST reuse this exact result, not recompute (the
  // display OVR is chem-inflated and would upgrade the finish, e.g. RUNNERS-UP
  // on the result screen but CHAMPIONS on the card).
  state.lastResult = { ovr: final, chem, grade, finish, expert: !!state.blind };
  // Daily challenge — bump the streak (once/day) and remember it for the share.
  let dailyStreakVal = 0;
  if (state.daily) {
    dailyStreakVal = recordDailyCompletion(final);
    state.lastResult.daily = true;
    state.lastResult.streak = dailyStreakVal;
    updateDailyCta();   // lock the CTA — that was your one go for today
  }
  // Fresh result — re-arm the POST button (it gets locked to "✓ POSTED" after a post).
  _submittingLineup = false;
  const _postBtn = document.getElementById('submitLineupBtn');
  if (_postBtn) { _postBtn.disabled = false; _postBtn.innerHTML = 'POST TO LEADERBOARD →'; }

  // — Trophy case: evaluate this run, show any unlocks (peak-dopamine moment) —
  renderBadgeRow(checkBadges({
    final, chem,
    finishTier: finish.tier,
    grade: grade.letter,
    wasBlind,
    streak: dailyStreakVal || dailyStreak(),
    h2hWin: !!(state.h2h && state.h2h.opponent && final > state.h2h.opponent.score),
  }));

  // — Retention hooks: personal best + near-miss ("one more go" psychology) —
  const fam = state.daily ? 'daily' : (state.h2h ? 'h2h' : state.mode);
  let pb = {}; try { pb = JSON.parse(localStorage.getItem('pe_pb') || '{}') || {}; } catch (e) {}
  const prevBest = pb[fam] || 0;
  const isPB = final > prevBest;
  if (isPB) { pb[fam] = final; try { localStorage.setItem('pe_pb', JSON.stringify(pb)); } catch (e) {} }
  state.lastResult.pb = isPB && prevBest > 0;
  // Near-miss: how few OVR points away was the NEXT finish tier? (deterministic
  // thresholds — probing with a higher basis only reads the tier, scorelines stay random)
  let nearMiss = null;
  if (finish.tier !== 'CHAMPIONS') {
    for (let k = 1; k <= 4; k++) {
      const better = projectedFinish(finishBasis + k, chem, injuryLoss);
      if (better.tier !== finish.tier) { nearMiss = { pts: k, label: better.label }; break; }
    }
  }
  // TITLE MATH — answer "why didn't an S-grade squad win?" with the actual gap
  // to CHAMPIONS and what ate it (OOP penalties, injuries, chem left on the table).
  let titleMath = null;
  if (finish.tier !== 'CHAMPIONS') {
    for (let k = 1; k <= 30; k++) {
      if (projectedFinish(finishBasis + k, chem, injuryLoss).tier === 'CHAMPIONS') { titleMath = k; break; }
    }
  }
  let whyBit = '';
  if (titleMath != null) {
    const costs = [];
    if (oop) costs.push(`${oop} OOP −${totalOOPPenalty()}`);
    if (injuryLoss) costs.push(`INJURIES −${injuryLoss}`);
    const chemBonus = Math.floor(chem / 6);
    if (chemBonus < 5) costs.push(`CHEM BONUS +${chemBonus} OF +5`);
    whyBit = `<span class="xi-finish-hero__why">THE TITLE NEEDED +${titleMath} MORE${costs.length ? ' — ' + costs.join(' · ') : ''}</span>`;
  }

  // Hero finish banner — the big, color-coded "how did I do?" answer up top.
  const finishHero = $('xiFinishHero');
  if (finishHero) {
    const tierColors = { CHAMPIONS:'#ffc400', RUNNERS_UP:'#d7dde3', THIRD:'#cd7f32', FOURTH:'#9aa7b2' };
    const c = tierColors[finish.tier] || '#ffffff';
    const matchBit = finish.opp ? `<span class="xi-finish-hero__match">${finish.scoreLine} vs ${finish.opp}</span>` : '';
    const pbBit = (isPB && prevBest > 0) ? `<span class="xi-finish-hero__pb">🏆 NEW PERSONAL BEST — ${final} OVR <s>${prevBest}</s></span>` : '';
    const missBit = nearMiss ? `<span class="xi-finish-hero__miss">SO CLOSE — ${nearMiss.pts} OVR FROM ${nearMiss.label}</span>` : '';
    // During the real tournament: how many ACTUAL World Cup goals has this XI scored?
    let realBit = '';
    try {
      if (typeof liveStatFor === 'function') {
        const rg = Object.values(state.roster).reduce((s, p) => { const t = liveStatFor(p); return s + ((t && t.g) || 0); }, 0);
        if (rg > 0) realBit = `<span class="xi-finish-hero__real">⚽ YOUR XI HAS ${rg} REAL WORLD CUP GOAL${rg > 1 ? 'S' : ''} SO FAR</span>`;
      }
    } catch (e) {}
    finishHero.innerHTML = `
      <span class="xi-finish-hero__kicker">YOUR TOURNAMENT FINISH</span>
      <span class="xi-finish-hero__result" style="color:${c};">${finish.label}</span>
      ${matchBit}
      ${pbBit}
      ${missBit}
      ${whyBit}
      ${realBit}
    `;
  }

  if (state.h2h) renderH2HResult(final);
  else { const hr = document.getElementById('h2hRow'); if (hr) hr.hidden = true; }

  const kicker = document.getElementById('completeKicker');
  if (kicker) kicker.textContent = state.h2h
    ? h2hKickerText(final)
    : (state.daily
      ? `⭐ DAILY #${dailyNumber()} · 🔥 ${dailyStreakVal}-DAY STREAK · NEXT IN ${fmtCountdown(msUntilNextEasternMidnight())}`
      : (wasBlind ? '🎭 THE BIG REVEAL — YOU DRAFTED BLIND' : 'YOUR ELEVEN IS COMPLETE'));

  const oopNote = oop > 0 ? ` ${oop} OOP (−${totalOOPPenalty()} OVR).` : '';
  const injuryNote = injuryLoss > 0 ? ` 🚑 ${injuries.length} injuries (−${injuryLoss} OVR).` : '';
  $('finalBlurb').textContent = `${grade.blurb}${oopNote}${injuryNote}`;

  // Render injury report card (if any)
  const injuryContainer = document.getElementById('xiInjuries');
  if (injuryContainer) {
    if (injuries.length) {
      injuryContainer.innerHTML = `
        <div class="xi-injuries">
          <h3 class="xi-injuries__title">🚑 INJURY REPORT</h3>
          <div class="xi-injuries__list">
            ${injuries.map(i => `
              <div class="xi-injury">
                <span class="xi-injury__icon">🚑</span>
                <span class="xi-injury__player">${i.player.name}</span>
                <span class="xi-injury__detail">${i.name} · OUT ${i.out}</span>
                <span class="xi-injury__loss">−${i.ovrLoss}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } else {
      injuryContainer.innerHTML = '';
    }
  }

  // Compute and render tournament awards (pool = entire tournament, Captain = your XI)
  const awards = computeAwards();
  if (state.lastResult) state.lastResult.awards = awards;   // share card reuses these (computeAwards is random)
  const awardsContainer = document.getElementById('xiAwards');
  if (awardsContainer && awards) {
    // The awards are always YOUR simulated tournament's story — labeled as such.
    // The REAL World Cup leaders render separately below (no mixed realities).
    const caption = `<div class="xi-awards__caption">SIMULATED — YOUR XI'S TOURNAMENT RUN</div>`;
    awardsContainer.innerHTML = `
      <details class="xi-awards-details" open>
        <summary class="xi-awards__summary">🏅 TOURNAMENT AWARDS <span class="xi-awards__chev">▾</span></summary>
        ${caption}
        <div class="xi-awards__grid">
          ${awardCardHTML('🏆', 'GOLDEN BALL',     'goldenBall',   awards.goldenBall)}
          ${awardCardHTML('Ⓒ',  'CAPTAIN (XI)',    'captain',      awards.captain)}
          ${awardCardHTML('⚽', 'GOLDEN BOOT',     'goldenBoot',   awards.goldenBoot)}
          ${awardCardHTML('🅰️', 'TOP ASSISTER',    'topAssister',  awards.topAssister)}
          ${awardCardHTML('🧤', 'GOLDEN GLOVE',    'goldenGlove',  awards.goldenGlove)}
          ${awardCardHTML('🌟', 'YOUNG PLAYER',    'youngPlayer',  awards.youngPlayer)}
          ${awardCardHTML('🛡️', 'BEST DEFENDER',  'bestDefender', awards.bestDefender)}
          ${awardCardHTML('⚙️', 'BEST MIDFIELDER','bestMid',      awards.bestMid)}
        </div>
      </details>
    `;
  }

  // Stat strip — GRADE + OVERALL (the finish now headlines the hero banner above)
  const statStrip = document.getElementById('xiStatStrip');
  if (statStrip) {
    statStrip.innerHTML = `
      <div class="xi-stat">
        <span class="xi-stat__label">GRADE</span>
        <span class="xi-stat__value xi-stat__grade" style="color:${grade.color};">${grade.letter}</span>
      </div>
      <div class="xi-stat">
        <span class="xi-stat__label">OVERALL</span>
        <span class="xi-stat__value">${final} <span class="xi-stat__sub">${chem} CHEM</span></span>
      </div>
    `;
  }

  // Render players on a mini pitch in their actual formation positions
  const SLOT_POS = {
    0:  { top: '14%', left: '20%' },
    1:  { top: '9%',  left: '50%' },
    2:  { top: '14%', left: '80%' },
    3:  { top: '32%', left: '28%' },
    4:  { top: '46%', left: '50%' },
    5:  { top: '32%', left: '72%' },
    6:  { top: '74%', left: '18%' },
    7:  { top: '72%', left: '39%' },
    8:  { top: '72%', left: '61%' },
    9:  { top: '74%', left: '82%' },
    10: { top: '91%', left: '50%' },
  };

  const injuredSlots = new Set(injuries.map(i => i.slotIdx));
  const pitchHTML = `
    <div class="xi-final-pitch">
      <div class="pitch-line pitch-line--mid"></div>
      <div class="pitch-circle"></div>
      <div class="pitch-box pitch-box--top"></div>
      <div class="pitch-box pitch-box--bottom"></div>
      <div class="pitch-spot pitch-spot--top"></div>
      <div class="pitch-spot pitch-spot--bottom"></div>
      ${Object.keys(SLOT_POS).map(idx => {
        const i = parseInt(idx, 10);
        const p = state.roster[i];
        if (!p) return '';
        const def = SLOT_DEF[i];
        const pos = SLOT_POS[i];
        const pchem = chemistryForPlayer(String(i));
        const isGK = i === 10;
        const isInjured = injuredSlots.has(String(i));
        const injuryBadge = isInjured ? `<span class="xi-final-slot__injury">🚑</span>` : '';
        return `
          <div class="xi-final-slot ${isGK ? 'xi-final-slot--gk' : ''} ${!p.naturalFit ? 'xi-final-slot--oop' : ''} ${isInjured ? 'xi-final-slot--injured' : ''}" style="top:${pos.top}; left:${pos.left}">
            ${injuryBadge}
            <span class="xi-final-slot__role">${def.role}</span>
            <img class="xi-final-slot__flag" src="${flagURL(p.iso, 80)}" srcset="${flagURL2x(p.iso, 80)} 2x" alt="${p.nation}" />
            <span class="xi-final-slot__name"${nameFit(p.name)}>${shortName(p.name)}</span>
            <div class="xi-final-slot__row">
              <span class="xi-final-slot__rating">${p.rating}</span>
              <span class="xi-final-slot__league xi-final-slot__league--${p.league.toLowerCase()}">${p.league}</span>
            </div>
            <span class="xi-final-slot__chem">
              <span class="chem-dot ${pchem >= 1 ? 'on' : ''}"></span><span class="chem-dot ${pchem >= 2 ? 'on' : ''}"></span><span class="chem-dot ${pchem >= 3 ? 'on' : ''}"></span>
            </span>
          </div>
        `;
      }).join('')}
    </div>
  `;

  $('xiSummary').innerHTML = pitchHTML;
  // sync the swap-in-complete button state
  const compSwap = document.getElementById('completeSwapBtn');
  if (compSwap) compSwap.disabled = state.swapsLeft <= 0;
  const sp = $('sharePrompt'); if (sp) sp.hidden = true;  // reset share prompt for a fresh result
  $('completeModal').hidden = false;
  // 🎉 fire confetti when you win the World Cup
  if (finish.tier === 'CHAMPIONS') {
    setTimeout(fireConfetti, 250);
  }
}

function rosterAsText() {
  const labels = SLOT_DEF;
  const ordered = orderedSlots();
  const ratings = Object.values(state.roster).map(p => p.rating);
  const avg = Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length);
  const chem = teamChemistry();
  const final = avg + Math.floor(chem / 6);
  let txt = `MY PERFECT XI — ${final} OVR · ${chem} CHEM\n\n`;
  ordered.forEach(i => {
    const p = state.roster[i];
    txt += `${labels[i].role.padEnd(4)} ${p.name.padEnd(22)} ${p.nation.padEnd(12)} · ${p.league} · ${p.rating}\n`;
  });
  txt += '\nBuilt at perfect-eleven.almanac';
  return txt;
}

function copyToClipboard() {
  const txt = rosterAsText();
  navigator.clipboard.writeText(txt).then(() => {
    toast('LINEUP COPIED TO CLIPBOARD');
  }).catch(() => {
    toast('COPY FAILED — TRY MANUALLY');
  });
}

// Post the result to X (Twitter) via the web intent — result-aware copy,
// tags @SportsMarket_FC, links back to the app. (X intents can't attach an
// image, so this posts text + link; the 📸 button handles the image.)
async function shareToX() {
  if (Object.keys(state.roster).length !== 11) { toast('FINISH THE XI FIRST'); return; }
  // Reuse the result screen's exact finish (don't recompute off the inflated OVR).
  const r = state.lastResult;
  const ovr = r ? r.ovr : computeFinalOVR();
  const finish = r ? r.finish
    : projectedFinish(computeBaseOVR() + Math.floor(teamChemistry() / 6), teamChemistry(), 0);
  const tier = finish && finish.tier;
  const finishLabel = ((finish && finish.label) || '').replace(/[^\w\s-]/g, '').trim();
  let line;
  if (r && r.daily)               line = dailyShareText(ovr, finishLabel, r.streak || 0);
  else if (tier === 'CHAMPIONS')  line = `I built a WORLD CUP-WINNING XI — ${ovr} OVR 🏆`;
  else if (tier === 'RUNNERS_UP') line = `My World Cup XI reached the FINAL — ${ovr} OVR 🥈`;
  else if (tier === 'THIRD')      line = `My World Cup XI took 3RD — ${ovr} OVR 🥉`;
  else line = `My 2026 World Cup XI: ${ovr} OVR${finishLabel ? ' · ' + finishLabel : ''}`;
  const expertTag = (!(r && r.daily) && state.blind && state.revealed) ? ' (drafted BLIND 👁️)' : '';
  // Caption carries the @mention + hashtags inline so they survive BOTH paths
  // (the native share sheet doesn't support via/hashtags params).
  const caption = `${line}${expertTag}\n\nCan you beat it?\n\nvia @SportsMarket_FC #WorldCup2026 #PerfectEleven`;
  // Desktop fallback intent (text + link; image is downloaded for manual attach)
  const intentParams = new URLSearchParams({
    text: `${line}${expertTag}\n\nCan you beat it? (image attached 👇)`,
    url: 'https://perfect-eleven.vercel.app',
    via: 'SportsMarket_FC',
    hashtags: 'WorldCup2026,PerfectEleven',
  });
  const intentUrl = `https://twitter.com/intent/tweet?${intentParams.toString()}`;
  // Render the team screenshot and share it WITH the caption. On mobile the
  // share sheet lets you pick X → image + caption posted together. On desktop
  // the image downloads and the X composer opens for a manual drag-in.
  await shareXICardImage({ caption, thenOpenXIntent: intentUrl, via: 'x' });
}

// ============================================================
// ROSTERS MODAL — browse all 48 nations and their full squads
// ============================================================
function openRostersModal() {
  renderRosters('');
  $('rostersModal').hidden = false;
  const search = document.getElementById('rostersSearch');
  if (search) { search.value = ''; setTimeout(() => search.focus(), 50); }
}

function renderRosters(query) {
  // Accent-insensitive: "quinones" must find "Quiñones", "mbappe" → "Mbappé".
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const q = norm(query).trim();
  const all = NATIONS.slice().sort((a, b) => (a.group || '').localeCompare(b.group || '') || a.name.localeCompare(b.name));
  const filtered = all.filter(n => {
    if (!q) return true;
    if (norm(n.name).includes(q)) return true;
    if (n.code.toLowerCase().includes(q)) return true;
    return n.players.some(p => norm(p.name).includes(q) || norm(p.club).includes(q));
  });

  const countEl = document.getElementById('rostersCount');
  if (countEl) countEl.textContent = `${filtered.length} / ${all.length}`;

  const html = filtered.map(n => {
    const players = n.players.slice().sort((a, b) => b.rating - a.rating);
    const playerRows = players.map(p => {
      const s = (typeof liveStatFor === 'function') ? liveStatFor({ code: n.code, name: p.name }) : null;
      const f = (s && typeof s.f === 'number') ? s.f : 0;
      const form = f ? `<span class="roster__form ${f > 0 ? 'roster__form--up' : 'roster__form--down'}" title="Real World Cup form (match ratings + goals/assists)">${f > 0 ? '▲+' + f : '▼' + f}</span>` : '';
      return `
      <div class="roster__row">
        <span class="roster__pos roster__pos--${p.pos.toLowerCase()}">${p.role}</span>
        <span class="roster__name">${p.name}${form}</span>
        <span class="roster__club">${p.club}</span>
        <span class="roster__rating">${p.rating}</span>
      </div>
    `;
    }).join('');
    return `
      <details class="roster__card" ${q ? 'open' : ''}>
        <summary class="roster__head">
          <img class="roster__flag" src="https://flagcdn.com/w80/${n.iso}.png" srcset="https://flagcdn.com/w160/${n.iso}.png 2x" alt="${n.name}" />
          <span class="roster__nation">${n.name}</span>
          <span class="roster__group">${n.group || ''}</span>
          <span class="roster__size">${n.players.length} PLAYERS</span>
        </summary>
        <div class="roster__body">${playerRows}</div>
      </details>
    `;
  }).join('');

  $('rostersGrid').innerHTML = html || '<div class="roster__empty">NO MATCH</div>';
}

// ============================================================
// SHARE XI CARD as PNG — canvas-rendered, 1080×1080 for TikTok/IG/X
// ============================================================
const XI_CARD_SLOT_POS = {
  // % of card width / height — matches pitch layout in index.html
  0:  { x:0.18, y:0.20, label:'LW'  },   // LW  (pushed forward for space above the mid)
  1:  { x:0.50, y:0.15, label:'ST'  },   // ST
  2:  { x:0.82, y:0.20, label:'RW'  },   // RW
  3:  { x:0.30, y:0.40, label:'LCM' },   // LCM (SLOT_DEF[3])
  4:  { x:0.50, y:0.52, label:'CDM' },   // CDM (SLOT_DEF[4]) — deeper + central
  5:  { x:0.70, y:0.40, label:'RCM' },   // RCM (SLOT_DEF[5])
  6:  { x:0.18, y:0.74, label:'LB'  },   // LB
  7:  { x:0.39, y:0.72, label:'LCB' },   // LCB
  8:  { x:0.61, y:0.72, label:'RCB' },   // RCB
  9:  { x:0.82, y:0.74, label:'RB'  },   // RB
  10: { x:0.50, y:0.88, label:'GK'  },   // GK
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Canvas can't resolve CSS variables (var(--gold) etc), so look them up from
// the live document once and substitute the literal value before fillStyle.
function resolveCssVarsForCanvas(cssColor) {
  if (typeof cssColor !== 'string') return '#fff';
  if (!cssColor.includes('var(')) return cssColor;
  const root = getComputedStyle(document.documentElement);
  return cssColor.replace(/var\((--[\w-]+)\)/g, (_, name) => {
    const v = root.getPropertyValue(name).trim();
    return v || '#fff';
  });
}

// Draw a stylized trophy on canvas — used for the projected-finish panel.
// Color carries the tier: gold (champions) / silver (runners-up) / bronze (third).
// Canvas can't render color emoji reliably across platforms, so we draw paths.
function drawTrophyIcon(ctx, cx, cy, size, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;

  // Cup body — trapezoid, wider at top
  const cupTopW = size * 0.62;
  const cupBotW = size * 0.42;
  const cupTopY = cy - size * 0.42;
  const cupBotY = cupTopY + size * 0.48;
  ctx.beginPath();
  ctx.moveTo(cx - cupTopW/2, cupTopY);
  ctx.lineTo(cx + cupTopW/2, cupTopY);
  ctx.lineTo(cx + cupBotW/2, cupBotY);
  ctx.lineTo(cx - cupBotW/2, cupBotY);
  ctx.closePath();
  ctx.fill();

  // Handles — stroked half-circles flanking the cup
  ctx.lineWidth = size * 0.07;
  ctx.beginPath();
  ctx.arc(cx - cupTopW/2 - size*0.02, cupTopY + size*0.14, size*0.13, -Math.PI*0.45, Math.PI*0.45);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx + cupTopW/2 + size*0.02, cupTopY + size*0.14, size*0.13, Math.PI*0.55, Math.PI*1.45);
  ctx.stroke();

  // Stem
  const stemW = size * 0.12;
  ctx.fillRect(cx - stemW/2, cupBotY, stemW, size * 0.16);

  // Base
  const baseW = size * 0.52;
  const baseH = size * 0.08;
  ctx.fillRect(cx - baseW/2, cupBotY + size * 0.16, baseW, baseH);

  ctx.restore();
}

// ----- Premium share-card themes (cosmetic only — zero leaderboard impact) -----
// Each theme swaps the background gradient + the single accent color; semantic
// colors (finish/grade) are untouched.
const CARD_THEMES = {
  default: { label: 'PITCH',   bg: ['#0c1410', '#06090a'], accent: '#00c853', free: true },
  gold:    { label: 'GOLD',    bg: ['#1a1408', '#0a0703'], accent: '#ffc400' },
  crimson: { label: 'CRIMSON', bg: ['#1a0a0d', '#0a0406'], accent: '#ff4d6d' },
  royal:   { label: 'ROYAL',   bg: ['#0a1020', '#04060c'], accent: '#5b8cff' },
};
let _cardTheme = 'default';
function hexToRgba(hex, a) {
  const h = String(hex || '').replace('#', '');
  const f = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(f, 16) || 0;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
function loadCardTheme() { try { const t = localStorage.getItem('pe_card_theme'); if (t && CARD_THEMES[t]) _cardTheme = t; } catch (e) {} }
// Resolve the active theme — premium themes fall back to PITCH for non-premium
// (so a free user can't select-and-keep a paid skin).
function resolveCardTheme() {
  const t = CARD_THEMES[_cardTheme];
  if (t && (t.free || (typeof isPremium === 'function' && isPremium()))) return t;
  return CARD_THEMES.default;
}
// Build the swatch picker on the share prompt. Premium themes show a lock and
// open the paywall when a non-premium user taps them.
function buildCardThemePicker() {
  const row = document.getElementById('cardThemesRow');
  if (!row) return;
  const prem = (typeof isPremium === 'function') && isPremium();
  row.innerHTML = Object.entries(CARD_THEMES).map(([key, t]) => {
    const locked = !t.free && !prem;
    const active = key === _cardTheme && (t.free || prem);
    return `<button type="button" class="card-theme${active ? ' card-theme--active' : ''}${locked ? ' card-theme--locked' : ''}" data-theme="${key}" style="--sw:${t.accent}" aria-label="${t.label}${locked ? ' (premium)' : ''}">
      <span class="card-theme__sw"></span>
      <span class="card-theme__label">${t.label}${locked ? ' 🔒' : ''}</span>
    </button>`;
  }).join('');
  row.querySelectorAll('.card-theme').forEach(btn => btn.addEventListener('click', () => {
    const key = btn.dataset.theme, t = CARD_THEMES[key];
    if (!t) return;
    if (!t.free && !((typeof isPremium === 'function') && isPremium())) { openPaywall(); return; }
    _cardTheme = key;
    try { localStorage.setItem('pe_card_theme', key); } catch (e) {}
    buildCardThemePicker();
  }));
}

async function shareXICardImage(opts = {}) {
  if (Object.keys(state.roster).length !== 11) {
    toast('FINISH THE XI FIRST');
    return;
  }
  track(opts.via === 'x' ? 'share_x' : 'share_image', { mode: state.mode });
  toast('RENDERING CARD…');

  // === Story-format canvas: 9:16 — perfect for IG Stories / TikTok / X mobile ===
  const W = 1080, H = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Reuse the result screen's EXACT numbers + finish. Recomputing here would run
  // projectedFinish off the chem-inflated display OVR and upgrade the finish
  // (e.g. RUNNERS-UP on the result screen → CHAMPIONS on the card).
  const r = state.lastResult;
  const ovr = r ? r.ovr : computeFinalOVR();
  const chem = r ? r.chem : teamChemistry();
  const filled = Object.keys(state.roster).length;
  const finish = (r && r.finish) ? r.finish
    : ((typeof projectedFinish === 'function')
        ? projectedFinish(computeBaseOVR() + Math.floor(chem / 6), chem, 0)
        : { label: '', opponent: null, score: null, result: null });
  const grade = (r && r.grade) ? r.grade
    : ((typeof gradeFromOVR === 'function') ? gradeFromOVR(ovr, chem) : { letter: '?', color: '#fff', blurb: '' });
  // Reuse the result screen's awards (computeAwards has random tie-breaks, so
  // recomputing here could show different winners on the posted card).
  const awards = (state.lastResult && state.lastResult.awards)
    ? state.lastResult.awards
    : ((typeof computeAwards === 'function') ? computeAwards() : null);

  // === Theme (premium cosmetic) + Background ===
  const theme = resolveCardTheme();
  const ACCENT = theme.accent;
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, theme.bg[0]);
  bg.addColorStop(1, theme.bg[1]);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  // === Header (y: 0–160) ===
  ctx.fillStyle = ACCENT;
  ctx.fillRect(60, 60, 70, 70);
  ctx.fillStyle = '#0c1410';
  ctx.font = 'bold 44px Impact, "Arial Black", sans-serif';
  ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  ctx.fillText('11', 95, 95);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 46px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('PERFECT ELEVEN', 150, 88);
  ctx.fillStyle = '#7a8590';
  ctx.font = 'bold 20px ui-monospace, "JetBrains Mono", monospace';
  ctx.fillText('/ 2026 WORLD CUP', 150, 122);

  // === Pitch (y: 160–1080) ===
  const PITCH_X = 60, PITCH_Y = 160, PITCH_W = W - 120, PITCH_H = 920;
  ctx.fillStyle = '#0d1f15';
  ctx.fillRect(PITCH_X, PITCH_Y, PITCH_W, PITCH_H);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PITCH_X, PITCH_Y + PITCH_H/2);
  ctx.lineTo(PITCH_X + PITCH_W, PITCH_Y + PITCH_H/2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(PITCH_X + PITCH_W/2, PITCH_Y + PITCH_H/2, 100, 0, Math.PI*2);
  ctx.stroke();
  ctx.strokeRect(PITCH_X, PITCH_Y, PITCH_W, PITCH_H);
  ctx.strokeRect(PITCH_X + PITCH_W*0.22, PITCH_Y, PITCH_W*0.56, 110);
  ctx.strokeRect(PITCH_X + PITCH_W*0.22, PITCH_Y + PITCH_H - 110, PITCH_W*0.56, 110);

  // Preload flag images
  const flagImgs = {};
  await Promise.all(Object.values(state.roster).map(async p => {
    const code = p.iso || (NATIONS.find(n => n.code === p.code)?.iso);
    if (!code || flagImgs[code]) return;
    try { flagImgs[code] = await loadImage(`https://flagcdn.com/w160/${code}.png`); } catch (e) {}
  }));

  // Draw player cards
  const CARD_W = 168, CARD_H = 120;
  for (let i = 0; i < 11; i++) {
    const p = state.roster[i];
    const pos = cardSlotPos(i);          // derived from the active formation
    const cx = PITCH_X + PITCH_W * pos.x;
    const cy = PITCH_Y + PITCH_H * pos.y;
    const x = cx - CARD_W/2, y = cy - CARD_H/2;

    ctx.fillStyle = '#101a14';
    ctx.fillRect(x, y, CARD_W, CARD_H);
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, CARD_W, CARD_H);

    ctx.fillStyle = '#7a8590';
    ctx.font = 'bold 13px ui-monospace, "JetBrains Mono", monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(pos.label, x + 8, y + 7);

    if (!p) {
      ctx.fillStyle = '#3a4b40';
      ctx.font = 'bold 24px Impact, "Arial Black", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('OPEN', cx, cy + 8);
      continue;
    }

    const code = p.iso || NATIONS.find(n => n.code === p.code)?.iso;
    if (code && flagImgs[code]) ctx.drawImage(flagImgs[code], cx - 22, y + 26, 44, 30);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 19px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(shortName(p.name), cx, y + 64);

    ctx.fillStyle = ACCENT;
    ctx.font = 'bold 28px Impact, "Arial Black", sans-serif';
    ctx.fillText(String(p.rating), cx, y + 86);

    // Chemistry dots (top-right) — green = same-league link, like the pitch
    const pchem = (typeof chemistryForPlayer === 'function') ? chemistryForPlayer(String(i)) : 0;
    for (let d = 0; d < 3; d++) {
      ctx.beginPath();
      ctx.arc(x + CARD_W - 34 + d * 12, y + 14, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = d < pchem ? ACCENT : 'rgba(255,255,255,0.16)';
      ctx.fill();
    }
  }

  // === Stat strip (y: 1100–1180) — OVR / CHEM / SLOTS / GRADE ===
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 64px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(String(ovr), 80, 1130);
  ctx.fillStyle = '#7a8590';
  ctx.font = 'bold 16px ui-monospace, "JetBrains Mono", monospace';
  ctx.fillText('OVR', 80, 1175);

  ctx.fillStyle = '#ffc400';
  ctx.font = 'bold 64px Impact, "Arial Black", sans-serif';
  ctx.fillText(String(chem), 260, 1130);
  ctx.fillStyle = '#7a8590';
  ctx.font = 'bold 16px ui-monospace, "JetBrains Mono", monospace';
  ctx.fillText('CHEM', 260, 1175);

  // Global leaderboard rank (replaces the always-11/11 SLOTS stat). Falls back
  // to SLOTS if the leaderboard hasn't loaded yet. Expert drafts count 2×.
  const userScore = (r && r.expert) ? Math.round(ovr * BLIND_MULT) : ovr;
  const gRank = (typeof userGlobalRank === 'function') ? userGlobalRank(userScore) : null;
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 64px Impact, "Arial Black", sans-serif';
  ctx.fillText(gRank ? `#${gRank}` : `${filled}/11`, 440, 1130);
  ctx.fillStyle = '#7a8590';
  ctx.font = 'bold 16px ui-monospace, "JetBrains Mono", monospace';
  ctx.fillText(gRank ? 'GLOBAL RANK' : 'SLOTS', 440, 1175);

  // Grade pill (right side of stat strip)
  ctx.fillStyle = resolveCssVarsForCanvas(grade.color || '#fff');
  ctx.font = 'bold 96px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.fillText(grade.letter || '?', W - 80, 1130);
  ctx.fillStyle = '#7a8590';
  ctx.font = 'bold 14px ui-monospace, "JetBrains Mono", monospace';
  ctx.fillText('GRADE', W - 80, 1188);

  // === Projected Finish panel (y: 1220–1480) ===
  const FY = 1220;
  ctx.fillStyle = '#101a14';
  ctx.fillRect(60, FY, W - 120, 260);
  ctx.strokeStyle = ACCENT; ctx.lineWidth = 2;
  ctx.strokeRect(60, FY, W - 120, 260);

  ctx.fillStyle = '#7a8590';
  ctx.font = 'bold 16px ui-monospace, "JetBrains Mono", monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText('PROJECTED TOURNAMENT FINISH', W/2, FY + 24);

  // Big bracket label (CHAMPIONS / RUNNERS-UP / ROUND OF 16 / etc.)
  // Strip emojis from the label since canvas can't reliably render them.
  // Use the tier field to draw a proper trophy/medal icon instead.
  const finishLabel = (finish.label || 'GROUP STAGE EXIT')
    .replace(/[\u{1F3C6}\u{1F948}\u{1F949}]/gu, '')
    .trim();
  const tierColors = {
    CHAMPIONS:  '#ffce00',  // gold
    RUNNERS_UP: '#c0c0c0',  // silver
    THIRD:      '#cd7f32',  // bronze
  };
  const iconColor = tierColors[finish.tier];
  // 2nd/3rd use the actual medal emoji; 1st keeps the drawn gold trophy.
  const tierEmoji = { RUNNERS_UP: '🥈', THIRD: '🥉' };

  if (iconColor) {
    // Measure the label so we can pin the icon to its left edge
    ctx.font = 'bold 64px Impact, "Arial Black", sans-serif';
    const labelW = ctx.measureText(finishLabel).width;
    const ICON_SIZE = 72;
    const GAP = 24;
    const groupW = ICON_SIZE + GAP + labelW;
    const iconCx = W/2 - groupW/2 + ICON_SIZE/2;
    const iconCy = FY + 110;
    const emoji = tierEmoji[finish.tier];
    if (emoji) {
      ctx.font = `${ICON_SIZE}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(emoji, iconCx, iconCy + 2);
    } else {
      drawTrophyIcon(ctx, iconCx, iconCy, ICON_SIZE, iconColor);
    }
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 64px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(finishLabel, iconCx + ICON_SIZE/2 + GAP, iconCy);
  } else {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 64px Impact, "Arial Black", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(finishLabel, W/2, FY + 110);
  }

  // Score line: "Beat BRAZIL 2-1" or "Lost to FRANCE 1-2"
  if (finish.opp && finish.score) {
    const verb = finish.result === 'WIN' ? 'BEAT' : finish.result === 'LOSS' ? 'LOST TO' : 'PLAYED';
    const scoreLine = `${verb} ${finish.opp} ${finish.score}`;
    ctx.fillStyle = finish.result === 'WIN' ? ACCENT : '#ff6b7a';
    ctx.font = 'bold 32px Impact, "Arial Black", sans-serif';
    ctx.fillText(scoreLine, W/2, FY + 175);
  }

  // Blurb line from grade
  if (grade.blurb) {
    ctx.fillStyle = '#7a8590';
    ctx.font = 'bold 14px ui-monospace, "JetBrains Mono", monospace';
    ctx.fillText(grade.blurb.toUpperCase().slice(0, 60), W/2, FY + 222);
  }

  // === Awards grid (y: 1510–1820) — 4 award cards in 2×2 grid ===
  const AY = 1510;
  ctx.fillStyle = '#7a8590';
  ctx.font = 'bold 16px ui-monospace, "JetBrains Mono", monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText('TOURNAMENT AWARDS', W/2, AY);

  const awardList = awards ? [
    { emoji: '🏆', label: 'GOLDEN BALL',  player: awards.goldenBall,   stat: statFor('goldenBall',   awards.goldenBall) },
    { emoji: '⚽', label: 'GOLDEN BOOT',  player: awards.goldenBoot,   stat: statFor('goldenBoot',   awards.goldenBoot) },
    { emoji: '🅰️', label: 'TOP ASSISTER', player: awards.topAssister,  stat: statFor('topAssister',  awards.topAssister) },
    { emoji: '🧤', label: 'GOLDEN GLOVE', player: awards.goldenGlove,  stat: statFor('goldenGlove',  awards.goldenGlove) },
  ].filter(a => a.player && !a.player.__tbd) : [];

  // Preload flags for award winners
  await Promise.all(awardList.map(async a => {
    const code = a.player?.iso;
    if (!code || flagImgs[code]) return;
    try { flagImgs[code] = await loadImage(`https://flagcdn.com/w80/${code}.png`); } catch (e) {}
  }));

  // user XI names — to mark which winners are IN YOUR XI
  const userNames = new Set(Object.values(state.roster).map(p => p.name));
  // 2×2 grid
  const AW = (W - 180) / 2, AH = 140, GAP = 20;
  awardList.slice(0, 4).forEach((a, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const ax = 60 + col * (AW + GAP), ay = AY + 36 + row * (AH + GAP);
    const inXI = userNames.has(a.player.name);
    // card bg + border
    ctx.fillStyle = inXI ? hexToRgba(ACCENT, 0.10) : '#101a14';
    ctx.fillRect(ax, ay, AW, AH);
    ctx.strokeStyle = inXI ? ACCENT : hexToRgba(ACCENT, 0.35);
    ctx.lineWidth = 2;
    ctx.strokeRect(ax, ay, AW, AH);
    // label + IN YOUR XI badge
    ctx.fillStyle = inXI ? ACCENT : '#ffc400';
    ctx.font = 'bold 14px ui-monospace, "JetBrains Mono", monospace';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(a.label, ax + 60, ay + 14);
    if (inXI) {
      ctx.fillStyle = ACCENT;
      ctx.font = 'bold 11px ui-monospace, "JetBrains Mono", monospace';
      ctx.fillText('★ IN YOUR XI', ax + AW - 105, ay + 14);
    }
    // emoji (left)
    ctx.font = 'bold 36px serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(a.emoji, ax + 14, ay + 60);
    // player name
    ctx.font = 'bold 24px Impact, "Arial Black", sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'top';
    ctx.fillText(a.player.name.slice(0, 22), ax + 60, ay + 38);
    // stat line
    ctx.font = 'bold 18px Impact, "Arial Black", sans-serif';
    ctx.fillStyle = inXI ? ACCENT : '#ffc400';
    ctx.fillText(a.stat || '', ax + 60, ay + 68);
    // flag + nation
    if (a.player.iso && flagImgs[a.player.iso]) {
      ctx.drawImage(flagImgs[a.player.iso], ax + 60, ay + 95, 28, 18);
    }
    ctx.font = 'bold 14px ui-monospace, "JetBrains Mono", monospace';
    ctx.fillStyle = '#7a8590';
    ctx.fillText(`${a.player.nation} · ${a.player.rating} OVR`, ax + 96, ay + 100);
  });

  // === Footer (y: 1820–1920) ===
  ctx.fillStyle = '#7a8590';
  ctx.font = 'bold 22px ui-monospace, "JetBrains Mono", monospace';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText('PERFECT-ELEVEN.VERCEL.APP', 60, 1870);
  const builtBy = (typeof getBuiltByName === 'function') ? getBuiltByName() : 'EARTH';
  ctx.textAlign = 'right';
  ctx.fillText(`BUILT BY ${builtBy}`, W - 60, 1870);

  if (opts.__test) return canvas;   // verification hook — no share/download

  // === Export ===
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
  if (!blob) { toast('IMAGE EXPORT FAILED'); return; }

  const file = new File([blob], 'perfect-eleven.png', { type: 'image/png' });
  const caption = opts.caption || `${ovr} OVR · ${chem} CHEM — build yours at https://perfect-eleven.vercel.app`;
  // Prefer Web Share API on mobile — this is the ONLY way to attach the team
  // image to a tweet (pick X from the share sheet → image + caption posted).
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'My Perfect Eleven',
        text: caption,
        url: 'https://perfect-eleven.vercel.app',
      });
      return;
    } catch (e) { /* user cancelled — fall through to download */ }
  }
  // Desktop / no Web Share: download the image so it can be attached manually.
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'perfect-eleven.png';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  if (opts.thenOpenXIntent) {
    // Desktop X flow: image is now saved; open the composer with the caption
    // pre-filled so the user drags the downloaded image in.
    toast('📸 IMAGE SAVED — DRAG IT INTO YOUR TWEET');
    setTimeout(() => window.open(opts.thenOpenXIntent, '_blank', 'noopener,noreferrer'), 400);
  } else {
    toast('IMAGE DOWNLOADED — POST IT!');
  }
}

// ============================================================
// SUBMIT TO LEADERBOARD
// ============================================================
// Combine the NAME + CITY boxes into one display string ("NAME · CITY"),
// shared by the leaderboard submit and the share-card footer.
function getBuiltByName() {
  // Strip angle brackets so a name can't inject markup into the (innerHTML-rendered)
  // local/offline leaderboard. The server also strips, but defend the client too.
  let name = ($('lineupName')?.value || '').replace(/[<>]/g, '').trim();
  let city = ($('lineupCity')?.value || '').replace(/[<>]/g, '').trim();
  // No name → ANONYMOUS, no city → EARTH. Same fallback if either is a slur.
  const bad = (s) => typeof hasProfanity === 'function' && hasProfanity(s);
  if (!name || bad(name)) name = 'ANONYMOUS';
  if (!city || bad(city)) city = 'EARTH';
  return `${name} · ${city}`.toUpperCase().slice(0, 38);
}

async function submitLineupToLeaderboard() {
  if (Object.keys(state.roster).length !== 11) {
    toast('FINISH THE XI FIRST');
    return;
  }
  // ONE post per completed XI — blocks rapid re-clicks (sync guard) AND re-posting
  // the same result after it already went through.
  if (_submittingLineup) return;
  if (state.lastResult && state.lastResult.posted) { toast('✓ ALREADY POSTED THIS XI'); return; }
  _submittingLineup = true;
  const name = getBuiltByName();
  // Use the result screen's exact OVR/chem so the board, card and rank all match.
  const final = state.lastResult ? state.lastResult.ovr : computeFinalOVR();
  const chem = state.lastResult ? state.lastResult.chem : teamChemistry();

  const ordered = orderedSlots();
  const lineup = ordered.map(i => {
    const p = state.roster[i];
    return shortName(p.name);
  }).join(' · ');
  // Structured XI + the form sum baked in right now → the board can recompute a
  // LIVE score as these players perform in the real tournament (form moves it).
  const xi = ordered.map(i => { const p = state.roster[i]; return [p.code, p.name]; });
  const bfs = ordered.reduce((s, i) => {
    const p = state.roster[i];
    const st = (typeof liveStatFor === 'function') ? liveStatFor({ code: p.code, name: p.name }) : null;
    return s + (st && typeof st.f === 'number' ? st.f : 0);
  }, 0);

  const entry = {
    by: `BUILT BY ${name}`,
    ovr: final,
    chem,
    mode: state.daily ? 'DAILY' : state.mode.toUpperCase().replace('U25', 'U-25'),
    lineup,
    xi,
    bfs,
    finish: state.lastFinishTier || (typeof deriveFinishTier === 'function' ? deriveFinishTier(final, chem) : null),
    expert: state.lastResult ? !!state.lastResult.expert : !!state.blind,   // blind draft → 2× score
    user: true,
  };

  // Disable button to prevent double-submit, show progress
  const btn = document.getElementById('submitLineupBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'SUBMITTING…'; }
  toast('SUBMITTING TO GLOBAL LEADERBOARD…');

  track('leaderboard_submit', { mode: state.mode, ovr: final });
  const result = await storeLineup(entry);  // global POST + local backup
  await renderLeaderboard();                 // re-pull global top 12

  if (result?.status === 429) {
    // Rate-limited — let them retry this same XI.
    _submittingLineup = false;
    if (btn) { btn.disabled = false; btn.innerHTML = 'POST TO LEADERBOARD →'; }
    toast('TOO MANY SUBMISSIONS — TRY AGAIN IN A MIN');
    return;   // keep the modal open so they can retry
  }

  // Posted — lock this result so the button can't fire again for the same XI.
  if (state.lastResult) state.lastResult.posted = true;
  _submittingLineup = false;
  if (btn) { btn.disabled = true; btn.innerHTML = '✓ POSTED'; }

  toast(result?.ok
    ? `✓ SUBMITTED · ${final} OVR · GLOBAL LEADERBOARD UPDATED`
    : `SUBMITTED LOCALLY · ${final} OVR · GLOBAL OFFLINE`);

  // Submitted — now ASK if they want to share, before we close + reset. The
  // roster stays intact so the share card can still render.
  showSharePrompt();
}

function showSharePrompt() {
  const sp = $('sharePrompt');
  if (sp) sp.hidden = false;
  buildCardThemePicker();   // refresh swatches (reflects current premium state)
}

// Close out the complete flow: hide prompt + modal, reset, jump to the board.
function finishCompleteFlow() {
  const sp = $('sharePrompt');
  if (sp) sp.hidden = true;
  $('completeModal').hidden = true;
  exitDaily();      // leaving a Daily/H2H run — next build is a normal one
  resetRoster();    // (otherwise resetRoster would re-seed today's daily, bypassing the one-shot lock)
  document.getElementById('leaderboard')?.scrollIntoView({ behavior: 'smooth' });
}

// ============================================================
// REPORT-AN-ERROR FORM (submits via mailto:)
// ============================================================
function submitReport(e) {
  e.preventDefault();
  const form = e.target;
  const player = form.player.value.trim();
  const nation = form.nation.value.trim();
  const issue = form.issue.value;
  const details = form.details.value.trim();
  const reporter = form.reporter.value.trim();

  const subject = `[Perfect XI] ${issue} — ${player} (${nation})`;
  const body = [
    `Player: ${player}`,
    `Nation: ${nation}`,
    `Issue: ${issue}`,
    '',
    'Details:',
    details || '(none provided)',
    '',
    '---',
    reporter ? `Reported by: ${reporter}` : 'Anonymous report',
    `Submitted: ${new Date().toISOString()}`,
  ].join('\n');

  const mailto = `mailto:sportsmarketllc@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = mailto;

  // Reset + toast
  form.reset();
  toast('THANKS — REPORT QUEUED IN YOUR EMAIL APP');
  return false;
}

// ============================================================
// TOAST
// ============================================================
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2900);
}

// ============================================================
// RESET
// ============================================================
function resetRoster() {
  if (typeof exitPlacementMode === 'function') exitPlacementMode();   // clear any pending placement
  state.roster = {};
  state.usedNations = new Set();
  state.usedPlayers = new Set();   // TACTICAL — clear drafted players
  state.currentNation = null;
  state.currentSlot = null;
  state.tacticalDraw = null;
  applyModeResources();            // per-mode skips/swaps (Tactical = 2/1)
  // Daily / H2H: no skips/swaps, and re-seed so a reset restarts the SAME 11 spins.
  if (state.daily) {
    state.skipsLeft = 0; state.swapsLeft = 0;
    _spinRng = mulberry32(fnv1a('PE-DAILY-' + dailyDayString()));
  } else if (state.h2h) {
    state.skipsLeft = 0; state.swapsLeft = 0;
    _spinRng = mulberry32(state.h2h.seed);
  }
  renderResourcePips();            // rebuild pip dots to match the mode's max
  state.swapMode = false;
  state.revealed = false;          // new draft → numbers hidden again if blind is on
  updateBlindToggleLock();         // empty roster → re-enable the expert toggle
  if (typeof syncFormationPicker === 'function') syncFormationPicker();   // re-enable formation picker
  document.body.classList.remove('swap-mode');
  $('roundNum').textContent = '0';
  $('progressFill').style.width = '0%';
  $('overallRating').textContent = '— OVR';
  $('shareBtn').disabled = true;
  $('spinnerResult').classList.remove('show');
  $('swapBtn').innerHTML = `<span>SWAP (<span class="swap-count-num">${state.swapsLeft}</span>)</span><span class="xi-btn__arrow">⇆</span>`;
  $('swapBtn').onclick = enterSwapMode;
  const swapTopReset = document.getElementById('swapBtnTop');
  if (swapTopReset) {
    swapTopReset.innerHTML = `<span>SWAP OUT (<span class="swap-count-num">${state.swapsLeft}</span> LEFT)</span><span class="xi-btn__arrow">⇆</span>`;
    swapTopReset.onclick = enterSwapMode;
  }
  document.querySelectorAll('.slot').forEach(el => {
    el.classList.remove('slot--filled', 'slot--oop', 'slot--swappable');
    el.innerHTML = '<span class="slot__open">OPEN</span>';
  });
  updateResources();
  toast('ROSTER RESET');
}

// ============================================================
// INIT
// ============================================================
function initSlots() {
  document.querySelectorAll('.slot').forEach(el => {
    el.innerHTML = '<span class="slot__open">OPEN</span>';
  });
}

// ============================================================
// PREMIUM PAYWALL (unlocks TOP 50 + LEGENDS together)
// ============================================================
// NOTE: key rotated to pe_prem_v2 to REVOKE all the free unlocks that leaked via
// the old guessable ?premium=success / success123 links. Everyone must re-unlock.
const PREMIUM_UNLOCK_KEY = 'pe_prem_v2';
const PREMIUM_MODES = new Set(['top50', 'legends', 'tactical']);

// Stripe Payment Link — LIVE checkout ($4.99, takes real payments).
// ⚠️ Set the link's after-payment redirect to:
//   https://perfect-eleven.vercel.app/?session_id={CHECKOUT_SESSION_ID}
// handlePremiumReturn() then verifies that session server-side before unlocking.
const STRIPE_PAYMENT_LINK = 'https://buy.stripe.com/6oU3cv3Bo3Vi1TW41Xes001';

function isPremium() {
  return localStorage.getItem(PREMIUM_UNLOCK_KEY) === '1';
}
function unlockPremium() {
  track('premium_unlock');
  localStorage.setItem(PREMIUM_UNLOCK_KEY, '1');
  ['tacticalTab', 'top50Tab', 'legendsTab'].forEach(id => {
    const tab = document.getElementById(id);
    if (!tab) return;
    tab.classList.remove('xi-mode--locked');
    tab.querySelector('.xi-mode__lock')?.remove();
  });
}
function openPaywall() { track('paywall_open', { mode: state.mode }); $('paywallModal').hidden = false; }
function closePaywall() { $('paywallModal').hidden = true; }

// Unlock ONLY after the server confirms a real, paid, LIVE Stripe checkout.
// The Payment Link's "after payment" redirect must be set to
//   https://perfect-eleven.vercel.app/?session_id={CHECKOUT_SESSION_ID}
// Stripe substitutes the real session id; /api/verify-premium checks it against
// Stripe with the secret key. Guessed ids, test-mode checkouts, and shared links
// all fail. (?comp=<code> hits the same endpoint for owner/comp access.)
async function handlePremiumReturn() {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('session_id');
  const comp = params.get('comp');
  if (!sessionId && !comp) return;

  const cleanUrl = window.location.pathname + window.location.hash;
  const q = sessionId ? `session_id=${encodeURIComponent(sessionId)}` : `comp=${encodeURIComponent(comp)}`;
  try {
    toast('VERIFYING PAYMENT…');
    const r = await fetch(`/api/verify-premium?${q}`);
    const data = await r.json().catch(() => ({}));
    window.history.replaceState({}, document.title, cleanUrl);
    if (data && data.premium) {
      unlockPremium();
      setTimeout(() => toast('🎉 PREMIUM UNLOCKED · TACTICAL + TOP 50 + LEGENDS LIVE'), 400);
    } else {
      const msg = data?.reason === 'redeemed'  ? 'THIS RECEIPT IS ALREADY IN USE'
                : data?.reason === 'not_paid'   ? 'PAYMENT NOT COMPLETED'
                : data?.reason === 'not_configured' ? 'CHECKOUT SETUP PENDING — TRY AGAIN SOON'
                : 'COULDN’T VERIFY — EMAIL SUPPORT';
      toast(msg);
    }
  } catch (e) {
    window.history.replaceState({}, document.title, cleanUrl);
    toast('VERIFY FAILED — CHECK CONNECTION');
  }
}

function initModes() {
  // sync lock state at boot
  if (isPremium()) {
    ['top50Tab', 'legendsTab', 'tacticalTab'].forEach(id => {
      const tab = document.getElementById(id);
      if (!tab) return;
      tab.classList.remove('xi-mode--locked');
      tab.querySelector('.xi-mode__lock')?.remove();
    });
  }

  document.querySelectorAll('.xi-mode').forEach(btn => {
    btn.addEventListener('click', () => {
      // PAYWALL: intercept any premium mode if not unlocked
      if (PREMIUM_MODES.has(btn.dataset.mode) && !isPremium()) {
        openPaywall();
        return;
      }
      if (state.mode === btn.dataset.mode && !state.daily && !state.h2h) return;
      exitDaily();   // a mode tab always leaves the Daily / H2H challenge
      document.querySelectorAll('.xi-mode').forEach(b => b.classList.remove('xi-mode--active'));
      btn.classList.add('xi-mode--active');
      state.mode = btn.dataset.mode;
      resetRoster();
      buildSpinnerCards();
      updateSpinButtonLabel();
      const label = state.mode === 'u25' ? 'U-25' : state.mode === 'top50' ? 'TOP 50' : state.mode.toUpperCase();
      toast(`MODE: ${label}`);
    });
  });

  // paywall wiring — REAL Stripe Payment Link checkout
  $('paywallClose')?.addEventListener('click', closePaywall);
  $('paywallBackdrop')?.addEventListener('click', closePaywall);
  $('paywallUnlock')?.addEventListener('click', () => {
    if (!STRIPE_PAYMENT_LINK || STRIPE_PAYMENT_LINK.includes('REPLACE_ME')) {
      toast('PAYMENT LINK NOT CONFIGURED — CONTACT SUPPORT');
      return;
    }
    // Redirect to Stripe — they handle card capture + 3DS + receipts.
    // On success Stripe sends users back to ?premium=success, which auto-unlocks.
    window.location.href = STRIPE_PAYMENT_LINK;
  });
  $('paywallRestore')?.addEventListener('click', (e) => {
    e.preventDefault();
    // Honest behaviour: paywall state lives in this device's localStorage. A real
    // multi-device restore would need an auth backend; until then, ask the user
    // to email a receipt so we can manually unlock.
    const subject = encodeURIComponent('Perfect Eleven — restore premium');
    const body = encodeURIComponent('Hi — I purchased Perfect Eleven premium and need it restored on a new device. My Stripe receipt email / last-4: ');
    window.location.href = `mailto:sportsmarketllc@gmail.com?subject=${subject}&body=${body}`;
  });
}

document.addEventListener('DOMContentLoaded', () => {
  handlePremiumReturn();  // verify + unlock if Stripe redirected back with ?session_id=
  initSlots();
  // Restore the saved formation + wire the picker (locked once a build starts).
  let savedFormation = DEFAULT_FORMATION;
  try { savedFormation = localStorage.getItem('pe_formation') || DEFAULT_FORMATION; } catch (e) {}
  applyFormation(savedFormation, { force: true });
  const fp = document.getElementById('formationPicker');
  if (fp) fp.addEventListener('change', () => applyFormation(fp.value));
  initModes();
  buildSpinnerCards();
  initLiveBadge();

  $('spinBtn').addEventListener('click', spin);
  // Reel cards aren't pickable until the wheel has landed — clicking one early
  // used to do nothing silently. Give feedback (no-ops when a spin is active).
  $('spinnerCards')?.addEventListener('click', () => {
    if (state.currentNation || state.currentSlot != null) return;
    if (Object.keys(state.roster).length >= 11) return;
    toast('🎰 HIT SPIN FIRST — THE WHEEL PICKS YOUR NATION');
  });
  initStickySpin();   // mobile sticky SPIN bar (spin from your pitch, no scroll-up)
  $('dailyCta')?.addEventListener('click', startDailyChallenge);
  $('h2hCta')?.addEventListener('click', () => startH2HChallenge(Math.floor(Math.random() * 0xffffffff), null));
  updateDailyCta();
  setInterval(updateDailyCta, 60000);   // tick the "next in Xh Ym" lock countdown
  loadCardTheme();   // restore the chosen premium share-card theme
  updateKickoffPill();   // "kicks off in N days" → "🔴 LIVE" during the tournament
  $('resetBtn').addEventListener('click', resetRoster);

  // EXPERT (blind draft) toggle — committed once the draft starts
  const expertToggle = document.getElementById('expertToggle');
  if (expertToggle) {
    expertToggle.checked = state.blind;
    expertToggle.addEventListener('change', () => {
      // Locked mid-draft — snap back to the committed value
      if (Object.keys(state.roster).length > 0) { expertToggle.checked = state.blind; return; }
      state.blind = expertToggle.checked;
      state.revealed = false;
      updateProgress();
      toast(state.blind ? '👁️ EXPERT MODE ON · RATINGS HIDDEN TILL THE REVEAL' : 'EXPERT MODE OFF · RATINGS VISIBLE');
    });
  }
  const swapTopInit = document.getElementById('swapBtnTop');
  if (swapTopInit) swapTopInit.onclick = enterSwapMode;
  // SWAP from inside the pick modal — enters pick-swap mode (pick the player to swap in)
  const pickSwapInit = document.getElementById('pickSwapBtn');
  if (pickSwapInit) pickSwapInit.onclick = enterPickSwapMode;
  // Header button + tapping the backdrop now MINIMIZE (peek at your team) — they
  // no longer silently spend a skip. Only the explicit PASS button re-spins.
  $('modalMinimize').addEventListener('click', minimizePickModal);
  $('modalBackdrop').addEventListener('click', minimizePickModal);
  $('passBtn').addEventListener('click', passSpin);
  const resumeBar = document.getElementById('pickResumeBar');
  if (resumeBar) resumeBar.addEventListener('click', resumePickModal);
  $('shareBtn').addEventListener('click', showCompleteModal);
  $('swapBtn').onclick = enterSwapMode;
  $('playAgainBtn').addEventListener('click', () => {
    $('completeModal').hidden = true;
    exitDaily();    // PLAY AGAIN = a fresh normal run, never a daily/h2h replay
    resetRoster();
    updateDailyCta();
  });
  $('copyBtn')?.addEventListener('click', copyToClipboard);  // COPY LINEUP removed (redundant w/ SHARE AS IMAGE)
  const shareXBtn = document.getElementById('shareXBtn');
  if (shareXBtn) shareXBtn.addEventListener('click', shareToX);
  const shareImgBtn = document.getElementById('shareImgBtn');
  if (shareImgBtn) shareImgBtn.addEventListener('click', shareXICardImage);
  const rostersLink = document.getElementById('rostersLink');
  if (rostersLink) rostersLink.addEventListener('click', (e) => { e.preventDefault(); openRostersModal(); });
  const rostersClose = document.getElementById('rostersClose');
  if (rostersClose) rostersClose.addEventListener('click', () => $('rostersModal').hidden = true);
  const rostersBackdrop = document.getElementById('rostersBackdrop');
  if (rostersBackdrop) rostersBackdrop.addEventListener('click', () => $('rostersModal').hidden = true);
  const rostersSearch = document.getElementById('rostersSearch');
  if (rostersSearch) rostersSearch.addEventListener('input', e => renderRosters(e.target.value));
  const submitBtn = document.getElementById('submitLineupBtn');
  if (submitBtn) submitBtn.addEventListener('click', submitLineupToLeaderboard);
  // Share prompt (appears after a successful leaderboard submit)
  $('sharePromptImg')?.addEventListener('click', () => shareXICardImage());
  $('sharePromptX')?.addEventListener('click', shareToX);
  $('sharePromptSkip')?.addEventListener('click', finishCompleteFlow);
  // HELP MODAL
  const openHelp = (tab) => {
    $('helpModal').hidden = false;
    if (tab) showHelpTab(tab);
  };
  const closeHelp = () => { $('helpModal').hidden = true; };
  const showHelpTab = (target) => {
    document.querySelectorAll('.help-tab').forEach(b => b.classList.toggle('help-tab--active', b.dataset.helpTab === target));
    document.querySelectorAll('.help-panel').forEach(p => p.classList.toggle('help-panel--active', p.dataset.helpPanel === target));
  };
  $('helpLink')?.addEventListener('click', (e) => { e.preventDefault(); openHelp('how'); });
  $('helpClose')?.addEventListener('click', closeHelp);
  $('helpBackdrop')?.addEventListener('click', closeHelp);
  document.querySelectorAll('.help-tab').forEach(btn => {
    btn.addEventListener('click', () => showHelpTab(btn.dataset.helpTab));
  });
  // Topbar nav ribbon → jump directly to a help tab
  document.querySelectorAll('[data-help-jump]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      openHelp(link.dataset.helpJump);
    });
  });

  // SWAP from the complete modal
  document.getElementById('completeSwapBtn')?.addEventListener('click', () => {
    if (state.swapsLeft <= 0) { toast('NO SWAPS LEFT'); return; }
    $('completeModal').hidden = true;
    document.getElementById('pitch')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(enterSwapMode, 250);
  });
  updateResources();
  handleH2HReturn();   // arrived via a ?h2h= challenge link → auto-start it vs the sender
});
