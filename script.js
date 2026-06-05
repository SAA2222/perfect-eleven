/* ============================================================
   FORTY-EIGHT — 2026 World Cup Almanac
   Data + interactions
   ============================================================ */

// ============================================================
// DATA — 48 qualified nations, grouped A → L
// ============================================================
const GROUPS = [
  { letter: 'A', tag: 'NORTH', teams: [
    { name: 'Mexico',       flag: '🇲🇽', pot: 'Host'  },
    { name: 'Cameroon',     flag: '🇨🇲', pot: 'Pot 3' },
    { name: 'Norway',       flag: '🇳🇴', pot: 'Pot 2' },
    { name: 'Saudi Arabia', flag: '🇸🇦', pot: 'Pot 4' },
  ]},
  { letter: 'B', tag: 'EAST', teams: [
    { name: 'USA',          flag: '🇺🇸', pot: 'Host'  },
    { name: 'Belgium',      flag: '🇧🇪', pot: 'Pot 2' },
    { name: 'Senegal',      flag: '🇸🇳', pot: 'Pot 3' },
    { name: 'Iraq',         flag: '🇮🇶', pot: 'Pot 4' },
  ]},
  { letter: 'C', tag: 'WEST', teams: [
    { name: 'Canada',       flag: '🇨🇦', pot: 'Host'  },
    { name: 'Portugal',     flag: '🇵🇹', pot: 'Pot 1' },
    { name: 'Algeria',      flag: '🇩🇿', pot: 'Pot 3' },
    { name: 'New Zealand',  flag: '🇳🇿', pot: 'Pot 4' },
  ]},
  { letter: 'D', tag: 'CENTRAL', teams: [
    { name: 'Brazil',       flag: '🇧🇷', pot: 'Pot 1' },
    { name: 'Croatia',      flag: '🇭🇷', pot: 'Pot 2' },
    { name: 'Nigeria',      flag: '🇳🇬', pot: 'Pot 3' },
    { name: 'Costa Rica',   flag: '🇨🇷', pot: 'Pot 4' },
  ]},
  { letter: 'E', tag: 'WEST', teams: [
    { name: 'France',       flag: '🇫🇷', pot: 'Pot 1' },
    { name: 'Switzerland',  flag: '🇨🇭', pot: 'Pot 2' },
    { name: 'Ivory Coast',  flag: '🇨🇮', pot: 'Pot 3' },
    { name: 'Panama',       flag: '🇵🇦', pot: 'Pot 4' },
  ]},
  { letter: 'F', tag: 'GROUP OF DEATH', teams: [
    { name: 'Spain',        flag: '🇪🇸', pot: 'Pot 1' },
    { name: 'Netherlands',  flag: '🇳🇱', pot: 'Pot 2' },
    { name: 'Morocco',      flag: '🇲🇦', pot: 'Pot 3' },
    { name: 'Australia',    flag: '🇦🇺', pot: 'Pot 4' },
  ]},
  { letter: 'G', tag: 'EAST', teams: [
    { name: 'England',      flag: '🇬🇧', pot: 'Pot 1' },
    { name: 'Denmark',      flag: '🇩🇰', pot: 'Pot 2' },
    { name: 'Egypt',        flag: '🇪🇬', pot: 'Pot 3' },
    { name: 'Jamaica',      flag: '🇯🇲', pot: 'Pot 4' },
  ]},
  { letter: 'H', tag: 'CENTRAL', teams: [
    { name: 'Argentina',    flag: '🇦🇷', pot: 'Pot 1' },
    { name: 'Austria',      flag: '🇦🇹', pot: 'Pot 2' },
    { name: 'South Korea',  flag: '🇰🇷', pot: 'Pot 3' },
    { name: 'Qatar',        flag: '🇶🇦', pot: 'Pot 4' },
  ]},
  { letter: 'I', tag: 'NORTH', teams: [
    { name: 'Germany',      flag: '🇩🇪', pot: 'Pot 1' },
    { name: 'Serbia',       flag: '🇷🇸', pot: 'Pot 2' },
    { name: 'Japan',        flag: '🇯🇵', pot: 'Pot 3' },
    { name: 'UAE',          flag: '🇦🇪', pot: 'Pot 4' },
  ]},
  { letter: 'J', tag: 'SOUTH', teams: [
    { name: 'Uruguay',      flag: '🇺🇾', pot: 'Pot 1' },
    { name: 'Ukraine',      flag: '🇺🇦', pot: 'Pot 2' },
    { name: 'Ghana',        flag: '🇬🇭', pot: 'Pot 3' },
    { name: 'Tunisia',      flag: '🇹🇳', pot: 'Pot 4' },
  ]},
  { letter: 'K', tag: 'WEST', teams: [
    { name: 'Colombia',     flag: '🇨🇴', pot: 'Pot 1' },
    { name: 'Poland',       flag: '🇵🇱', pot: 'Pot 2' },
    { name: 'Iran',         flag: '🇮🇷', pot: 'Pot 3' },
    { name: 'Paraguay',     flag: '🇵🇾', pot: 'Pot 4' },
  ]},
  { letter: 'L', tag: 'NORTH', teams: [
    { name: 'Italy',        flag: '🇮🇹', pot: 'Pot 1' },
    { name: 'Turkey',       flag: '🇹🇷', pot: 'Pot 2' },
    { name: 'Ecuador',      flag: '🇪🇨', pot: 'Pot 3' },
    { name: 'Cape Verde',   flag: '🇨🇻', pot: 'Pot 4' },
  ]},
];

