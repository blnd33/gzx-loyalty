'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Loader2, UserPlus } from 'lucide-react';
import { findDuplicates, registerCustomer, type DuplicateMatch } from '@/lib/actions/customers';
import { useIdempotencyKey } from '@/lib/useIdempotencyKey';
import { formatDate } from '@/lib/format';

export function NewCustomerForm() {
  const router = useRouter();
  const key = useIdempotencyKey();
  const [values, setValues] = useState({ name: '', phone: '', notes: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [matches, setMatches] = useState<DuplicateMatch[]>([]);
  const [pending, startTransition] = useTransition();

  // Debounced duplicate check (shows matches only — never merges).
  useEffect(() => {
    const name = values.name.trim();
    const phone = values.phone.trim();
    if (name.length < 2 && phone.replace(/\D/g, '').length < 6) {
      setMatches([]);
      return;
    }
    const t = setTimeout(async () => setMatches(await findDuplicates(name, phone || undefined)), 400);
    return () => clearTimeout(t);
  }, [values.name, values.phone]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.name.trim()) {
      setErrors({ name: 'Customer name is required.' });
      document.getElementById('name')?.focus();
      return;
    }
    startTransition(async () => {
      const res = await registerCustomer({ ...values, idempotencyKey: key.get() });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setFormError(res.error);
        if (res.code || res.fieldErrors) key.reset();
        return;
      }
      key.reset();
      toast.success(`Customer created — code ${res.data.code}`);
      router.push(`/customers/${res.data.customerId}`);
    });
  }

  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: '' }));
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <form onSubmit={onSubmit} noValidate className="panel panel-pad space-y-5 sm:p-6">
        <div>
          <label htmlFor="name" className="field-label">Customer name <span className="text-neon-pink">*</span></label>
          <input id="name" className="input text-lg" maxLength={100} autoFocus autoComplete="off" value={values.name} onChange={set('name')}
            aria-invalid={!!errors.name} aria-describedby={errors.name ? 'name-error' : undefined} />
          {errors.name && <p id="name-error" className="field-error">{errors.name}</p>}
        </div>
        <div>
          <label htmlFor="phone" className="field-label">Phone number <span className="font-normal text-muted">(optional)</span></label>
          <input id="phone" type="tel" inputMode="tel" className="input" maxLength={24} autoComplete="off" value={values.phone} onChange={set('phone')}
            placeholder="+964 7xx xxx xxxx" aria-invalid={!!errors.phone} aria-describedby="phone-help" />
          <p id="phone-help" className={errors.phone ? 'field-error' : 'field-help'}>{errors.phone || 'Helps find the customer if they lose their card.'}</p>
        </div>
        <div>
          <label htmlFor="notes" className="field-label">Notes <span className="font-normal text-muted">(optional)</span></label>
          <textarea id="notes" className="input min-h-[96px] py-2.5" maxLength={1000} value={values.notes} onChange={set('notes')} />
        </div>
        {formError && <p role="alert" className="field-error">{formError}</p>}
        <button type="submit" disabled={pending} className="btn-primary btn-lg w-full sm:w-auto">
          {pending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <UserPlus className="h-5 w-5" aria-hidden />}
          {pending ? 'Creating…' : 'Create customer'}
        </button>
      </form>

      <aside aria-live="polite" className="space-y-3">
        {matches.length > 0 ? (
          <div className="panel panel-pad border-neon-gold/40">
            <p className="mb-2 flex items-center gap-2 font-semibold text-neon-gold">
              <AlertTriangle className="h-5 w-5" aria-hidden /> Possible existing customer
            </p>
            <p className="mb-3 text-sm text-muted">Check before creating a second card. Nothing is merged automatically.</p>
            <ul className="space-y-2">
              {matches.map((m) => (
                <li key={m.id}>
                  <Link href={`/customers/${m.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-white/[0.03] p-3 hover:border-neon-gold/50">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{m.name}</span>
                      <span className="block text-xs text-muted">{m.phone ?? 'No phone'} · since {formatDate(m.created_at)}</span>
                    </span>
                    <span className="font-display tracking-widest text-neon-gold">{m.code}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="panel panel-pad text-sm text-muted">
            <p className="mb-2 font-semibold text-white">What happens next</p>
            <ol className="list-inside list-decimal space-y-1">
              <li>A unique code like <span className="font-display tracking-widest text-neon-gold">AXKJTR</span> is generated</li>
              <li>A secure QR is linked to the card</li>
              <li>Progress starts at 0/3 paid hours</li>
              <li>The card opens, ready to print</li>
            </ol>
          </div>
        )}
      </aside>
    </div>
  );
}
