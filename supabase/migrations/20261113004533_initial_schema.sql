-- Iverson initial schema. Customer-owned rows are protected by RLS.
create extension if not exists pgcrypto;
create type public.booking_service as enum ('moving','supplies','towing');
create type public.booking_status as enum ('requested','quoted','confirmed','assigned','in_progress','completed','cancelled');
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text, phone text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.bookings (
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references auth.users(id) on delete restrict,
 service public.booking_service not null, status public.booking_status not null default 'requested',
 pickup_address text not null, destination_address text, scheduled_at timestamptz, notes text,
 estimated_price numeric(12,2), final_price numeric(12,2),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.booking_events (
 id uuid primary key default gen_random_uuid(), booking_id uuid not null references public.bookings(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null, status public.booking_status not null,
 message text, created_at timestamptz not null default now()
);
create table public.driver_locations (
 id uuid primary key default gen_random_uuid(), booking_id uuid not null references public.bookings(id) on delete cascade,
 driver_id uuid not null references auth.users(id) on delete cascade,
 latitude double precision not null check (latitude between -90 and 90),
 longitude double precision not null check (longitude between -180 and 180),
 recorded_at timestamptz not null default now()
);
create index bookings_customer_created_idx on public.bookings(customer_id, created_at desc);
create index booking_events_booking_created_idx on public.booking_events(booking_id, created_at desc);
create index driver_locations_booking_recorded_idx on public.driver_locations(booking_id, recorded_at desc);
alter table public.profiles enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_events enable row level security;
alter table public.driver_locations enable row level security;
create policy "Customers can read own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "Customers can insert own profile" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "Customers can update own profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "Customers can read own bookings" on public.bookings for select to authenticated using ((select auth.uid()) = customer_id);
create policy "Customers can create own bookings" on public.bookings for insert to authenticated with check ((select auth.uid()) = customer_id);
create policy "Customers can update own requested bookings" on public.bookings for update to authenticated using ((select auth.uid()) = customer_id and status = 'requested') with check ((select auth.uid()) = customer_id and status = 'requested');
create policy "Customers can read events for own bookings" on public.booking_events for select to authenticated using (exists (select 1 from public.bookings b where b.id = booking_id and b.customer_id = (select auth.uid())));
create policy "Customers can read latest location for own bookings" on public.driver_locations for select to authenticated using (exists (select 1 from public.bookings b where b.id = booking_id and b.customer_id = (select auth.uid())));
-- Add a server-managed staff/driver role model and narrowly scoped staff policies before enabling operations writes.
