#!/usr/bin/env node
/* ============================================================
   2026 World Cup live-stats scraper
   Pulls from ESPN's public scoreboard JSON (no API key required)
   Writes results to live-stats.js at repo root.
   Usage: node scripts/fetch-stats.js
   ============================================================ */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ESPN_SCOREBOARD =
  'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';

// Date window: tournament June 11 → July 19, 2026
const START = new Date('2026-06-11');
const END   = new Date('2026-07-19');

const TOURNAMENT_PHASES = {
  PRE:      d => d < START,
  GROUP:    d => d >= START && d < new Date('2026-06-28'),
  RO32:     d => d >= new Date('2026-06-28') && d < new Date('2026-07-04'),
  RO16:     d => d >= new Date('2026-07-04') && d < new Date('2026-07-10'),
  QF:       d => d >= new Date('2026-07-10') && d < new Date('2026-07-14'),
  SF:       d => d >= new Date('2026-07-14') && d < new Date('2026-07-18'),
  FINAL:    d => d >= new Date('2026-07-18') && d < new Date('2026-07-20'),
  COMPLETE: d => d >= new Date('2026-07-20'),
};

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'perfect-eleven-stats/1.0' } }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error(`Bad JSON from ${url}: ${e.message}`)); }
      });
    }).on('error', reject);
  });
}

function currentPhase(today = new Date()) {
  for (const [phase, test] of Object.entries(TOURNAMENT_PHASES)) {
    if (test(today)) return phase;
  }
  return 'PRE';
}

async function fetchAllScoreboards() {
  // Get a 60-day window of scoreboard data
  const dates = [];
  for (let d = new Date(START); d <= END; d.setDate(d.getDate() + 1)) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dates.push(`${y}${m}${day}`);
  }
  const all = [];
  // ESPN scoreboard accepts ?dates=YYYYMMDD
  for (const date of dates) {
    try {
      const j = await fetchJson(`${ESPN_SCOREBOARD}?dates=${date}`);
      if (j && j.events) all.push(...j.events);
    } catch (e) {
      console.warn(`skip ${date}: ${e.message}`);
    }
  }
  return all;
}

function aggregate(events) {
  const players = {};   // name → { G, A, MOTM, redCards }
  const cleanSheets = {}; // GK name → count
  const results = [];

  for (const ev of events) {
    if (!ev || !ev.competitions || !ev.competitions[0]) continue;
    const comp = ev.competitions[0];
    if (comp.status?.type?.state !== 'post') continue; // only completed

    const home = comp.competitors.find(c => c.homeAway === 'home');
    const away = comp.competitors.find(c => c.homeAway === 'away');
    if (!home || !away) continue;

    const r = {
      date: ev.date?.slice(0, 10),
      home: home.team?.displayName,
      away: away.team?.displayName,
      homeScore: parseInt(home.score, 10) || 0,
      awayScore: parseInt(away.score, 10) || 0,
      scorers: [],
    };
    results.push(r);

    // Clean sheets — for the GK of the side that conceded 0
    if (r.homeScore === 0 && home.roster) home.roster.forEach(p => {
      if (p.position?.abbreviation === 'G') cleanSheets[p.athlete.displayName] = (cleanSheets[p.athlete.displayName] || 0) + 1;
    });
    if (r.awayScore === 0 && away.roster) away.roster.forEach(p => {
      if (p.position?.abbreviation === 'G') cleanSheets[p.athlete.displayName] = (cleanSheets[p.athlete.displayName] || 0) + 1;
    });

    // Goal scorers + assisters — ESPN structures these as plays of type "Goal"
    const details = comp.details || [];
    for (const d of details) {
      if (d.type?.text === 'Goal' && d.athletesInvolved && d.athletesInvolved[0]) {
        const scorer = d.athletesInvolved[0].displayName;
        players[scorer] ||= { G: 0, A: 0, MOTM: 0, redCards: 0 };
        players[scorer].G++;
        r.scorers.push({ name: scorer, minute: d.clock?.value });
        // Assister: ESPN sometimes provides a second athlete
        if (d.athletesInvolved.length > 1) {
          const ast = d.athletesInvolved[1].displayName;
          players[ast] ||= { G: 0, A: 0, MOTM: 0, redCards: 0 };
          players[ast].A++;
        }
      }
      if (d.type?.text === 'Red Card' && d.athletesInvolved?.[0]) {
        const name = d.athletesInvolved[0].displayName;
        players[name] ||= { G: 0, A: 0, MOTM: 0, redCards: 0 };
        players[name].redCards++;
      }
    }
  }

  // Awards
  const topByMetric = (obj, key) => {
    const entries = Object.entries(obj);
    if (!entries.length) return null;
    entries.sort((a, b) => b[1] - a[1]);
    return { name: entries[0][0], value: entries[0][1] };
  };
  const topPlayer = (key) => {
    const entries = Object.entries(players).map(([n, s]) => [n, s[key] || 0]);
    if (!entries.length) return null;
    entries.sort((a, b) => b[1] - a[1]);
    if (!entries[0][1]) return null;
    return { name: entries[0][0], value: entries[0][1] };
  };

  const awards = {
    goldenBoot:  topPlayer('G'),
    topAssister: topPlayer('A'),
    goldenGlove: topByMetric(cleanSheets, 'cs'),
    goldenBall:  null,   // requires MOTM data — ESPN doesn't expose reliably
    youngPlayer: null,
    bestDefender: null,
    bestMidfielder: null,
  };

  return { players, awards, results };
}

function writeOutput(data) {
  const phase = currentPhase();
  const today = new Date().toISOString().slice(0, 10);
  const out = `/* ============================================================
   LIVE TOURNAMENT STATS — 2026 FIFA WORLD CUP
   Auto-updated daily during the tournament via scripts/fetch-stats.js
   ============================================================ */
window.LIVE_STATS = ${JSON.stringify({
    status: phase,
    updatedAt: today,
    awards: data.awards,
    players: data.players,
    injuries: [],
    results: data.results.slice(-30),
  }, null, 2)};
`;
  const outPath = path.join(__dirname, '..', 'live-stats.js');
  fs.writeFileSync(outPath, out, 'utf8');
  console.log(`wrote ${outPath} · phase=${phase} · players=${Object.keys(data.players).length} · results=${data.results.length}`);
}

(async () => {
  const phase = currentPhase();
  if (phase === 'PRE') {
    console.log('Tournament has not started yet — skipping fetch.');
    return;
  }
  console.log(`Fetching ESPN scoreboard… phase=${phase}`);
  const events = await fetchAllScoreboards();
  console.log(`Fetched ${events.length} events.`);
  const data = aggregate(events);
  writeOutput(data);
})().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
