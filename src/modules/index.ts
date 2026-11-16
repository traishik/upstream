/**
 * Module definitions: what each section contributes. Turning a module on or off happens in
 * site.config.ts (`enabled`). A disabled module produces no routes, no nav item and no bundle weight,
 * because its pages are only injected into the build when enabled (see astro.config.mjs).
 *
 * To add a module: create src/modules/<id>/ with pages/ (and optional widget.astro), add a definition
 * here, and add `{ id, enabled, navLabel, navOrder, homepageWidget }` to site.config.ts.
 */
export interface ModuleRoute { pattern: string; entrypoint: string } // entrypoint is relative to src/modules/<id>/
export interface ModuleDefinition { routes: ModuleRoute[]; widget?: string }

export const definitions: Record<string, ModuleDefinition> = {
  jobs: {
    routes: [
      { pattern: '/jobs', entrypoint: 'pages/index.astro' },
      { pattern: '/jobs/view', entrypoint: 'pages/view.astro' },
      { pattern: '/jobs/[id]', entrypoint: 'pages/[id].astro' },
      { pattern: '/saved', entrypoint: 'pages/saved.astro' },
    ],
  },
  companies: {
    routes: [
      { pattern: '/companies', entrypoint: 'pages/index.astro' },
      { pattern: '/companies/[slug]', entrypoint: 'pages/[slug].astro' },
    ],
  },
  about: { routes: [{ pattern: '/about', entrypoint: 'pages/index.astro' }] },
  feedback: { routes: [{ pattern: '/feedback', entrypoint: 'pages/index.astro' }] },
  insiders: {
    routes: [
      { pattern: '/insiders', entrypoint: 'pages/index.astro' },
      { pattern: '/insiders/share', entrypoint: 'pages/share.astro' },
    ],
    widget: 'widget.astro',
  },
  ads: { routes: [{ pattern: '/advertise', entrypoint: 'pages/advertise.astro' }], widget: 'widget.astro' },
  projects: { routes: [{ pattern: '/projects', entrypoint: 'pages/index.astro' }], widget: 'widget.astro' },
  books: { routes: [{ pattern: '/books', entrypoint: 'pages/index.astro' }], widget: 'widget.astro' },
  resources: { routes: [{ pattern: '/resources', entrypoint: 'pages/index.astro' }], widget: 'widget.astro' },
};
