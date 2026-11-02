'use client';

import { useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';

export default function ResetPasswordPage() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const password = String(f.get('password'));
    if (password.length < 10) return setError('Use at least 10 characters.');
    if (password !== String(f.get('confirm'))) return setError('The passwords do not match.');
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setPending(false);
      return setError(error.message);
    }
    await supabase.auth.signOut();
    window.location.assign('/login?reset=1');
  }

  return (
    <form onSubmit={onSubmit} className="panel panel-pad space-y-4 sm:p-7">
      <h1 className="heading text-2xl">Choose a new password</h1>
      <div>
        <label htmlFor="password" className="field-label">New password</label>
        <input id="password" name="password" type="password" minLength={10} required autoComplete="new-password" className="input" />
        <p className="field-help">At least 10 characters.</p>
      </div>
      <div>
        <label htmlFor="confirm" className="field-label">Confirm password</label>
        <input id="confirm" name="confirm" type="password" required autoComplete="new-password" className="input" />
      </div>
      {error && <p role="alert" className="field-error">{error}</p>}
      <button className="btn-primary btn-lg w-full" disabled={pending}>
        {pending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <KeyRound className="h-5 w-5" aria-hidden />}
        Update password
      </button>
    </form>
  );
}
