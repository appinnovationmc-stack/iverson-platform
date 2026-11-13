'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { SERVICES, STATUS_LABEL, money } from '@/lib/booking';

type StaffBooking = {
  id: string;
  reference: string;
  service: 'moving' | 'supplies' | 'towing';
  status: string;
  pickup_address: string;
  destination_address: string | null;
  scheduled_at: string | null;
  notes: string | null;
  estimated_price: number | null;
  created_at: string;
  booking_supply_items: {
    quantity: number;
    unit_price: number;
    supply_items: { name: string } | null;
  }[];
  towing_details: {
    registration: string;
    vehicle_make: string | null;
    vehicle_model: string | null;
    vehicle_runs: boolean;
  } | null;
};

const COLUMNS =
  'id, reference, service, status, pickup_address, destination_address, scheduled_at, notes, estimated_price, created_at, booking_supply_items(quantity, unit_price, supply_items(name)), towing_details(registration, vehicle_make, vehicle_model, vehicle_runs)';

function QuoteForm({ booking, onDone }: { booking: StaffBooking; onDone: () => void }) {
  const [amount, setAmount] = useState('');
  const [days, setDays] = useState('7');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const value = Number(amount);
  const validDays = Number(days);
  const ok =
    Number.isFinite(value) &&
    value > 0 &&
    Number.isInteger(validDays) &&
    validDays >= 1 &&
    validDays <= 60;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().rpc('issue_quote', {
      p_booking_id: booking.id,
      p_amount: value,
      p_valid_until: new Date(Date.now() + validDays * 86_400_000).toISOString(),
      p_notes: notes.trim() || null,
    });
    setBusy(false);
    if (error) setError(error.message);
    else {
      setAmount('');
      setNotes('');
      onDone();
    }
  }

  const input =
    'mt-1 w-full rounded-lg border border-navy/15 bg-white p-2.5 text-sm outline-none focus:border-brand';
  return (
    <form
      onSubmit={submit}
      className="mt-4 grid gap-3 rounded-2xl bg-surface p-4 sm:grid-cols-[1fr_8rem]"
    >
      <label className="text-xs font-semibold">
        Amount (ZAR)
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={booking.estimated_price != null ? String(booking.estimated_price) : '0.00'}
          className={input}
        />
      </label>
      <label className="text-xs font-semibold">
        Valid for (days)
        <input
          inputMode="numeric"
          value={days}
          onChange={(e) => setDays(e.target.value)}
          className={input}
        />
      </label>
      <label className="text-xs font-semibold sm:col-span-2">
        Note to customer
        <input value={notes} onChange={(e) => setNotes(e.target.value)} className={input} />
      </label>
      {error && (
        <p role="alert" className="text-xs font-semibold text-red-700 sm:col-span-2">
          {error}
        </p>
      )}
      <div className="sm:col-span-2">
        <button
          disabled={!ok || busy}
          className="rounded-full bg-brand px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? 'Sending…' : booking.status === 'quoted' ? 'Send revised quote' : 'Send quote'}
        </button>
      </div>
    </form>
  );
}

export default function Staff() {
  const [isStaff, setIsStaff] = useState<boolean | null>(null);
  const [rows, setRows] = useState<StaffBooking[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      setIsStaff(false);
      return;
    }
    const { data: staff, error: staffError } = await supabase.rpc('is_staff');
    if (staffError || !staff) {
      setIsStaff(false);
      return;
    }
    setIsStaff(true);
    const { data, error } = await supabase
      .from('bookings')
      .select(COLUMNS)
      .in('status', ['requested', 'quoted'])
      .order('created_at', { ascending: true });
    if (error) setError(error.message);
    else {
      setError(null);
      setRows(data as unknown as StaffBooking[]);
    }
  }, []);

  useEffect(() => {
    load();
    const supabase = createClient();
    const channel = supabase
      .channel('staff-bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  if (isStaff === false) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-extrabold">Staff only</h1>
        <p className="mt-4 text-muted">
          This page is for Iverson staff.{' '}
          <Link href="/login" className="font-bold text-brand">
            Sign in
          </Link>{' '}
          with a staff account to continue.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-4xl font-extrabold">Quote requests</h1>
      <p className="mt-2 text-muted">
        Open requests and quotes waiting for a customer answer, oldest first.
      </p>
      {error && (
        <p role="alert" className="mt-6 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
      {rows && rows.length === 0 && (
        <p className="mt-8 rounded-2xl bg-white p-6">Nothing waiting. 🎉</p>
      )}
      <ul className="mt-8 space-y-5">
        {rows?.map((b) => (
          <li
            key={b.id}
            className="rounded-3xl bg-white p-6 shadow-[0_8px_22px_rgba(23,32,107,0.08)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-muted">{b.reference}</p>
                <p className="text-lg font-bold">
                  {SERVICES.find((s) => s.value === b.service)?.label}
                </p>
              </div>
              <span className="rounded-lg bg-brand/10 px-3 py-1.5 text-xs font-bold text-brand-dark">
                {STATUS_LABEL[b.status] ?? b.status}
                {b.estimated_price != null && ` · ${money(b.estimated_price)}`}
              </span>
            </div>
            <p className="mt-3 text-sm">
              {b.pickup_address}
              {b.destination_address ? ` → ${b.destination_address}` : ''}
            </p>
            {b.scheduled_at && (
              <p className="mt-1 text-sm text-muted">
                Preferred date: {new Date(b.scheduled_at).toLocaleDateString('en-ZA')}
              </p>
            )}
            {b.notes && <p className="mt-2 text-sm text-muted">“{b.notes}”</p>}
            {b.booking_supply_items.length > 0 && (
              <ul className="mt-3 list-inside list-disc text-sm">
                {b.booking_supply_items.map((l, i) => (
                  <li key={i}>
                    {l.quantity} × {l.supply_items?.name ?? 'Item'} ({money(l.unit_price)} each)
                  </li>
                ))}
              </ul>
            )}
            {b.towing_details && (
              <p className="mt-3 text-sm">
                Vehicle: {b.towing_details.registration}
                {[b.towing_details.vehicle_make, b.towing_details.vehicle_model].filter(Boolean)
                  .length > 0 &&
                  ` (${[b.towing_details.vehicle_make, b.towing_details.vehicle_model].filter(Boolean).join(' ')})`}
                {b.towing_details.vehicle_runs ? '' : ' · does not run'}
              </p>
            )}
            <QuoteForm booking={b} onDone={load} />
          </li>
        ))}
      </ul>
    </main>
  );
}
