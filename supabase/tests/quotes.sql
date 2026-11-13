-- Behaviour checks for quotes, supplies, towing and payments. Runs after rls.sql (reuses its t.* helpers).
truncate t.results;

\set e '''eeeeeeee-0000-0000-0000-000000000005'''
\set f '''ffffffff-0000-0000-0000-000000000006'''
\set s2 '''99999999-0000-0000-0000-000000000007'''

\o /dev/null
insert into auth.users(id, email) values (:e, 'e@example.com'), (:f, 'f@example.com'), (:s2, 's2@example.com');
insert into public.staff_roles(user_id, role) values (:s2, 'dispatcher');
insert into public.supply_items(sku, name, price) values ('BOX-L', 'Large box', 50), ('TAPE', 'Tape', 20);
insert into public.supply_items(sku, name, price, active) values ('OLD', 'Retired item', 10, false);
select id as box from public.supply_items where sku = 'BOX-L' \gset
select id as oldi from public.supply_items where sku = 'OLD' \gset

-- Customer E books a move and a tow
set role authenticated;
select set_config('request.jwt.claim.sub', :e, false);
insert into public.bookings(service, pickup_address) values ('supplies', 'E home');
insert into public.bookings(service, pickup_address) values ('towing', 'E roadside');
reset role;
select id as sup from public.bookings where customer_id = :e and service = 'supplies' \gset
select id as tow from public.bookings where customer_id = :e and service = 'towing' \gset

set role authenticated;
select set_config('request.jwt.claim.sub', :e, false);
-- Supplies
select t.expect_fail('customer cannot set supply unit_price', format($$insert into public.booking_supply_items(booking_id,item_id,quantity,unit_price) values (%L,%L,1,0.01)$$, :'sup', :'box'));
select t.expect_ok('customer can add supply line', format($$insert into public.booking_supply_items(booking_id,item_id,quantity) values (%L,%L,2)$$, :'sup', :'box'));
select t.expect_eq('supply unit price comes from catalogue', (select unit_price::text from public.booking_supply_items), '50.00');
select t.expect_fail('retired supply item cannot be ordered', format($$insert into public.booking_supply_items(booking_id,item_id,quantity) values (%L,%L,1)$$, :'sup', :'oldi'));
select t.expect_fail('supply quantity must be positive', format($$insert into public.booking_supply_items(booking_id,item_id,quantity) select %L, id, 0 from public.supply_items where sku = 'TAPE'$$, :'sup'));
select t.expect_eq('customer sees only active catalogue items', (select count(*) from public.supply_items)::text, '2');
select t.expect_fail('customer cannot edit catalogue', $$update public.supply_items set price = 1$$);
-- Towing
select t.expect_fail('towing details only on towing bookings', format($$insert into public.towing_details(booking_id, registration) values (%L, 'CA123456')$$, :'sup'));
select t.expect_ok('customer can add towing details', format($$insert into public.towing_details(booking_id, registration, vehicle_runs) values (%L, 'CA123456', false)$$, :'tow'));
-- Quotes and payments are not client-writable
select t.expect_fail('customer cannot insert a quote', format($$insert into public.quotes(booking_id, amount, valid_until) values (%L, 1, now() + interval '1 day')$$, :'sup'));
select t.expect_fail('customer cannot issue a quote', format($$select public.issue_quote(%L, 1000)$$, :'sup'));
select t.expect_fail('customer cannot insert a payment', format($$insert into public.payments(booking_id, provider_reference, amount) values (%L, 'ref-x', 1)$$, :'sup'));

-- Another customer sees none of it
select set_config('request.jwt.claim.sub', :f, false);
select t.expect_eq('other customer sees no supply lines', (select count(*) from public.booking_supply_items)::text, '0');
select t.expect_eq('other customer sees no towing details', (select count(*) from public.towing_details)::text, '0');
select t.expect_fail('other customer cannot add lines to my booking', format($$insert into public.booking_supply_items(booking_id,item_id,quantity) values (%L,%L,1)$$, :'sup', :'box'));

-- Staff issue a quote
select set_config('request.jwt.claim.sub', :s2, false);
select t.expect_fail('quote amount must be positive', format($$select public.issue_quote(%L, 0)$$, :'sup'));
select t.expect_fail('quote validity must be in the future', format($$select public.issue_quote(%L, 500, now() - interval '1 day')$$, :'sup'));
select t.expect_ok('staff can issue a quote', format($$select public.issue_quote(%L, 1500, now() + interval '3 days', 'incl. delivery')$$, :'sup'));
select t.expect_eq('issuing a quote moves booking to quoted', (select status::text from public.bookings where id = :'sup'), 'quoted');
select t.expect_eq('issuing a quote sets estimated_price', (select estimated_price::text from public.bookings where id = :'sup'), '1500.00');
reset role;
select id as q1 from public.quotes where booking_id = :'sup' \gset

