-- Quotes, moving supplies, towing details and payments.
-- Clients never write prices or payments directly: staff issue quotes through
-- issue_quote(), customers accept through accept_quote(), and payments are
-- written by server code (service role) from the payment provider's webhook.

create type public.quote_status as enum ('sent', 'accepted', 'declined', 'expired');
create type public.payment_status as enum ('pending', 'succeeded', 'failed', 'refunded');

-- 1. Quotes ------------------------------------------------------------------
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'ZAR' check (currency ~ '^[A-Z]{3}$'),
  status public.quote_status not null default 'sent',
  valid_until timestamptz not null,
  notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
create index quotes_booking_idx on public.quotes(booking_id, created_at desc);
create unique index quotes_one_accepted_idx on public.quotes(booking_id) where status = 'accepted';
alter table public.quotes enable row level security;
revoke all on public.quotes from anon, authenticated;
grant select on public.quotes to authenticated;
create policy "Customers can read quotes for own bookings" on public.quotes for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id and b.customer_id = (select auth.uid())));
create policy "Staff can read all quotes" on public.quotes for select to authenticated using (public.is_staff());

create function public.issue_quote(
  p_booking_id uuid, p_amount numeric, p_valid_until timestamptz default now() + interval '7 days', p_notes text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare q uuid;
begin
  if not public.is_staff() then raise exception 'Not allowed'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be positive'; end if;
  if p_valid_until <= now() then raise exception 'Quote must be valid in the future'; end if;
  perform 1 from public.bookings where id = p_booking_id and status in ('requested', 'quoted') for update;
  if not found then raise exception 'Booking cannot be quoted'; end if;
  update public.quotes set status = 'expired', responded_at = now() where booking_id = p_booking_id and status = 'sent';
  insert into public.quotes (booking_id, amount, valid_until, notes) values (p_booking_id, p_amount, p_valid_until, p_notes) returning id into q;
  update public.bookings set status = 'quoted', estimated_price = p_amount where id = p_booking_id;
  return q;
end $$;
revoke execute on function public.issue_quote(uuid, numeric, timestamptz, text) from public, anon;
grant execute on function public.issue_quote(uuid, numeric, timestamptz, text) to authenticated;

create function public.accept_quote(p_quote_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare bk uuid; amt numeric;
begin
  select q.booking_id, q.amount into bk, amt
    from public.quotes q join public.bookings b on b.id = q.booking_id
   where q.id = p_quote_id and b.customer_id = (select auth.uid())
     and q.status = 'sent' and q.valid_until > now() and b.status = 'quoted'
   for update of q, b;
  if not found then raise exception 'Quote cannot be accepted'; end if;
  update public.quotes set status = 'accepted', responded_at = now() where id = p_quote_id;
  update public.bookings set status = 'confirmed', final_price = amt where id = bk;
end $$;
revoke execute on function public.accept_quote(uuid) from public, anon;
grant execute on function public.accept_quote(uuid) to authenticated;

-- 2. Moving supplies -----------------------------------------------------------
create table public.supply_items (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null,
  name text not null,
  price numeric(12,2) not null check (price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.supply_items enable row level security;
revoke all on public.supply_items from anon, authenticated;
grant select on public.supply_items to authenticated;
create policy "Signed-in users can read active supply items" on public.supply_items for select to authenticated using (active or public.is_staff());

create table public.booking_supply_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  item_id uuid not null references public.supply_items(id),
  quantity integer not null check (quantity between 1 and 1000),
  unit_price numeric(12,2) not null,
  created_at timestamptz not null default now(),
  unique (booking_id, item_id)
);
create index booking_supply_items_booking_idx on public.booking_supply_items(booking_id);
alter table public.booking_supply_items enable row level security;
revoke all on public.booking_supply_items from anon, authenticated;
grant select, delete on public.booking_supply_items to authenticated;
grant insert (booking_id, item_id, quantity) on public.booking_supply_items to authenticated;
create policy "Customers can read own supply lines" on public.booking_supply_items for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id and b.customer_id = (select auth.uid())));
create policy "Staff can read all supply lines" on public.booking_supply_items for select to authenticated using (public.is_staff());
create policy "Customers can add supply lines while requested" on public.booking_supply_items for insert to authenticated
  with check (exists (select 1 from public.bookings b where b.id = booking_id and b.customer_id = (select auth.uid()) and b.status = 'requested'));
create policy "Customers can remove supply lines while requested" on public.booking_supply_items for delete to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id and b.customer_id = (select auth.uid()) and b.status = 'requested'));

-- The unit price is always copied from the catalogue, never taken from the client.
create function public.set_supply_unit_price() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select price into new.unit_price from public.supply_items where id = new.item_id and active;
  if new.unit_price is null then raise exception 'Supply item is not available'; end if;
  return new;
end $$;
revoke execute on function public.set_supply_unit_price() from public, anon, authenticated;
create trigger booking_supply_items_price before insert on public.booking_supply_items
  for each row execute function public.set_supply_unit_price();

-- 3. Towing details --------------------------------------------------------------
create table public.towing_details (
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  vehicle_make text,
  vehicle_model text,
  registration text not null check (length(btrim(registration)) between 2 and 12),
  vehicle_runs boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.towing_details enable row level security;
revoke all on public.towing_details from anon, authenticated;
grant select on public.towing_details to authenticated;
grant insert (booking_id, vehicle_make, vehicle_model, registration, vehicle_runs) on public.towing_details to authenticated;
grant update (vehicle_make, vehicle_model, registration, vehicle_runs) on public.towing_details to authenticated;
create policy "Customers can read own towing details" on public.towing_details for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id and b.customer_id = (select auth.uid())));
create policy "Staff can read all towing details" on public.towing_details for select to authenticated using (public.is_staff());
create policy "Assigned drivers can read towing details" on public.towing_details for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id and b.driver_id = (select auth.uid())));
create policy "Customers can add towing details while requested" on public.towing_details for insert to authenticated
  with check (exists (select 1 from public.bookings b where b.id = booking_id and b.customer_id = (select auth.uid()) and b.status = 'requested' and b.service = 'towing'));
create policy "Customers can edit towing details while requested" on public.towing_details for update to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id and b.customer_id = (select auth.uid()) and b.status = 'requested'))
  with check (exists (select 1 from public.bookings b where b.id = booking_id and b.customer_id = (select auth.uid()) and b.status = 'requested'));
create trigger towing_details_touch before update on public.towing_details
  for each row execute function public.touch_updated_at();

-- 4. Payments (written by server code only) ---------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  quote_id uuid references public.quotes(id) on delete set null,
  provider text not null default 'paystack',
  provider_reference text not null,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'ZAR' check (currency ~ '^[A-Z]{3}$'),
  status public.payment_status not null default 'pending',
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  unique (provider, provider_reference)
);
create index payments_booking_idx on public.payments(booking_id);
alter table public.payments enable row level security;
revoke all on public.payments from anon, authenticated;
grant select on public.payments to authenticated;
create policy "Customers can read payments for own bookings" on public.payments for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id and b.customer_id = (select auth.uid())));
create policy "Staff can read all payments" on public.payments for select to authenticated using (public.is_staff());

-- 5. Realtime ----------------------------------------------------------------------
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.quotes, public.payments;
  end if;
end $$;
