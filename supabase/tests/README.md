# Database behaviour checks

`run.sh` creates a scratch database, loads `stubs.sql` (stand-ins for Supabase's roles,
`auth.users`, `auth.uid()` and the realtime publication), applies every migration in
order, then runs `rls.sql`. It exits non-zero if any check fails.

    DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres supabase/tests/run.sh

These checks run against a stand-in, not Supabase itself. Re-run the key ones on the live
project (inside a rolled-back transaction) after any migration that touches policies.