set role authenticated;
select set_config('request.jwt.claim.sub', :e, false);
select t.expect_eq('customer sees own quote', (select count(*) from public.quotes)::text, '1');
select t.expect_fail('customer cannot add supply lines after quoting', format($$insert into public.booking_supply_items(booking_id,item_id,quantity) select %L, id, 1 from public.supply_items where sku = 'TAPE'$$, :'sup'));
select t.expect_fail('customer cannot edit a quote', $$update public.quotes set amount = 1$$);
select set_config('request.jwt.claim.sub', :f, false);
select t.expect_eq('other customer sees no quotes', (select count(*) from public.quotes)::text, '0');
select t.expect_fail('other customer cannot accept my quote', format($$select public.accept_quote(%L)$$, :'q1'));

-- Re-quoting supersedes the earlier quote
select set_config('request.jwt.claim.sub', :s2, false);
select t.expect_ok('staff can re-quote', format($$select public.issue_quote(%L, 1400)$$, :'sup'));
reset role;
select t.expect_eq('earlier quote expires on re-quote', (select status::text from public.quotes where id = :'q1'), 'expired');
select id as q2 from public.quotes where booking_id = :'sup' and status = 'sent' \gset
set role authenticated;
select set_config('request.jwt.claim.sub', :e, false);
select t.expect_fail('expired quote cannot be accepted', format($$select public.accept_quote(%L)$$, :'q1'));
select t.expect_ok('customer accepts current quote', format($$select public.accept_quote(%L)$$, :'q2'));
select t.expect_eq('accepting confirms the booking', (select status::text from public.bookings where id = :'sup'), 'confirmed');
select t.expect_eq('accepting sets final_price to quote amount', (select final_price::text from public.bookings where id = :'sup'), '1400.00');
select t.expect_fail('quote cannot be accepted twice', format($$select public.accept_quote(%L)$$, :'q2'));
reset role;

-- Past-validity quote cannot be accepted
set role authenticated;
select set_config('request.jwt.claim.sub', :s2, false);
select t.expect_ok('staff can quote the tow', format($$select public.issue_quote(%L, 900)$$, :'tow'));
reset role;
update public.quotes set valid_until = now() - interval '1 minute' where booking_id = :'tow';
select id as q3 from public.quotes where booking_id = :'tow' \gset
set role authenticated;
select set_config('request.jwt.claim.sub', :e, false);
select t.expect_fail('lapsed quote cannot be accepted', format($$select public.accept_quote(%L)$$, :'q3'));
reset role;

-- Payments: written by the server, readable by the owner only
insert into public.payments(booking_id, quote_id, provider_reference, amount, status, paid_at) values (:'sup', :'q2', 'PSK-123', 1400, 'succeeded', now());
select t.expect_fail('payment provider reference is unique', format($$insert into public.payments(booking_id, provider_reference, amount) values (%L, 'PSK-123', 1)$$, :'sup'));
set role authenticated;
select set_config('request.jwt.claim.sub', :e, false);
select t.expect_eq('customer sees own payment', (select count(*) from public.payments)::text, '1');
select t.expect_fail('customer cannot edit a payment', $$update public.payments set status = 'refunded'$$);
select set_config('request.jwt.claim.sub', :f, false);
select t.expect_eq('other customer sees no payments', (select count(*) from public.payments)::text, '0');
reset role;
set role anon;
select t.expect_fail('anon cannot read quotes', $$select * from public.quotes$$);
select t.expect_fail('anon cannot read payments', $$select * from public.payments$$);
reset role;

select t.expect_eq('quotes and payments in realtime publication', (select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and tablename in ('quotes','payments'))::text, '2');

\o
select (case when ok then 'PASS' else 'FAIL' end) as result, name, coalesce(detail, '') as detail from t.results order by ok, name;
select count(*) filter (where not ok) as failures, count(*) as total, (count(*) filter (where not ok) > 0) as has_failures from t.results \gset
\if :has_failures
  \echo :failures of :total checks failed
  \quit 3
\else
  \echo all :total quote/payment checks passed
\endif
