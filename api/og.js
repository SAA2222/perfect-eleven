/**
 * Dynamic Open Graph image endpoint.
 *
 *   /api/og                    → default branded card
 *   /api/og?ovr=94&by=SAARIM   → personalized "Saarim's XI · 94 OVR"
 *
 * Returns a 1200×630 SVG (browsers + social scrapers render SVG OG images fine
 * as of 2024). No deps, no edge-runtime, no @vercel/og — pure SVG so it works on
 * every Vercel plan including hobby.
 */
function escapeXml(s) {
  return String(s || '').replace(/[<>&'"]/g, c => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
  }[c]));
}

export default function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host}`);
  const by  = escapeXml((url.searchParams.get('by')  || '').slice(0, 28).toUpperCase());
  const ovr = escapeXml((url.searchParams.get('ovr') || '').slice(0, 3));
  const headline = ovr
    ? `${by || 'A PERFECT XI'} · ${ovr} OVR`
    : 'BUILD YOUR PERFECT XI';
  const subline = ovr
    ? '2026 FIFA WORLD CUP'
    : '48 OFFICIAL SQUADS · 2026 WORLD CUP';

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0c1410"/>
      <stop offset="1" stop-color="#06090a"/>
    </linearGradient>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M48 0H0V48" fill="none" stroke="rgba(0,200,83,0.07)" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#grid)"/>
  <!-- pitch circle -->
  <circle cx="900" cy="315" r="180" fill="none" stroke="rgba(0,200,83,0.18)" stroke-width="3"/>
  <line x1="900" y1="135" x2="900" y2="495" stroke="rgba(0,200,83,0.18)" stroke-width="3"/>
  <!-- 11 mark -->
  <rect x="80" y="80" width="96" height="96" fill="#00c853"/>
  <text x="128" y="148" font-family="Impact, Arial Black, sans-serif" font-size="64" fill="#0c1410" text-anchor="middle">11</text>
  <!-- brand -->
  <text x="200" y="148" font-family="Impact, Arial Black, sans-serif" font-size="56" fill="#fff">PERFECT ELEVEN</text>
  <text x="200" y="180" font-family="JetBrains Mono, monospace" font-size="18" fill="#7a8590">/ 2026 WORLD CUP</text>
  <!-- main headline -->
  <text x="80" y="380" font-family="Impact, Arial Black, sans-serif" font-size="84" fill="#fff" letter-spacing="2">${headline}</text>
  <text x="80" y="430" font-family="JetBrains Mono, monospace" font-size="22" fill="#00c853" letter-spacing="4">${subline}</text>
  <!-- footer -->
  <text x="80" y="560" font-family="JetBrains Mono, monospace" font-size="20" fill="#7a8590">PERFECT-ELEVEN.VERCEL.APP</text>
  <text x="1120" y="560" font-family="JetBrains Mono, monospace" font-size="20" fill="#ffc400" text-anchor="end">▶ PLAY FREE</text>
</svg>`;

  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400, immutable');
  res.status(200).send(svg);
}