// ============================================================
// HOST CITIES — 16 venues
// ============================================================
const CITIES = [
  { n: '01', name: 'New York / NJ',   flag: '🇺🇸', stadium: 'MetLife Stadium',          cap: '82,500', role: 'FINAL'      },
  { n: '02', name: 'Los Angeles',     flag: '🇺🇸', stadium: 'SoFi Stadium',             cap: '70,240', role: 'SEMIFINAL'  },
  { n: '03', name: 'Dallas',          flag: '🇺🇸', stadium: 'AT&T Stadium',             cap: '92,967', role: 'SEMIFINAL'  },
  { n: '04', name: 'Atlanta',         flag: '🇺🇸', stadium: 'Mercedes-Benz Stadium',    cap: '71,000', role: 'QF'         },
  { n: '05', name: 'Boston',          flag: '🇺🇸', stadium: 'Gillette Stadium',         cap: '65,878', role: 'QF'         },
  { n: '06', name: 'Houston',         flag: '🇺🇸', stadium: 'NRG Stadium',              cap: '72,220', role: 'R16'        },
  { n: '07', name: 'Kansas City',     flag: '🇺🇸', stadium: 'Arrowhead Stadium',        cap: '76,416', role: 'R16'        },
  { n: '08', name: 'Miami',           flag: '🇺🇸', stadium: 'Hard Rock Stadium',        cap: '65,326', role: 'R16'        },
  { n: '09', name: 'Philadelphia',    flag: '🇺🇸', stadium: 'Lincoln Financial Field',  cap: '69,328', role: 'R16'        },
  { n: '10', name: 'San Francisco',   flag: '🇺🇸', stadium: "Levi's Stadium",           cap: '68,500', role: 'GROUP'      },
  { n: '11', name: 'Seattle',         flag: '🇺🇸', stadium: 'Lumen Field',              cap: '68,740', role: 'GROUP'      },
  { n: '12', name: 'Mexico City',     flag: '🇲🇽', stadium: 'Estadio Azteca',           cap: '87,000', role: 'OPENER'     },
  { n: '13', name: 'Guadalajara',     flag: '🇲🇽', stadium: 'Estadio Akron',            cap: '49,850', role: 'GROUP'      },
  { n: '14', name: 'Monterrey',       flag: '🇲🇽', stadium: 'Estadio BBVA',             cap: '53,500', role: 'R16'        },
  { n: '15', name: 'Toronto',         flag: '🇨🇦', stadium: 'BMO Field',                cap: '45,000', role: 'GROUP'      },
  { n: '16', name: 'Vancouver',       flag: '🇨🇦', stadium: 'BC Place',                 cap: '54,500', role: 'R16'        },
];

