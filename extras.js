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
const SPONSORS = [
  { name: 'RED BULL',      tagline: 'GIVES YOU WINGS',                     accent: '#FFC906' },
  { name: 'ADIDAS',        tagline: 'IMPOSSIBLE IS NOTHING',               accent: '#FFFFFF' },
  { name: 'NIKE',          tagline: 'JUST DO IT',                          accent: '#FFFFFF' },
  { name: 'VISA',          tagline: 'EVERYWHERE YOU WANT TO BE',           accent: '#1A1F71' },
  { name: 'MASTERCARD',    tagline: 'START SOMETHING PRICELESS',           accent: '#FF5F00' },
  { name: 'COCA-COLA',     tagline: 'TASTE THE FEELING',                   accent: '#E40712' },
  { name: 'HYUNDAI',       tagline: 'NEW THINKING · NEW POSSIBILITIES',    accent: '#002C5F' },
  { name: 'QATAR AIRWAYS', tagline: 'GOING PLACES TOGETHER',               accent: '#5C0F23' },
  { name: 'HUBLOT',        tagline: 'FUSION OF INNOVATION',                accent: '#C9A24A' },
  { name: 'YOUR BRAND',    tagline: 'AVAILABLE FOR SPONSORSHIP · CONTACT', accent: '#00ff85' },
  { name: '@CASUALZFC',    tagline: 'NOW ON TIKTOK',                       accent: '#69C9D0' },
  { name: '@EATOGRAPHY',   tagline: 'PLATES WORTH CHASING · NOW ON TIKTOK',accent: '#FF6B35' },
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
  { ovr: 87, chem: 14, lineup: 'PULISIC · HØJLUND · LEÃO · BRUNO F. · TCHOUAMÉNI · LEE KANG-IN · KOULIBALY · CHRISTENSEN · DAVIES · HAKIMI · SOMMER', by: 'BUILT IN NEW YORK', mode: 'U-25' },
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

  const combined = rows
    .filter(isEntryClean)                  // ★ skip corrupted-Unicode entries
    .sort((a, b) => b.ovr - a.ovr)
    .slice(0, 12)
    .map((row, i) => ({ ...row, rank: i + 1 }));

  const badge = _leaderboardIsGlobal
    ? '<div class="lb-meta lb-meta--global">🌍 GLOBAL · TOP 12 ACROSS ALL PLAYERS</div>'
    : '<div class="lb-meta lb-meta--local">📱 LOCAL · GLOBAL LEADERBOARD OFFLINE</div>';

  grid.innerHTML = badge + combined.map(row => `
    <article class="lb-row ${row.user ? 'lb-row--user' : ''}">
      <div class="lb-row__rank">
        <span class="lb-row__rank-num">${String(row.rank).padStart(2, '0')}</span>
        <span class="lb-row__mode">${row.mode || 'CLASSIC'}</span>
      </div>
      <div class="lb-row__body">
        <p class="lb-row__lineup">${row.lineup}</p>
        <span class="lb-row__by">${row.by}${row.user ? ' · <span style="color:var(--pitch);">YOU</span>' : ''}</span>
      </div>
      <div class="lb-row__ovr">
        <span class="lb-row__ovr-num">${row.ovr}</span>
        <span class="lb-row__ovr-label">OVR${row.chem ? ' · ' + row.chem + ' CHEM' : ''}</span>
      </div>
    </article>
  `).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  renderTicker();
  renderSponsorTicker();
  renderLeaderboard();
  updateCountdown();
  setInterval(updateCountdown, 30 * 1000);
});
