import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import es from './es.json';
import en from './en.json';
import zh from './zh.json';
import { translate } from './index';

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const full = join(dir, n);
    return statSync(full).isDirectory() ? walk(full) : /\.tsx?$/.test(n) && !n.endsWith('.test.ts') ? [full] : [];
  });

describe('translations (NFR-07)', () => {
  const keys = Object.keys(es).sort();

  it('English and Chinese have exactly the Spanish keys, none empty', () => {
    expect(Object.keys(en).sort()).toEqual(keys);
    expect(Object.keys(zh).sort()).toEqual(keys);
    for (const dict of [es, en, zh]) for (const v of Object.values(dict)) expect(v.trim().length).toBeGreaterThan(0);
  });

  it('every literal key used in the UI exists in es.json', () => {
    const used = new Set<string>();
    for (const file of walk(join(__dirname, '..', 'ui'))) {
      for (const m of readFileSync(file, 'utf8').matchAll(/\bt\('([a-zA-Z0-9_.]+)'\)/g)) if (m[1]) used.add(m[1]);
    }
    expect(used.size).toBeGreaterThan(50);
    expect([...used].filter((k) => !(k in es))).toEqual([]);
  });

  it('Spanish is the default and fallback', () => {
    expect(translate('es', 'pay.submit')).toBe('Enviar a aprobación');
    expect(translate('en', 'pay.submit')).toBe('Send for approval');
  });

  it('no translation calls the action "pay" (principle 1)', () => {
    expect(es['pay.submit']).not.toMatch(/^Pagar/);
    expect(en['pay.submit']).not.toMatch(/^Pay/);
  });
});