// ============================================================
// SCHEDULE — opening week fixtures
// ============================================================
const SCHEDULE = [
  { date: '2026-06-11', dow: 'THU', day: '11', month: 'JUN', matches: [
    { time: '4:00 PM',  home: { name: 'MEXICO', flag: '🇲🇽' }, away: { name: 'TBD',     flag: '🏴' }, venue: 'AZTECA',      group: 'A' },
  ]},
  { date: '2026-06-12', dow: 'FRI', day: '12', month: 'JUN', matches: [
    { time: '12:00 PM', home: { name: 'CANADA', flag: '🇨🇦' }, away: { name: 'PORTUGAL', flag: '🇵🇹' }, venue: 'BMO FIELD',   group: 'C' },
    { time: '3:00 PM',  home: { name: 'BRAZIL', flag: '🇧🇷' }, away: { name: 'CROATIA',  flag: '🇭🇷' }, venue: 'SOFI',        group: 'D' },
    { time: '6:00 PM',  home: { name: 'USA',    flag: '🇺🇸' }, away: { name: 'BELGIUM',  flag: '🇧🇪' }, venue: 'METLIFE',     group: 'B' },
    { time: '9:00 PM',  home: { name: 'SPAIN',  flag: '🇪🇸' }, away: { name: 'NETHERLANDS', flag: '🇳🇱' }, venue: 'AT&T',     group: 'F' },
  ]},
  { date: '2026-06-13', dow: 'SAT', day: '13', month: 'JUN', matches: [
    { time: '12:00 PM', home: { name: 'FRANCE',    flag: '🇫🇷' }, away: { name: 'SWITZERLAND', flag: '🇨🇭' }, venue: 'GILLETTE', group: 'E' },
    { time: '3:00 PM',  home: { name: 'ENGLAND',   flag: '🇬🇧' }, away: { name: 'DENMARK',     flag: '🇩🇰' }, venue: 'MERCEDES', group: 'G' },
    { time: '6:00 PM',  home: { name: 'ARGENTINA', flag: '🇦🇷' }, away: { name: 'AUSTRIA',     flag: '🇦🇹' }, venue: 'NRG',      group: 'H' },
    { time: '9:00 PM',  home: { name: 'GERMANY',   flag: '🇩🇪' }, away: { name: 'SERBIA',      flag: '🇷🇸' }, venue: 'ARROWHEAD',group: 'I' },
  ]},
  { date: '2026-06-14', dow: 'SUN', day: '14', month: 'JUN', matches: [
    { time: '12:00 PM', home: { name: 'URUGUAY',  flag: '🇺🇾' }, away: { name: 'UKRAINE',    flag: '🇺🇦' }, venue: 'HARD ROCK',   group: 'J' },
    { time: '3:00 PM',  home: { name: 'COLOMBIA', flag: '🇨🇴' }, away: { name: 'POLAND',     flag: '🇵🇱' }, venue: 'LINCOLN',     group: 'K' },
    { time: '6:00 PM',  home: { name: 'ITALY',    flag: '🇮🇹' }, away: { name: 'TURKEY',     flag: '🇹🇷' }, venue: "LEVI'S",      group: 'L' },
    { time: '9:00 PM',  home: { name: 'MOROCCO',  flag: '🇲🇦' }, away: { name: 'AUSTRALIA',  flag: '🇦🇺' }, venue: 'LUMEN',       group: 'F' },
  ]},
  { date: '2026-06-15', dow: 'MON', day: '15', month: 'JUN', matches: [
    { time: '12:00 PM', home: { name: 'JAPAN',    flag: '🇯🇵' }, away: { name: 'UAE',        flag: '🇦🇪' }, venue: 'GUADALAJARA', group: 'I' },
    { time: '3:00 PM',  home: { name: 'SENEGAL',  flag: '🇸🇳' }, away: { name: 'IRAQ',       flag: '🇮🇶' }, venue: 'BBVA',        group: 'B' },
    { time: '6:00 PM',  home: { name: 'NORWAY',   flag: '🇳🇴' }, away: { name: 'SAUDI ARABIA', flag: '🇸🇦' }, venue: 'AZTECA',    group: 'A' },
  ]},
  { date: '2026-06-16', dow: 'TUE', day: '16', month: 'JUN', matches: [
    { time: '3:00 PM',  home: { name: 'GHANA',     flag: '🇬🇭' }, away: { name: 'TUNISIA',    flag: '🇹🇳' }, venue: 'BC PLACE',   group: 'J' },
    { time: '6:00 PM',  home: { name: 'IRAN',      flag: '🇮🇷' }, away: { name: 'PARAGUAY',   flag: '🇵🇾' }, venue: 'BMO',        group: 'K' },
    { time: '9:00 PM',  home: { name: 'ECUADOR',   flag: '🇪🇨' }, away: { name: 'CAPE VERDE', flag: '🇨🇻' }, venue: 'AKRON',      group: 'L' },
  ]},
  { date: '2026-06-17', dow: 'WED', day: '17', month: 'JUN', matches: [
    { time: '12:00 PM', home: { name: 'EGYPT',       flag: '🇪🇬' }, away: { name: 'JAMAICA',     flag: '🇯🇲' }, venue: 'GILLETTE', group: 'G' },
    { time: '3:00 PM',  home: { name: 'SOUTH KOREA', flag: '🇰🇷' }, away: { name: 'QATAR',       flag: '🇶🇦' }, venue: 'METLIFE',  group: 'H' },
    { time: '6:00 PM',  home: { name: 'CAMEROON',    flag: '🇨🇲' }, away: { name: 'TBD',         flag: '🏴' }, venue: 'SOFI',     group: 'A' },
    { time: '9:00 PM',  home: { name: 'IVORY COAST', flag: '🇨🇮' }, away: { name: 'PANAMA',      flag: '🇵🇦' }, venue: 'AT&T',     group: 'E' },
  ]},
];

