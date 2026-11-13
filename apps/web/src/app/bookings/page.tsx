'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { STATUS_LABEL, SERVICES, type Booking } from '@/lib/booking';

const CANCELLABLE = ['requested', 'quoted', 'confirmed'];

export default function Bookings() {
  const [rows, setRows] = useState<Booking[] | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: session } = await supabase.auth.getSession();
    setSignedIn(!!session.session);
    if (!session.session) return;
    const { data, error } = await supabase
      .from('bookings')
      .select(
        'id, reference, service, status, pickup_address, destination_address, scheduled_at, created_at',
      )
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setRows(data as Booking[]);
  }, []);

  useEffect(() => {
    load();
    const supabase = createClient();
    const channel = supabase
      .channel('my-bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  async function cancel(id: string) {
    setError(null);
    const { error } = await createClient().rpc('cancel_booking', { p_booking_id: id });
    if (error) setError(error.message);
    else load();
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-4xl font-extrabold">My bookings</h1>
      {signedIn === false && (
        <p className="mt-8 rounded-2xl bg-white p-6">
          Please{' '}
          <Link href="/login" className="font-bold text-brand">
            sign in
          </Link>{' '}
          to see your bookings.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-6 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
      {rows && rows.length === 0 && (
        <p className="mt-8 rounded-2xl bg-white p-6">
          No bookings yet.{' '}
          <Link href="/book" className="font-bold text-brand">
            Request a quote
          </Link>
          .
        </p>
      )}
      <ul className="mt-8 space-y-4">
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
              </span>
            </div>
            <p className="mt-3 text-sm text-muted">
              {b.pickup_address}
              {b.destination_address ? ` → ${b.destination_address}` : ''}
            </p>
            {CANCELLABLE.includes(b.status) && (
              <button onClick={() => cancel(b.id)} className="mt-4 text-sm font-bold text-brand">
                Cancel booking
              </button>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
