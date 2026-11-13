'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { SERVICES, money, type Service, type SupplyItem } from '@/lib/booking';

function BookForm() {
  const router = useRouter();
  const params = useSearchParams();
  const initial = SERVICES.find((s) => s.value === params.get('service'))?.value ?? 'moving';
  const [service, setService] = useState<Service>(initial);
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<SupplyItem[]>([]);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [reg, setReg] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [runs, setRuns] = useState(true);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    createClient()
      .auth.getSession()
      .then(({ data }) => setSignedIn(!!data.session));
  }, []);

  useEffect(() => {
    if (service !== 'supplies' || signedIn !== true) return;
    createClient()
      .from('supply_items')
      .select('id, sku, name, price')
      .eq('active', true)
      .order('name')
      .then(({ data }) => setItems((data as SupplyItem[] | null) ?? []));
  }, [service, signedIn]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        service,
        pickup_address: pickup.trim(),
        destination_address: destination.trim() || null,
        scheduled_at: date ? new Date(date).toISOString() : null,
        notes: notes.trim() || null,
      })
      .select('id')
      .single();
    if (bookingError || !booking) {
      setError(bookingError?.message ?? 'Could not create your booking');
      setBusy(false);
      return;
    }

    let followUpError: string | null = null;
    if (service === 'supplies') {
      const lines = Object.entries(qty)
        .filter(([, n]) => n > 0)
        .map(([item_id, quantity]) => ({ booking_id: booking.id, item_id, quantity }));
      if (lines.length) {
        const { error } = await supabase.from('booking_supply_items').insert(lines);
        followUpError = error?.message ?? null;
      }
    } else if (service === 'towing') {
      const { error } = await supabase.from('towing_details').insert({
        booking_id: booking.id,
        registration: reg.trim(),
        vehicle_make: make.trim() || null,
        vehicle_model: model.trim() || null,
        vehicle_runs: runs,
      });
      followUpError = error?.message ?? null;
    }

    if (followUpError) {
      await supabase.rpc('cancel_booking', { p_booking_id: booking.id });
      setError(`${followUpError}. Your request was not sent, please try again.`);
      setBusy(false);
      return;
    }
    router.push('/bookings');
  }

  const field =
    'mt-2 w-full rounded-xl border border-navy/15 bg-white p-4 outline-none focus:border-brand';

  if (signedIn === false) {
    return (
      <p className="mt-10 rounded-2xl bg-white p-6">
        Please{' '}
        <Link href="/login" className="font-bold text-brand">
          sign in
        </Link>{' '}
        to request a booking.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-10 space-y-6">
      <label className="block text-sm font-semibold">
        Service
        <select
          value={service}
          onChange={(e) => setService(e.target.value as Service)}
          className={field}
        >
          {SERVICES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-semibold">
        {service === 'towing' ? 'Vehicle is at' : 'Pick-up address'}
        <input
          required
          value={pickup}
          onChange={(e) => setPickup(e.target.value)}
          placeholder="Street, suburb, city"
          className={field}
        />
      </label>
      <label className="block text-sm font-semibold">
        {service === 'supplies' ? 'Delivery address' : 'Drop-off address'}
        <input
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="Street, suburb, city"
          className={field}
        />
      </label>

      {service === 'supplies' && (
        <fieldset className="rounded-2xl bg-white p-5">
          <legend className="px-1 text-sm font-semibold">What do you need?</legend>
          {items.length === 0 ? (
            <p className="text-sm text-muted">
              The supplies catalogue is not available yet. Describe what you need in the notes.
            </p>
          ) : (
            <ul className="space-y-3">
              {items.map((it) => (
                <li key={it.id} className="flex items-center justify-between gap-4">
                  <span className="text-sm">
                    {it.name} <span className="text-muted">{money(it.price)}</span>
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={1000}
                    aria-label={`Quantity of ${it.name}`}
                    value={qty[it.id] ?? 0}
                    onChange={(e) =>
                      setQty({
                        ...qty,
                        [it.id]: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                      })
                    }
                    className="w-20 rounded-lg border border-navy/15 p-2 text-right"
                  />
                </li>
              ))}
            </ul>
          )}
        </fieldset>
      )}

      {service === 'towing' && (
        <fieldset className="space-y-4 rounded-2xl bg-white p-5">
          <legend className="px-1 text-sm font-semibold">Your vehicle</legend>
          <label className="block text-sm font-semibold">
            Registration
            <input
              required
              value={reg}
              onChange={(e) => setReg(e.target.value)}
              className={field}
            />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block text-sm font-semibold">
              Make
              <input value={make} onChange={(e) => setMake(e.target.value)} className={field} />
            </label>
            <label className="block text-sm font-semibold">
              Model
              <input value={model} onChange={(e) => setModel(e.target.value)} className={field} />
            </label>
          </div>
          <label className="flex items-center gap-3 text-sm font-semibold">
            <input type="checkbox" checked={runs} onChange={(e) => setRuns(e.target.checked)} />
            The vehicle starts and rolls
          </label>
        </fieldset>
      )}

      <label className="block text-sm font-semibold">
        Preferred date
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={field}
        />
      </label>
      <label className="block text-sm font-semibold">
        Notes
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Home size, stairs, anything we should know…"
          className={field}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
      <button
        disabled={busy || signedIn === null}
        className="rounded-full bg-brand px-8 py-3 font-bold text-white disabled:opacity-60"
      >
        {busy ? 'Sending…' : 'Request a quote'}
      </button>
    </form>
  );
}

export default function Book() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-xs font-bold tracking-[.2em] text-brand">START A BOOKING</p>
      <h1 className="mt-3 text-4xl font-extrabold">What can we help you with?</h1>
      <p className="mt-3 text-muted">Tell us the basics. Our team will confirm your quote.</p>
      <Suspense fallback={null}>
        <BookForm />
      </Suspense>
    </main>
  );
}
