// Renders the default Open Graph share image (public/og.png, 1200×630) from SVG.
// Run once on a Mac (uses the system Bodoni 72 / Menlo fonts): node scripts/og-image.mjs
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync } from 'node:fs';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="glow" cx="50%" cy="100%" r="70%">
      <stop offset="0" stop-color="#d6a65c" stop-opacity="0.55"/>
      <stop offset="0.4" stop-color="#e6c48c" stop-opacity="0.25"/>
      <stop offset="0.75" stop-color="#f6f2ea" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="horizon" x1="0" x2="1"><stop offset="0" stop-color="#7d5f27" stop-opacity="0"/><stop offset="0.5" stop-color="#7d5f27" stop-opacity="0.6"/><stop offset="1" stop-color="#7d5f27" stop-opacity="0"/></linearGradient>
  </defs>
  <rect width="1200" height="630" fill="#f6f2ea"/>
  <rect y="230" width="1200" height="400" fill="url(#glow)"/>
  <rect y="628" width="1200" height="2" fill="url(#horizon)"/>
  <rect x="80" y="104" width="48" height="1.5" fill="#7d5f27"/>
  <text x="148" y="110" font-family="Menlo" font-size="17" letter-spacing="4" fill="#5f5a51">STRAIGHT FROM THE SOURCE · VERIFIED LIVE</text>
  <text font-family="Bodoni 72" font-size="88" fill="#1d1c1a">
    <tspan x="76" y="250">Real jobs. Real companies.</tspan>
    <tspan x="76" y="350">Straight from the source.</tspan>
  </text>
  <text x="80" y="520" font-family="Bodoni 72" font-size="44" fill="#1d1c1a">Upstream<tspan fill="#7d5f27">.</tspan></text>
  <text x="80" y="562" font-family="Menlo" font-size="16" letter-spacing="3" fill="#5f5a51">GHOST-JOB RADAR · INSIDER REFERRALS · NO ACCOUNT NEEDED</text>
</svg>`;

const png = new Resvg(svg, {
  font: { loadSystemFonts: true, defaultFontFamily: 'Georgia' },
  fitTo: { mode: 'width', value: 1200 },
}).render().asPng();
writeFileSync(new URL('../public/og.png', import.meta.url), png);
console.log(`public/og.png (${(png.length / 1024).toFixed(0)} KB)`);
