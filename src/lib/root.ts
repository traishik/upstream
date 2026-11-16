/** Find the project root (folder with astro.config.mjs), however the dev server or build was launched. */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

let cached: string | undefined;
export function projectRoot(): string {
  if (cached) return cached;
  for (const start of [dirname(fileURLToPath(import.meta.url)), process.cwd(), join(process.cwd(), 'upstream')]) {
    let dir = start;
    for (let i = 0; i < 10; i++) {
      if (existsSync(join(dir, 'astro.config.mjs'))) return (cached = dir);
      const up = dirname(dir);
      if (up === dir) break;
      dir = up;
    }
  }
  return (cached = process.cwd());
}
export const fromRoot = (...parts: string[]) => join(projectRoot(), ...parts);
