#!/usr/bin/env bash
# Applies stubs + migrations to a scratch database and runs the behaviour checks.
# Usage: DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres tests/run.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
base="${DATABASE_URL:?set DATABASE_URL to a superuser connection}"
db="iverson_test"
admin() { psql "$base" -v ON_ERROR_STOP=1 -q "$@"; }
admin -c "drop database if exists $db" -c "create database $db"
url="${base%/*}/$db"
psql "$url" -v ON_ERROR_STOP=1 -q -f "$here/stubs.sql"
for f in $(ls "$here"/../migrations/*.sql | sort); do
  echo "applying $(basename "$f")"
  psql "$url" -v ON_ERROR_STOP=1 -q -1 -f "$f"
done
psql "$url" -v ON_ERROR_STOP=1 -q -f "$here/rls.sql"
