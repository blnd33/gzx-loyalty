#!/usr/bin/env bash
# Runs the database test-suite against a throwaway local PostgreSQL database.
# Usage: bash supabase/tests/run-local.sh   (needs a local PostgreSQL superuser via `psql`)
set -eo pipefail
cd "$(dirname "$0")/.."
DB=${TEST_DB:-gzx_loyalty_test}
PSQL=${PSQL:-psql}
$PSQL -q -c "drop database if exists $DB" postgres >/dev/null
$PSQL -q -c "create database $DB" postgres >/dev/null
run() { $PSQL -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1" >/dev/null; }
run tests/00_local_supabase_stub.sql
for f in migrations/*.sql; do run "$f"; done
$PSQL -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/10_loyalty_tests.sql 2>&1 | grep -v "^$"
bash tests/20_concurrency_test.sh "$DB"
echo "ALL DATABASE TESTS PASSED"
