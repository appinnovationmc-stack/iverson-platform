'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function Header() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  const [isStaff, setIsStaff] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const check = async (signed: boolean) => {
      setSignedIn(signed);
      if (!signed) return setIsStaff(false);
      const { data } = await supabase.rpc('is_staff');
      setIsStaff(data === true);
    };
    supabase.auth.getSession().then(({ data }) => check(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setTimeout(() => void check(!!session), 0);
    });
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
          <Link href="/book" className="rounded-full bg-brand px-5 py-2">
            Book
          </Link>
          {signedIn ? (
            <>
              {isStaff && (
                <Link href="/staff" className="px-3 py-2">
                  Staff
                </Link>
              )}
              <Link href="/bookings" className="px-3 py-2">
                My bookings
              </Link>
              <button onClick={signOut} className="px-3 py-2 text-white/70">
                Sign out
              </button>
            </>
          ) : (
            <Link href="/login" className="px-3 py-2">
              Sign in
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
