/**
 * Quarterly Tier A refresh helper.
 * Paste the current S&P 500 top 50 (one company per line) into a text file, then:
 *   npm run tier-a-diff -- path/to/list.txt
 * It prints who joined, who left, and the YAML lines to add. Nothing is changed automatically.
 */
import { readFileSync } from 'node:fs';
import { loadCompanies } from '../pipeline/config.ts';

const file = process.argv[2];
if (!file) {
  console.error('Usage: npm run tier-a-diff -- <file with one company name per line>');
  process.exit(1);
}
const norm = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, ' ')
  .replace(/\b(inc|corp|corporation|company|co|plc|ltd|class [ab]|the)\b/g, '').replace(/\s+/g, ' ').trim();
const pasted = readFileSync(file, 'utf8').split('\n').map((l) => l.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean);
const { companies } = loadCompanies();
const tierA = companies.filter((c) => c.tier === 'A');
const known = new Map(companies.map((c) => [norm(c.name), c]));
const pastedNorm = new Set(pasted.map(norm));

const joined = pasted.filter((p) => !known.has(norm(p)) && ![...known.keys()].some((k) => k.includes(norm(p)) || norm(p).includes(k)));
const promoted = pasted.map((p) => known.get(norm(p))).filter((c) => c && c.tier !== 'A');
const left = tierA.filter((c) => !pastedNorm.has(norm(c.name)) && ![...pastedNorm].some((p) => p.includes(norm(c.name)) || norm(c.name).includes(p)));

console.log(`\nPasted list: ${pasted.length} companies · Tier A today: ${tierA.length}\n`);
console.log(`New to the registry (${joined.length}):`);
for (const n of joined) console.log(`  + ${n}\n    - { name: ${n}, slug: ${norm(n).replace(/ /g, '-')}, tier: A, careersUrl: "TODO", mode: fetch, source: TODO, proof: pending, enabled: false }`);
console.log(`\nAlready listed in another tier (keep their first tier, or move them) (${promoted.length}):`);
for (const c of promoted) console.log(`  ~ ${c!.name} (tier ${c!.tier})`);
console.log(`\nNo longer in the top 50 (${left.length}). Consider re-tiering or keeping:`);
for (const c of left) console.log(`  - ${c.name}`);
console.log('\nEdit config/companies.yaml to apply. Run Phase 0-style discovery for any new company before enabling it.\n');
