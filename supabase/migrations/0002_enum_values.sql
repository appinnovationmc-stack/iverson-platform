-- New booking statuses for the tracking flow. Kept in its own migration because
-- Postgres cannot use a new enum value in the transaction that adds it.
alter type public.booking_status add value if not exists 'packed';
alter type public.booking_status add value if not exists 'loaded';
alter type public.booking_status add value if not exists 'out_for_delivery';
