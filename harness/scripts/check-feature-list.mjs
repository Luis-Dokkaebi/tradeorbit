// Guide + state sensor: feature_list.json keeps its shape, and only `passes` may change relative to HEAD.
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { ROOT, read, report } from './lib.mjs';

const FILE = 'feature_list.json';
const problems = [];
let current;
try {
  current = JSON.parse(read(join(ROOT, FILE)));
} catch (e) {
  report('check-feature-list', [`${FILE} no es JSON válido: ${e.message}`]);
  process.exit(1);
}

const REQUIRED = ['id', 'story', 'priority', 'criterion', 'verification', 'passes'];
if (!Array.isArray(current.features)) problems.push('falta el arreglo "features"');
const ids = new Set();
for (const f of current.features ?? []) {
  for (const k of REQUIRED) if (!(k in f)) problems.push(`${f.id ?? '?'}: falta "${k}"`);
  if (typeof f.passes !== 'boolean') problems.push(`${f.id}: "passes" debe ser booleano`);
  if (ids.has(f.id)) problems.push(`${f.id}: id duplicado`);
  ids.add(f.id);
}

const stripPasses = (doc) => JSON.stringify({ ...doc, features: (doc.features ?? []).map(({ passes: _p, ...rest }) => rest) });
let head = null;
try {
  head = JSON.parse(execFileSync('git', ['show', `HEAD:${FILE}`], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
} catch {
  head = null; // first commit of the file
}
if (head && process.env.ALLOW_FEATURE_LIST_EDIT !== '1' && stripPasses(head) !== stripPasses(current)) {
  problems.push('se modificaron campos distintos de "passes" (solo una persona puede cambiar criterios: ALLOW_FEATURE_LIST_EDIT=1)');
}
report('check-feature-list', problems);