// ============================================================
// TICKER ITEMS
// ============================================================
const TICKER_ITEMS = [
  { type: 'live',  text: 'TOURNAMENT KICKOFF · MEX vs TBD · ESTADIO AZTECA' },
  { type: 'news',  text: 'BRACKET BUILDER NOW OPEN · LOCK YOUR PICKS BY JUN 11' },
  { type: 'news',  text: '🇲🇽 OPENER · 🇺🇸 11 CITIES · 🇨🇦 2 CITIES · 16 VENUES TOTAL' },
  { type: 'live',  text: 'NEW · GROUP F PREVIEW DROPS THU · "GROUP OF DEATH"' },
  { type: 'news',  text: '⚽ 48 NATIONS · 12 GROUPS · 104 MATCHES · 39 DAYS' },
  { type: 'news',  text: '🇧🇷 BRAZIL +650 · 🇫🇷 FRANCE +700 · 🇦🇷 ARGENTINA +750 · 🇪🇸 SPAIN +800' },
  { type: 'live',  text: 'OPENING CEREMONY · MEXICO CITY · JUN 11 · 3 PM ET' },
  { type: 'news',  text: 'THE FINAL · METLIFE STADIUM · NJ · JUL 19' },
  { type: 'news',  text: '🇲🇦 MOROCCO +2200 · 🇳🇱 NETHERLANDS +1400 · 🇩🇪 GERMANY +1100' },
  { type: 'live',  text: 'XG LAB OPENS WEDNESDAY · STATS FROM EVERY MATCH' },
];

