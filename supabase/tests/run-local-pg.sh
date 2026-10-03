#!/usr/bin/env bash
# Sadə (lokal) PostgreSQL-də miqrasiya + RLS testlərini işə salır.
# Tələb: postgresql quraşdırılıb və cari istifadəçi superuser-dir (məs. `sudo -u postgres`-la işlədin).
# Real Supabase-də isə `supabase test db` və ya SQL redaktorundan istifadə edin.
set -euo pipefail
DB="${TEST_DB:-rls_test}"
HERE="$(cd "$(dirname "$0")" && pwd)"
psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists ${DB}" -c "create database ${DB}"
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$HERE/00_stub_supabase.sql"
for f in "$HERE"/../migrations/*.sql; do psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$f"; done
psql -v ON_ERROR_STOP=1 -d "$DB" -f "$HERE/rls_smoke.sql" 2>&1 | grep -E "PASS|FAIL|ERROR|BÜTÜN" 
psql -q -d postgres -c "drop database if exists ${DB}"
