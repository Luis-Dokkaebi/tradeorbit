#!/usr/bin/env bash
# Sensor NFR-05 / NFR-06: spins up a throwaway PostgreSQL cluster in a temp dir,
# applies supabase/migrations and runs supabase/tests/rls.sql. Removes only that temp dir.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PGBIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)"
if [ -z "$PGBIN" ] || [ ! -x "$PGBIN/initdb" ]; then
  echo "PostgreSQL no instalado: db-test omitido (no cuenta como verde)" >&2
  exit 3
fi

WORK="$(mktemp -d -t kiilonova-pg-XXXXXX)"
chmod 777 "$WORK"
PORT="${PGTEST_PORT:-55432}"
as_pg() { if [ "$(id -u)" = "0" ]; then su postgres -s /bin/bash -c "$1"; else bash -c "$1"; fi; }
cleanup() {
  as_pg "'$PGBIN/pg_ctl' -D '$WORK/data' -m immediate stop" >/dev/null 2>&1 || true
  case "$WORK" in /tmp/kiilonova-pg-*) rm -rf -- "$WORK" ;; esac
}
trap cleanup EXIT

as_pg "'$PGBIN/initdb' -D '$WORK/data' -U postgres -A trust" >/dev/null
as_pg "'$PGBIN/pg_ctl' -D '$WORK/data' -o \"-p $PORT -k $WORK -c listen_addresses=''\" -l '$WORK/log' -w start" >/dev/null
for f in "$ROOT"/supabase/migrations/*.sql "$ROOT/supabase/tests/rls.sql"; do cp "$f" "$WORK/"; done
chmod 644 "$WORK"/*.sql
for f in "$WORK"/0*.sql; do
  as_pg "psql -h '$WORK' -p $PORT -U postgres -d postgres -v ON_ERROR_STOP=1 -q -f '$f'"
done
as_pg "psql -h '$WORK' -p $PORT -U postgres -d postgres -v ON_ERROR_STOP=1 -q -f '$WORK/rls.sql'"
