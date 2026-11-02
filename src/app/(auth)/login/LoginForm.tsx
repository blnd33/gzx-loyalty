'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Loader2, LogIn } from 'lucide-react';
import { signIn } from '@/lib/actions/session';

export function LoginForm({ next, notice }: { next: string; notice: string | null }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const result=await signIn(String(form.get('email')).trim(),String(form.get('password')));
    if(!result.ok) { setPending(false); setError(result.error??'Sign in failed.'); return; }
    window.location.assign(next); // full reload so the server sees the new session
  }

  return (
    <form onSubmit={onSubmit} className="panel panel-pad space-y-4 sm:p-7" noValidate>
      <div>
        <h1 className="heading text-2xl">Staff sign in</h1>
        <p className="mt-1 text-muted">Cashiers and admins only.</p>
      </div>
      {notice && <p role="status" className="rounded-xl border border-neon-gold/30 bg-neon-gold/10 p-3 text-sm text-neon-gold">{notice}</p>}
      <div>
        <label htmlFor="email" className="field-label">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required className="input" inputMode="email" />
      </div>
      <div>
        <label htmlFor="password" className="field-label">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
      </div>
      {error && <p role="alert" className="field-error">{error}</p>}
      <button type="submit" disabled={pending} className="btn-primary btn-lg w-full">
        {pending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <LogIn className="h-5 w-5" aria-hidden />}
        {pending ? 'Signing inâ€¦' : 'Sign in'}
      </button>
      <p className="text-center text-sm">
        <Link href="/forgot-password" className="text-muted underline-offset-4 hover:text-white hover:underline">
          Forgot your password?
        </Link>
      </p>
    </form>
  );
}
