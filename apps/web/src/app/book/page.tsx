'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { SERVICES, type Service } from '@/lib/booking';

function BookForm() {
  const router = useRouter();
  const params = useSearchParams();
  const initial = SERVICES.find((s) => s.value === params.get('service'))?.value ?? 'moving';
  const [service, setService] = useState<Service>(initial);
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    createClient()
      .auth.getSession()
      .then(({ data }) => setSignedIn(!!data.session));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient()
      .from('bookings')
      .insert({
        service,
        pickup_address: pickup.trim(),
        destination_address: destination.trim() || null,
        scheduled_at: date ? new Date(date).toISOString() : null,
        notes: notes.trim() || null,
      });
    setBusy(false);
    if (error) setError(error.message);
    else router.push('/bookings');
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
          placeholder="Home size, stairs, vehicle make and model…"
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
