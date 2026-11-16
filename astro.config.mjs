// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { site, modules } from './site.config.ts';
import { definitions } from './src/modules/index.ts';

/** Injects routes only for enabled modules: disabled ones ship nothing. */
/** @returns {import('astro').AstroIntegration} */
function upstreamModules() {
  return {
    name: 'upstream-modules',
    hooks: {
      'astro:config:setup': ({ injectRoute, logger }) => {
        for (const m of modules) {
          const def = definitions[m.id];
          if (!m.enabled || !def) continue;
          for (const r of def.routes) injectRoute({ pattern: r.pattern, entrypoint: `./src/modules/${m.id}/${r.entrypoint}` });
        }
        logger.info(`modules on: ${modules.filter((m) => m.enabled).map((m) => m.id).join(', ')}`);
      },
    },
  };
}

export default defineConfig({
  site: site.url,
  output: 'static',
  trailingSlash: 'ignore',
  integrations: [
    upstreamModules(),
    react(),
    sitemap({ filter: (page) => !/\/(styleguide|status|saved|jobs\/view)\/?$/.test(page) }),
  ],
  vite: { plugins: [tailwindcss()] },
});
