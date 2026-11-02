'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Loader2, Mail } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';

export default function ForgotPasswordPage() {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const email = String(new FormData(e.currentTarget).get('email')).trim();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/auth/callback?next=/reset-password`,
    });
    // Same message whether or not the account exists (no account enumeration).
    setSent(true);
    setPending(false);
  }

  return (
    <div className="panel panel-pad space-y-4 sm:p-7">
      <h1 className="heading text-2xl">Reset password</h1>
      {sent ? (
        <p role="status" className="text-muted">
          If that email belongs to a staff account, a reset link is on its way. Check the inbox (and spam folder).
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <p className="text-muted">Enter your staff email and we will send you a reset link.</p>
          <div>
            <label htmlFor="email" className="field-label">Email</label>
            <input id="email" name="email" type="email" required autoComplete="username" className="input" />
          </div>
          <button className="btn-primary btn-lg w-full" disabled={pending}>
            {pending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Mail className="h-5 w-5" aria-hidden />}
            Send reset link
          </button>
        </form>
      )}
      <p className="text-center text-sm"><Link href="/login" className="text-muted hover:text-white">Back to sign in</Link></p>
    </div>
  );
}
