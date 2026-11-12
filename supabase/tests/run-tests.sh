#!/usr/bin/env bash
# Runs the migration plus the access-rule tests on a throwaway Postgres in Docker.
set -euo pipefail
cd "$(dirname "$0")/.."
name=estamp-sql-test
docker rm -f "$name" >/dev/null 2>&1 || true
docker run -d --name "$name" -e POSTGRES_PASSWORD=x postgres:16-alpine >/dev/null
trap 'docker rm -f "$name" >/dev/null' EXIT
until docker exec "$name" pg_isready -U postgres -q; do sleep 0.5; done
sleep 1
run() { docker exec -i "$name" psql -q -v ON_ERROR_STOP=1 -U postgres -d postgres; }
run < tests/supabase-stub.sql
cat migrations/*.sql | run
run < tests/rls.test.sql
