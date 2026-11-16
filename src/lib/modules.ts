import { modules, type ModuleId } from '@site';
/** True when a module is switched on in site.config.ts. */
export const isEnabled = (id: ModuleId) => modules.some((m) => m.id === id && m.enabled);
