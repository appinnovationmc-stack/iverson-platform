'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const supabase = createClient();
    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else router.push('/bookings');
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/bookings`,
        },
      });
      if (error) setError(error.message);
      else if (data.session) router.push('/bookings');
      else setNotice('Check your email to confirm your account, then sign in.');
    }
    setBusy(false);
  }

  const field =
    'mt-2 w-full rounded-xl border border-navy/15 bg-white p-4 outline-none focus:border-brand';

  return (
    <main className="mx-auto max-w-md px-6 py-14">
      <h1 className="text-3xl font-extrabold">
        {mode === 'signin' ? 'Welcome back' : 'Create your account'}
      </h1>
      <form onSubmit={submit} className="mt-8 space-y-5">
        {mode === 'signup' && (
          <label className="block text-sm font-semibold">
            Full name
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={field}
            />
          </label>
        )}
        <label className="block text-sm font-semibold">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={field}
          />
        </label>
        <label className="block text-sm font-semibold">
          Password
          <input
            type="password"
            required
            minLength={8}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={field}
          />
        </label>
        {error && (
          <p role="alert" className="text-sm font-semibold text-red-700">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="text-sm font-semibold text-navy-2">
            {notice}
          </p>
        )}
        <button
          disabled={busy}
          className="w-full rounded-full bg-brand px-8 py-3 font-bold text-white disabled:opacity-60"
        >
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>
      <button
        onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
        className="mt-6 text-sm font-semibold text-brand"
      >
        {mode === 'signin'
          ? 'New to Iverson? Create an account'
          : 'Already have an account? Sign in'}
      </button>
    </main>
  );
}
