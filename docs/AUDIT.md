# Audit notes (commit 506ac71)

Fixed on branch `fix/audit-foundation`:

- Web build failure: react/react-dom version mismatch. Both apps now pin 19.1.0, with root overrides. Lockfile committed.
- Customers could set price/status on bookings. Column-level grants now limit inserts and updates; cancelling goes through `cancel_booking()`.
- Driver location trail visible forever. Customers now see only the last hour while the booking is active; `purge_driver_locations()` added for retention.
- Account erasure blocked by `on delete restrict`. Now `set null`.
- Added: staff/driver roles, booking reference (IHL-xxxxx), driver_id, updated_at and status-event triggers, profile-on-signup trigger, realtime publication, anon revokes.
- .gitignore now covers `.env.*`, build info and native folders.

Still open: connect Supabase in both apps, auth, real booking flow, rebuild UI to the approved designs, supplies/towing/payment/quote tables, payments gateway, driver app and GPS, ESLint/Prettier/tests/CI, POPIA documents, Expo dev-tool dependency advisories.

Migrations were applied and behaviour-tested against PostgreSQL 16 with Supabase role/auth stubs, not against a live Supabase project. Re-test on a staging project before production.
