'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function Header() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setSignedIn(!!session));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await createClient().auth.signOut();
    window.location.href = '/';
  }

  return (
    <header className="bg-navy text-white">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="text-xl font-black tracking-[.22em]">
          IVERSON<span className="text-brand-soft">.</span>
        </Link>
        <div className="flex items-center gap-3 text-sm font-semibold">
          <Link href="/book" className="rounded-full bg-brand px-5 py-2">Book</Link>
          {signedIn ? (
            <>
              <Link href="/bookings" className="px-3 py-2">My bookings</Link>
              <button onClick={signOut} className="px-3 py-2 text-white/70">Sign out</button>
            </>
          ) : (
            <Link href="/login" className="px-3 py-2">Sign in</Link>
          )}
        </div>
      </nav>
    </header>
  );
}
