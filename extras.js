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
  { name: 'DRAFTKINGS',    tagline: 'BET THE BIGGEST GAMES',               accent: '#53D337' },
  { name: 'YOUR BRAND',    tagline: 'AVAILABLE FOR SPONSORSHIP · CONTACT', accent: '#00ff85' },
  { name: 'POLYMARKET',    tagline: 'PREDICT THE WORLD CUP',               accent: '#1652F0' },
  { name: '@CASUALZFC',    tagline: 'NOW ON TIKTOK',                       accent: '#69C9D0' },
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

// LocalStorage persistence
const LINEUP_KEY = 'pe_lineups_v1';
function loadStoredLineups() {
  try {
    return JSON.parse(localStorage.getItem(LINEUP_KEY) || '[]');
  } catch { return []; }
}
function storeLineup(entry) {
  const arr = loadStoredLineups();
  arr.push(entry);
  arr.sort((a, b) => b.ovr - a.ovr);
  localStorage.setItem(LINEUP_KEY, JSON.stringify(arr.slice(0, 30)));
}

function renderLeaderboard() {
  const grid = document.getElementById('leaderboardGrid');
  if (!grid) return;
  const stored = loadStoredLineups();
  const combined = [...stored, ...LEADERBOARD]
    .sort((a, b) => b.ovr - a.ovr)
    .slice(0, 12)
    .map((row, i) => ({ ...row, rank: i + 1 }));

  grid.innerHTML = combined.map(row => `
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
