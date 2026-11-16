import type { Fetcher, SourceType } from '../types.ts';
import { greenhouse } from './greenhouse.ts';
import { lever } from './lever.ts';
import { ashby } from './ashby.ts';
import { workday } from './workday.ts';
import { amazon } from './amazon.ts';
import { oracle } from './oracle.ts';
import { tiktok, amd, rippling, apple } from './others.ts';

/** One fetcher per source type. Adding a company on an existing source is config-only. */
export const fetchers: Partial<Record<SourceType, Fetcher>> = {
  greenhouse, lever, ashby, workday, amazon, oracle, tiktok, amd, rippling, apple,
};
