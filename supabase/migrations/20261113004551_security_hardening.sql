-- Hardening after audit of 0001. Closes customer price/status tampering, adds roles,
-- limits driver-location exposure, fixes account erasure, adds triggers and realtime.

-- 1. Roles ---------------------------------------------------------------
create type public.staff_role as enum ('admin','dispatcher','driver');
create table public.staff_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.staff_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);
alter table public.staff_roles enable row level security;
-- No policies: only the service role (server-side) manages roles.

create function public.has_role(r public.staff_role) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff_roles where user_id = (select auth.uid()) and role = r);
$$;
create function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff_roles where user_id = (select auth.uid()) and role in ('admin','dispatcher'));
$$;
revoke execute on function public.has_role(public.staff_role), public.is_staff() from public, anon;
grant execute on function public.has_role(public.staff_role), public.is_staff() to authenticated;

-- 2. Bookings: reference, driver, erasure-safe owner ------------------------
create sequence public.booking_ref_seq start 20001;
alter table public.bookings
  add column reference text unique not null default ('IHL-' || nextval('public.booking_ref_seq')::text),
  add column driver_id uuid references auth.users(id) on delete set null;
alter table public.bookings alter column customer_id set default auth.uid();
alter table public.bookings alter column customer_id drop not null;
alter table public.bookings drop constraint bookings_customer_id_fkey;
alter table public.bookings add constraint bookings_customer_id_fkey
  foreign key (customer_id) references auth.users(id) on delete set null;
create index bookings_driver_idx on public.bookings(driver_id) where driver_id is not null;

-- 3. Stop customers writing status, prices, owner or driver --------------------
revoke insert, update, delete on public.bookings from authenticated;
grant insert (service, pickup_address, destination_address, scheduled_at, notes) on public.bookings to authenticated;
grant update (pickup_address, destination_address, scheduled_at, notes) on public.bookings to authenticated;
-- Existing policies still apply: insert needs customer_id = auth.uid() (set by default),
-- update only while status = 'requested'.

-- Customers cancel through a function, never by writing status directly.
create function public.cancel_booking(p_booking_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.bookings set status = 'cancelled'
  where id = p_booking_id and customer_id = (select auth.uid())
    and status in ('requested','quoted','confirmed');
  if not found then raise exception 'Booking cannot be cancelled'; end if;
end $$;
revoke execute on function public.cancel_booking(uuid) from public, anon;
grant execute on function public.cancel_booking(uuid) to authenticated;

-- 4. Triggers -------------------------------------------------------------
create function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger bookings_touch before update on public.bookings for each row execute function public.touch_updated_at();

create function public.log_booking_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.booking_events (booking_id, actor_id, status) values (new.id, (select auth.uid()), new.status);
  end if;
  return new;
end $$;
create trigger bookings_log_status after insert or update of status on public.bookings
  for each row execute function public.log_booking_status();

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.phone)
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5. Staff and driver read/write policies -------------------------------------
create policy "Staff can read all bookings" on public.bookings for select to authenticated using (public.is_staff());
create policy "Drivers can read assigned bookings" on public.bookings for select to authenticated using (driver_id = (select auth.uid()));
create policy "Staff can read all events" on public.booking_events for select to authenticated using (public.is_staff());
create policy "Staff can read all driver locations" on public.driver_locations for select to authenticated using (public.is_staff());
create policy "Drivers can post location for active assigned bookings" on public.driver_locations for insert to authenticated
  with check (
    driver_id = (select auth.uid())
    and exists (select 1 from public.bookings b where b.id = booking_id and b.driver_id = (select auth.uid())
      and b.status in ('assigned','in_progress','packed','loaded','out_for_delivery'))
  );
-- Staff writes (quotes, prices, assignment, status) go through server code using the
-- service role or dedicated security-definer functions, not direct client updates.

-- 6. Driver location privacy -------------------------------------------------
drop policy "Customers can read latest location for own bookings" on public.driver_locations;
create policy "Customers can read recent location while booking is active" on public.driver_locations for select to authenticated
  using (
    recorded_at > now() - interval '1 hour'
    and exists (select 1 from public.bookings b where b.id = booking_id and b.customer_id = (select auth.uid())
      and b.status in ('assigned','in_progress','packed','loaded','out_for_delivery'))
  );

create function public.purge_driver_locations(retain interval default interval '30 days') returns bigint
language plpgsql security definer set search_path = '' as $$
declare n bigint;
begin
  delete from public.driver_locations where recorded_at < now() - retain;
  get diagnostics n = row_count; return n;
end $$;
revoke execute on function public.purge_driver_locations(interval) from public, anon, authenticated;
-- Schedule daily with pg_cron or a Supabase scheduled function.

-- 7. Defence in depth + realtime -------------------------------------------
revoke all on public.profiles, public.bookings, public.booking_events, public.driver_locations, public.staff_roles from anon;
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.bookings, public.booking_events, public.driver_locations;
  end if;
end $$;
