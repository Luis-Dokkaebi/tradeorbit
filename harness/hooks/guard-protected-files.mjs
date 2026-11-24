#!/usr/bin/env node
// Claude Code PreToolUse hook (Edit|Write|MultiEdit).
// - Blocks any agent write to the constitution (specs/constitution.md).
// - Allows writes to feature_list.json only when nothing but "passes" changes.
// Exit code 2 blocks the tool call and shows stderr to the agent.
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '../..'));
const CONSTITUTION = 'specs/constitution.md';
const FEATURE_LIST = 'feature_list.json';

const block = (msg) => {
  process.stderr.write(`[harness] BLOQUEADO: ${msg}\n`);
  process.exit(2);
};

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    block('entrada del hook ilegible (falla cerrado).');
  }
  const tool = input.tool_name ?? '';
  const ti = input.tool_input ?? {};
  if (typeof ti.file_path !== 'string' || ti.file_path.length === 0) process.exit(0);
  // Resolve symlinks (existing file or its parent) so an alias cannot bypass the guard.
  const target = resolve(ti.file_path);
  let real = target;
  try {
    real = existsSync(target) ? realpathSync(target) : resolve(realpathSync(dirname(target)), target.split(/[\\/]/).pop());
  } catch {
    real = target;
  }
  const file = relative(ROOT, real).toLowerCase() === CONSTITUTION ? CONSTITUTION : relative(ROOT, real);

  if (file === CONSTITUTION) block('la constitución solo la modifica una persona (principio de gobierno del harness).');
  if (file !== FEATURE_LIST) process.exit(0);

  const before = existsSync(resolve(ROOT, FEATURE_LIST)) ? readFileSync(resolve(ROOT, FEATURE_LIST), 'utf8') : null;
  let after = null;
  if (tool === 'Write') after = ti.content ?? '';
  else if (tool === 'Edit' && before !== null) after = ti.replace_all ? before.split(ti.old_string).join(ti.new_string) : before.replace(ti.old_string, () => ti.new_string);
  else if (tool === 'MultiEdit' && before !== null) after = (ti.edits ?? []).reduce((acc, e) => acc.replace(e.old_string, () => e.new_string), before);
  else if (before !== null) block(`herramienta ${tool} no soportada para ${FEATURE_LIST} (falla cerrado).`);
  if (before === null || after === null) process.exit(0);

  const strip = (text) => {
    const doc = JSON.parse(text);
    return JSON.stringify({ ...doc, features: (doc.features ?? []).map(({ passes: _p, ...rest }) => rest) });
  };
  try {
    if (strip(before) !== strip(after)) block('en feature_list.json el agente solo puede cambiar el campo "passes".');
  } catch {
    block('feature_list.json quedaría como JSON inválido.');
  }
  process.exit(0);
});
