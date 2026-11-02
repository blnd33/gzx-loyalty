'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';
import { saveSettings } from '@/lib/actions/admin';
import type { AppSettings } from '@/lib/settings';

export function SettingsForm({ initial }: { initial: AppSettings }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await saveSettings(v as unknown as Record<string, unknown>);
      if (!res.ok) return setError(res.error);
      toast.success('Settings saved.');
      router.refresh();
    });
  }
  const text = (k: 'lounge_name' | 'reward_label' | 'card_tagline', label: string, help: string) => (
    <div>
      <label htmlFor={k} className="field-label">{label}</label>
      <input id={k} className="input" maxLength={80} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
      <p className="field-help">{help}</p>
    </div>
  );
  const num = (k: 'lookup_limit_per_minute' | 'lookup_failures_per_10min', label: string, help: string) => (
    <div>
      <label htmlFor={k} className="field-label">{label}</label>
      <input id={k} type="number" min={3} max={500} className="input" value={v[k]} onChange={(e) => setV({ ...v, [k]: Number(e.target.value) })} />
      <p className="field-help">{help}</p>
    </div>
  );

  return (
    <form onSubmit={onSubmit} className="grid gap-5 lg:grid-cols-2">
      <section className="panel panel-pad space-y-4">
        <h2 className="heading text-lg">Loyalty program</h2>
        {text('lounge_name', 'Lounge name', 'Shown in the app.')}
        {text('reward_label', 'Reward label', 'Shown when a reward is unlocked.')}
        {text('card_tagline', 'Card tagline', 'Short promotional line.')}
      </section>
      <section className="panel panel-pad space-y-4">
        <h2 className="heading text-lg">Security</h2>
        {num('lookup_limit_per_minute', 'Lookups per staff member per minute', 'Limits code guessing. Default 20.')}
        {num('lookup_failures_per_10min', 'Failed lookups allowed per 10 minutes', 'After this, lookups pause for that staff member. Default 15.')}
      </section>
      <div className="lg:col-span-2">
        {error && <p role="alert" className="field-error mb-3">{error}</p>}
        <button className="btn-primary btn-lg" disabled={pending}>
          {pending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Save className="h-5 w-5" aria-hidden />} Save settings
        </button>
      </div>
    </form>
  );
}
