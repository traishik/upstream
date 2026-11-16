// Checks every text/background token pair in src/styles/tokens.css against WCAG AA.
// Usage: npm run contrast
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
const block = (sel) => {
  const m = css.match(new RegExp(`${sel.replace(/[[\]'=]/g, '\\$&')}\\s*{([^}]*)}`));
  return Object.fromEntries([...(m?.[1] ?? '').matchAll(/(--c-[\w-]+):\s*(#[0-9a-f]{6})/gi)].map((x) => [x[1], x[2]]));
};
const themes = { ivory: block(':root'), evening: { ...block(':root'), ...block(":root[data-theme='dark']") } };

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// [foreground, background, minimum]  4.5 = normal text, 3 = large text / UI components
const pairs = [
  ['--c-text', '--c-bg', 4.5], ['--c-text', '--c-surface', 4.5], ['--c-text', '--c-surface-2', 4.5],
  ['--c-text-muted', '--c-bg', 4.5], ['--c-text-muted', '--c-surface', 4.5], ['--c-text-muted', '--c-surface-2', 4.5],
  ['--c-accent', '--c-bg', 4.5], ['--c-accent', '--c-surface', 4.5],
  ['--c-on-accent', '--c-accent-fill', 4.5], ['--c-on-accent', '--c-accent-fill-strong', 4.5],
  ['--c-live', '--c-bg', 3], ['--c-focus', '--c-bg', 3],
];
let fail = 0;
for (const [name, t] of Object.entries(themes)) {
  console.log(`\n${name}`);
  for (const [fg, bg, min] of pairs) {
    const r = ratio(t[fg], t[bg]);
    const ok = r >= min;
    if (!ok) fail++;
    console.log(`  ${ok ? 'pass' : 'FAIL'}  ${r.toFixed(2).padStart(5)}:1  ${fg} on ${bg}  (min ${min})`);
  }
}
process.exit(fail ? 1 : 0);
