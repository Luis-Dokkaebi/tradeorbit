import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export const ROOT = new URL('../../', import.meta.url).pathname;

/** Recursively lists files under `dir` whose name matches `pattern`, skipping vendor and build folders. */
export const walk = (dir, pattern, skip = ['node_modules', '.git', 'coverage', 'test-results', 'playwright-report']) => {
  const out = [];
  let entries = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (skip.includes(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full, pattern, skip));
    else if (pattern.test(name)) out.push(full);
  }
  return out;
};

export const rel = (file) => relative(ROOT, file);
export const read = (file) => readFileSync(file, 'utf8');

export const report = (name, problems) => {
  if (problems.length === 0) {
    process.stdout.write(`✓ ${name}\n`);
    return;
  }
  process.stderr.write(`✗ ${name}: ${problems.length} problema(s)\n${problems.map((p) => `  - ${p}`).join('\n')}\n`);
  process.exitCode = 1;
};
