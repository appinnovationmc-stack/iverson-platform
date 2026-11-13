-- Behaviour checks for the booking schema. Run after stubs.sql and all migrations.
create schema t;
create table t.results (name text primary key, ok boolean not null, detail text);
grant usage on schema t to public;
grant insert on t.results to public;

create function t.expect_fail(name text, stmt text) returns void language plpgsql as $$
begin
  begin execute stmt; insert into t.results values (name, false, 'statement was allowed');
  exception when others then insert into t.results values (name, true, sqlerrm); end;
end $$;
create function t.expect_ok(name text, stmt text) returns void language plpgsql as $$
begin
  begin execute stmt; insert into t.results values (name, true, null);
  exception when others then insert into t.results values (name, false, sqlerrm); end;
end $$;
create function t.expect_eq(name text, actual text, expected text) returns void language plpgsql as $$
begin insert into t.results values (name, actual is not distinct from expected, 'got ' || coalesce(actual, 'null') || ', want ' || expected); end $$;
grant execute on all functions in schema t to public;

\set a '''aaaaaaaa-0000-0000-0000-000000000001'''
\set b '''bbbbbbbb-0000-0000-0000-000000000002'''
\set s '''cccccccc-0000-0000-0000-000000000003'''
\set d '''dddddddd-0000-0000-0000-000000000004'''

-- Setup as superuser. The signup trigger should create profiles.
insert into auth.users(id, email, raw_user_meta_data) values
  (:a, 'a@example.com', '{"full_name":"Alice"}'), (:b, 'b@example.com', '{}'),
  (:s, 's@example.com', '{}'), (:d, 'd@example.com', '{}');
select t.expect_eq('signup creates profile', (select count(*) from public.profiles)::text, '4');
insert into public.staff_roles(user_id, role) values (:s, 'dispatcher'), (:d, 'driver');

\o /dev/null
-- Customer A
set role authenticated;
select set_config('request.jwt.claim.sub', :a, false);
select t.expect_fail('customer cannot set final_price', $$insert into public.bookings(service,pickup_address,final_price) values ('moving','x',1)$$);
select t.expect_fail('customer cannot set status', $$insert into public.bookings(service,pickup_address,status) values ('moving','x','completed')$$);
select t.expect_fail('customer cannot set customer_id', format($$insert into public.bookings(service,pickup_address,customer_id) values ('moving','x',%L)$$, 'bbbbbbbb-0000-0000-0000-000000000002'));
select t.expect_fail('customer cannot set driver_id', format($$insert into public.bookings(service,pickup_address,driver_id) values ('moving','x',%L)$$, 'dddddddd-0000-0000-0000-000000000004'));
select t.expect_ok('customer can request a booking', $$insert into public.bookings(service,pickup_address,destination_address) values ('moving','14 Jacaranda St','22 Bree St')$$);
select t.expect_eq('booking gets IHL reference', (select (reference ~ '^IHL-[0-9]+$')::text from public.bookings), 'true');
select t.expect_fail('customer cannot edit estimated_price', $$update public.bookings set estimated_price = 1$$);
select t.expect_fail('customer cannot edit status', $$update public.bookings set status = 'completed'$$);
select t.expect_fail('customer cannot delete bookings', $$delete from public.bookings$$);
select t.expect_eq('status event logged on insert', (select count(*) from public.booking_events)::text, '1');

-- Customer B cannot see or cancel A's booking
select set_config('request.jwt.claim.sub', :b, false);
select t.expect_eq('other customer sees no bookings', (select count(*) from public.bookings)::text, '0');
select t.expect_eq('other customer sees no events', (select count(*) from public.booking_events)::text, '0');
select t.expect_fail('other customer cannot cancel', $$select public.cancel_booking((select id from (select id from public.bookings union all select id from public.bookings) x limit 1))$$);

-- Anonymous users have no access
reset role;
set role anon;
select t.expect_fail('anon cannot read bookings', $$select * from public.bookings$$);
select t.expect_fail('anon cannot read driver locations', $$select * from public.driver_locations$$);
reset role;

select id as bk from public.bookings limit 1 \gset

-- Dispatch: assign a driver and move to in_progress (service role path)
update public.bookings set driver_id = :d, status = 'in_progress';

