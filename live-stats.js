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
