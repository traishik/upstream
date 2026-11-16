/**
 * Rule-based classifier. All rules live in config/classifier.yaml. This file only applies them.
 * Three independent axes: function, level, employment type, plus the frontline flag.
 */
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { EmploymentType, Level } from './types.ts';

type RuleRow = [string, string];
interface ClassifierYaml {
  functions: { id: string; label: string }[];
  levels: { id: Level; label: string }[];
  functionRules: RuleRow[];
  levelRules: RuleRow[];
  icManagerTitles: string;
  companyLevelOverrides: Record<string, { companies: string[]; rules: RuleRow[] }>;
  employmentRules: RuleRow[];
  frontlineRules: string;
}

const compile = (rows: RuleRow[]) => rows.map(([id, re]) => ({ id, re: new RegExp(re, 'i') }));

export class Classifier {
  readonly functions: { id: string; label: string }[];
  readonly levels: { id: Level; label: string }[];
  private fnRules;
  private lvRules;
  private icManager: RegExp;
  private overrides: { companies: Set<string>; rules: { id: string; re: RegExp }[] }[];
  private empRules;
  private frontline: RegExp;

  constructor(cfg: ClassifierYaml) {
    this.functions = cfg.functions;
    this.levels = cfg.levels;
    this.fnRules = compile(cfg.functionRules);
    this.lvRules = compile(cfg.levelRules);
    this.icManager = new RegExp(cfg.icManagerTitles, 'i');
    this.overrides = Object.values(cfg.companyLevelOverrides ?? {}).map((o) => ({ companies: new Set(o.companies), rules: compile(o.rules) }));
    this.empRules = compile(cfg.employmentRules);
    this.frontline = new RegExp(cfg.frontlineRules, 'i');
  }

  static load(path = new URL('../config/classifier.yaml', import.meta.url)) {
    return new Classifier(parse(readFileSync(path, 'utf8')) as ClassifierYaml);
  }

  /** Returns the function id; `other` when nothing matched (and `matched: false` for the report). */
  fn(title: string, hints: string[] = []): { id: string; matched: boolean } {
    for (const r of this.fnRules) if (r.re.test(title)) return { id: r.id, matched: true };
    for (const h of hints) for (const r of this.fnRules) if (r.re.test(h)) return { id: r.id, matched: true };
    return { id: 'other', matched: false };
  }

  level(title: string, company?: string, hints: string[] = []): Level {
    const t = title.replace(/[–—]/g, '-');
    const intern = this.lvRules.find((r) => r.id === 'internship');
    if (intern?.re.test(t)) return 'internship';
    if (company) {
      for (const o of this.overrides) {
        if (!o.companies.has(company)) continue;
        for (const r of o.rules) if (r.re.test(t)) return r.id as Level;
      }
    }
    if (hints.some((h) => /^intern$/i.test(h))) return 'internship';
    const ic = this.icManager.test(t);
    for (const r of this.lvRules) {
      // "Product Manager", "Account Manager"… are individual contributors, not people managers.
      if (ic && r.id === 'manager') continue;
      if (r.re.test(t)) return r.id as Level;
    }
    return 'mid';
  }

  employment(title: string, raw?: string): EmploymentType {
    const text = `${title} ${raw ?? ''}`;
    for (const r of this.empRules) if (r.re.test(text)) return r.id as EmploymentType;
    return 'full-time';
  }

  isFrontline(title: string): boolean {
    return this.frontline.test(title);
  }
}