// ============================================================
// RENDER: TICKER
// ============================================================
function renderTicker() {
  const track = document.getElementById('tickerTrack');
  if (!track) return;
  // duplicate for seamless scroll
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
// RENDER: GROUPS
// ============================================================
function renderGroups() {
  const grid = document.getElementById('groupsGrid');
  if (!grid) return;
  grid.innerHTML = GROUPS.map(g => `
    <article class="group">
      <header class="group__head">
        <span class="group__letter">${g.letter}</span>
        <span class="group__tag">${g.tag}</span>
      </header>
      <ul class="group__list">
        ${g.teams.map(t => `
          <li class="group__team">
            <span class="group__team-flag">${t.flag}</span>
            <span class="group__team-name">${t.name}</span>
            <span class="group__team-pot">${t.pot}</span>
          </li>
        `).join('')}
      </ul>
    </article>
  `).join('');
}

// ============================================================
// RENDER: CITIES
// ============================================================
function renderCities() {
  const grid = document.getElementById('citiesGrid');
  if (!grid) return;
  grid.innerHTML = CITIES.map(c => `
    <article class="city">
      <span class="city__flag">${c.flag}</span>
      <span class="city__num">№ ${c.n}</span>
      <h3 class="city__name">${c.name}</h3>
      <p class="city__stadium">${c.stadium}</p>
      <div class="city__cap">
        <span>CAP ${c.cap}</span>
        <span>· ${c.role}</span>
      </div>
    </article>
  `).join('');
}

// ============================================================
// RENDER: SCHEDULE
// ============================================================
function renderSchedule() {
  const wrap = document.getElementById('schedule');
  if (!wrap) return;
  wrap.innerHTML = SCHEDULE.map(d => `
    <div class="sched-day">
      <div class="sched-day__date">
        <span class="sched-day__dow">${d.dow}</span>
        <span class="sched-day__num">${d.day}</span>
        <span class="sched-day__month">${d.month} 2026</span>
      </div>
      <div class="sched-day__matches">
        ${d.matches.map(m => `
          <div class="match">
            <span class="match__time">${m.time}</span>
            <span class="match__home"><span>${m.home.name}</span><span>${m.home.flag}</span></span>
            <span class="match__vs">vs · GRP ${m.group}</span>
            <span class="match__away"><span>${m.away.flag}</span><span>${m.away.name}</span></span>
            <span class="match__venue">${m.venue}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

// ============================================================
// COUNTDOWN
// ============================================================
const KICKOFF = new Date('2026-06-11T20:00:00Z').getTime(); // 4 PM ET

function pad(n) { return String(Math.max(0, Math.floor(n))).padStart(2, '0'); }

function updateCountdown() {
  const now = Date.now();
  const diff = KICKOFF - now;

  const days = diff / (1000 * 60 * 60 * 24);
  const hrs  = (diff / (1000 * 60 * 60)) % 24;
  const min  = (diff / (1000 * 60)) % 60;
  const sec  = (diff / 1000) % 60;

  const d = document.getElementById('cdDays');
  const h = document.getElementById('cdHrs');
  const m = document.getElementById('cdMin');
  const s = document.getElementById('cdSec');
  if (d) d.textContent = pad(days);
  if (h) h.textContent = pad(hrs);
  if (m) m.textContent = pad(min);
  if (s) s.textContent = pad(sec);

  const tb = document.getElementById('topbarDate');
  if (tb) {
    if (diff > 0) {
      tb.textContent = `T-${pad(days)}D ${pad(hrs)}H ${pad(min)}M`;
    } else {
      tb.textContent = 'TOURNAMENT LIVE';
    }
  }
}

// ============================================================
// SUBTLE PARALLAX ON HERO BACKGROUND DIGIT
// ============================================================
function setupHeroParallax() {
  const hero = document.querySelector('.hero');
  if (!hero) return;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (y < window.innerHeight) {
      hero.style.setProperty('--parallax', `${y * 0.15}px`);
      const ghost = hero.querySelector('::before');
    }
  }, { passive: true });
}

// ============================================================
// REVEAL ON SCROLL
// ============================================================
function setupReveals() {
  const els = document.querySelectorAll('.section, .stat-strip, .feature, .group, .city, .tool');
  els.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    el.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
  });

  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.style.opacity = '1';
        e.target.style.transform = 'translateY(0)';
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.05, rootMargin: '0px 0px -60px 0px' });

  els.forEach(el => io.observe(el));
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  renderTicker();
  renderGroups();
  renderCities();
  renderSchedule();
  updateCountdown();
  setInterval(updateCountdown, 1000);
  setupHeroParallax();
  setupReveals();
});
