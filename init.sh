#!/usr/bin/env bash
# Starts the environment and runs the smoke checks. First step of every agent session.
set -euo pipefail
cd "$(dirname "$0")"

echo "== Kiilonova Trade · init =="
node --version
if [ ! -d node_modules ]; then npm ci; fi
git config core.hooksPath .githooks

echo "== check (typecheck · lint · secretos · tokens · feature_list) =="
npm run --silent check
echo "== test (unitarias + integración) =="
npm run --silent test

echo "== estado del harness =="
node -e '
const f = require("./feature_list.json").features;
const done = f.filter((x) => x.passes).length;
console.log(`feature_list: ${done}/${f.length} criterios en verde`);
const next = f.filter((x) => !x.passes).sort((a, b) => a.priority.localeCompare(b.priority))[0];
console.log(next ? `Siguiente pendiente: ${next.id} (${next.priority}) — ${next.criterion}` : "Sin pendientes");
'
echo "Listo. Lee CLAUDE.md, claude-progress.md y git log antes de elegir una tarea."