-- Driver posts location
set role authenticated;
select set_config('request.jwt.claim.sub', :d, false);
select t.expect_ok('driver can post location for assigned booking', $$insert into public.driver_locations(booking_id, driver_id, latitude, longitude) select id, auth.uid(), -25.7, 28.2 from public.bookings$$);
select t.expect_fail('driver cannot post as someone else', $$insert into public.driver_locations(booking_id, driver_id, latitude, longitude) select id, 'aaaaaaaa-0000-0000-0000-000000000001', -25.7, 28.2 from public.bookings$$);
select set_config('request.jwt.claim.sub', :b, false);
select t.expect_fail('non-assigned user cannot post location', format($$insert into public.driver_locations(booking_id, driver_id, latitude, longitude) values (%L, auth.uid(), -25.7, 28.2)$$, :'bk'));

-- Customer sees recent location only while the booking is active
select set_config('request.jwt.claim.sub', :a, false);
select t.expect_eq('customer sees live location', (select count(*) from public.driver_locations)::text, '1');
reset role;
update public.driver_locations set recorded_at = now() - interval '2 hours';
set role authenticated;
select set_config('request.jwt.claim.sub', :a, false);
select t.expect_eq('customer cannot see location older than 1 hour', (select count(*) from public.driver_locations)::text, '0');
reset role;
update public.driver_locations set recorded_at = now();
update public.bookings set status = 'completed';
set role authenticated;
select set_config('request.jwt.claim.sub', :a, false);
select t.expect_eq('customer cannot see location after completion', (select count(*) from public.driver_locations)::text, '0');
select t.expect_fail('customer cannot cancel completed booking', $$select public.cancel_booking((select id from public.bookings))$$);

-- Staff see everything
select set_config('request.jwt.claim.sub', :s, false);
select t.expect_eq('staff sees all bookings', (select count(*) from public.bookings)::text, '1');
select t.expect_eq('staff sees all driver locations', (select count(*) from public.driver_locations)::text, '1');
select t.expect_eq('staff_roles is invisible to clients', (select count(*) from public.staff_roles)::text, '0');
select t.expect_fail('clients cannot grant themselves a role', $$insert into public.staff_roles(user_id, role) values (auth.uid(), 'admin')$$);

-- Internal functions are not callable by clients
select set_config('request.jwt.claim.sub', :a, false);
select t.expect_fail('client cannot run purge_driver_locations', $$select public.purge_driver_locations()$$);
select t.expect_fail('client cannot call handle_new_user', $$select public.handle_new_user()$$);
reset role;

-- Cancel flow on a fresh booking
insert into public.bookings(customer_id, service, pickup_address) values (:a, 'towing', 'N1 off-ramp');
set role authenticated;
select set_config('request.jwt.claim.sub', :a, false);
select t.expect_ok('customer can cancel own requested booking', $$select public.cancel_booking((select id from public.bookings where service = 'towing'))$$);
select t.expect_eq('cancelled status stored', (select status::text from public.bookings where service = 'towing'), 'cancelled');
select t.expect_eq('cancel logged as event', (select count(*) from public.booking_events e join public.bookings b on b.id = e.booking_id where b.service = 'towing')::text, '2');
reset role;

-- Realtime publication
select t.expect_eq('bookings in realtime publication', (select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and tablename in ('bookings','booking_events','driver_locations'))::text, '3');

-- Purge works for the service side
update public.driver_locations set recorded_at = now() - interval '45 days';
select t.expect_eq('purge removes old locations', public.purge_driver_locations()::text, '1');

-- Erasure: deleting the user keeps bookings, unlinked
delete from auth.users where id = :a;
select t.expect_eq('erasure keeps bookings', (select count(*) from public.bookings)::text, '2');
select t.expect_eq('erasure unlinks customer', (select count(*) from public.bookings where customer_id is not null)::text, '0');
select t.expect_eq('erasure removes profile', (select count(*) from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001')::text, '0');

-- Report
\o
select (case when ok then 'PASS' else 'FAIL' end) as result, name, coalesce(detail, '') as detail from t.results order by ok, name;
select count(*) filter (where not ok) as failures, count(*) as total, (count(*) filter (where not ok) > 0) as has_failures from t.results \gset
\if :has_failures
  \echo :failures of :total checks failed
  \quit 3
\else
  \echo all :total checks passed
\endif
