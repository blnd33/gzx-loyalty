'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Ban, CheckCircle2, Pencil, RefreshCcw, Undo2, UserX, UserCheck } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { reissueCard, setCardStatus, voidLastPunch } from '@/lib/actions/loyalty';
import { setCustomerActive, updateCustomer } from '@/lib/actions/customers';

type Tool = 'edit' | 'void' | 'card' | 'reissue' | 'customer' | null;

interface Props {
  isAdmin: boolean;
  customerId: string;
  name: string;
  phone: string | null;
  notes: string | null;
  cardActive: boolean;
  customerActive: boolean;
  punches: number;
}

export function CustomerTools(p: Props) {
  const router = useRouter();
  const [tool, setTool] = useState<Tool>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: p.name, phone: p.phone ?? '', notes: p.notes ?? '' });
  const [pending, startTransition] = useTransition();

  function open(t: Tool) {
    setReason('');
    setError(null);
    setForm({ name: p.name, phone: p.phone ?? '', notes: p.notes ?? '' });
    setTool(t);
  }

  function run(fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>, success: (d: unknown) => string) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return setError(res.error ?? 'Failed.');
      toast.success(success(res.data));
      setTool(null);
      router.refresh();
    });
  }

  const reasonField = (
    <div>
      <label htmlFor="reason" className="field-label">Reason (saved to the audit log)</label>
      <textarea id="reason" className="input min-h-[88px] py-2.5" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)}
        aria-invalid={!!error} aria-describedby={error ? 'tool-error' : undefined} />
      {error && <p id="tool-error" role="alert" className="field-error">{error}</p>}
    </div>
  );

  return (
    <section className="panel panel-pad" aria-labelledby="tools-title">
      <h2 id="tools-title" className="eyebrow mb-3">{p.isAdmin ? 'Manage customer' : 'Customer details'}</h2>
      <div className="flex flex-wrap gap-2">
        <button className="btn-ghost text-sm" onClick={() => open('edit')}><Pencil className="h-4 w-4" aria-hidden /> Edit details</button>
        {p.isAdmin && (
          <>
            <button className="btn-ghost text-sm" onClick={() => open('void')} disabled={p.punches === 0}>
              <Undo2 className="h-4 w-4" aria-hidden /> Correct last paid hour
            </button>
            <button className="btn-ghost text-sm" onClick={() => open('card')}>
              {p.cardActive ? <Ban className="h-4 w-4" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
              {p.cardActive ? 'Deactivate card' : 'Reactivate card'}
            </button>
            <button className="btn-ghost text-sm" onClick={() => open('reissue')}><RefreshCcw className="h-4 w-4" aria-hidden /> Reissue card code</button>
            <button className="btn-ghost text-sm" onClick={() => open('customer')}>
              {p.customerActive ? <UserX className="h-4 w-4" aria-hidden /> : <UserCheck className="h-4 w-4" aria-hidden />}
              {p.customerActive ? 'Deactivate customer' : 'Reactivate customer'}
            </button>
          </>
        )}
      </div>

      <ConfirmDialog open={tool === 'edit'} onOpenChange={(o) => !o && setTool(null)} title="Edit customer" description="Loyalty progress is not affected."
        confirmLabel="Save changes" pending={pending}
        onConfirm={() => run(() => updateCustomer({ customerId: p.customerId, ...form }), () => 'Customer updated.')}>
        <div className="space-y-3">
          <div>
            <label htmlFor="e-name" className="field-label">Name</label>
            <input id="e-name" className="input" maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label htmlFor="e-phone" className="field-label">Phone</label>
            <input id="e-phone" className="input" type="tel" maxLength={24} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label htmlFor="e-notes" className="field-label">Notes</label>
            <textarea id="e-notes" className="input min-h-[72px] py-2.5" maxLength={1000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          {error && <p role="alert" className="field-error">{error}</p>}
        </div>
      </ConfirmDialog>

      <ConfirmDialog open={tool === 'void'} onOpenChange={(o) => !o && setTool(null)} tone="danger" title="Correct last paid hour"
        description="Voids the most recent paid hour of the current cycle. If it was the 3rd hour, the pending reward is withdrawn. The original record stays in history."
        confirmLabel="Void paid hour" pending={pending}
        onConfirm={() => run(() => voidLastPunch(p.customerId, reason), () => 'Paid hour voided.')}>
        {reasonField}
      </ConfirmDialog>

      <ConfirmDialog open={tool === 'card'} onOpenChange={(o) => !o && setTool(null)} tone={p.cardActive ? 'danger' : 'primary'}
        title={p.cardActive ? 'Deactivate card' : 'Reactivate card'}
        description={p.cardActive ? 'Use this for lost or compromised cards. The code stops working for paid hours and rewards until reactivated. History is kept.' : 'The card and its code will work again.'}
        confirmLabel={p.cardActive ? 'Deactivate' : 'Reactivate'} pending={pending}
        onConfirm={() => run(() => setCardStatus(p.customerId, !p.cardActive, reason), () => (p.cardActive ? 'Card deactivated.' : 'Card reactivated.'))}>
        {reasonField}
      </ConfirmDialog>

      <ConfirmDialog open={tool === 'reissue'} onOpenChange={(o) => !o && setTool(null)} tone="danger" title="Reissue card code"
        description="Creates a new 6-letter code and QR. The old card stops working permanently. Current progress and any available reward carry over."
        confirmLabel="Reissue card" pending={pending}
        onConfirm={() => run(() => reissueCard(p.customerId, reason), (d) => `New code: ${(d as { code: string }).code}. Print the new card.`)}>
        {reasonField}
      </ConfirmDialog>

      <ConfirmDialog open={tool === 'customer'} onOpenChange={(o) => !o && setTool(null)} tone={p.customerActive ? 'danger' : 'primary'}
        title={p.customerActive ? 'Deactivate customer' : 'Reactivate customer'}
        description="Deactivated customers cannot earn or redeem. Nothing is deleted."
        confirmLabel={p.customerActive ? 'Deactivate' : 'Reactivate'} pending={pending}
        onConfirm={() => run(() => setCustomerActive(p.customerId, !p.customerActive, reason), () => 'Customer updated.')}>
        {reasonField}
      </ConfirmDialog>
    </section>
  );
}
