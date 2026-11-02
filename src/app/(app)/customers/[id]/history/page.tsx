import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { rpc, RpcError } from '@/lib/rpc';
import { formatDate, formatTime } from '@/lib/format';
import { describeHistory, TONE_CLASS } from '@/lib/history';
import { uuidSchema } from '@/lib/validation';
import type { CustomerProfile, HistoryRow } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = { title: 'Customer history' };

export default async function HistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  let c: CustomerProfile;
  try {
    c = await rpc<CustomerProfile>('get_customer_profile', { p_customer_id: id });
  } catch (e) {
    if (e instanceof RpcError && e.code === 'CUSTOMER_NOT_FOUND') notFound();
    throw e;
  }
  const rows = await rpc<HistoryRow[]>('get_customer_history', { p_customer_id: id, p_limit: 500 });

  return (
    <>
      <Link href={`/customers/${id}`} className="mb-3 inline-flex min-h-[44px] items-center gap-1.5 text-sm text-muted hover:text-white">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to card
      </Link>
      <PageHeader eyebrow="Loyalty history" title={c.name}>
        Code <span className="font-display tracking-[0.18em] text-neon-gold">{c.card?.code}</span> · {rows.length} recorded{' '}
        {rows.length === 1 ? 'event' : 'events'} · times shown in Baghdad time
      </PageHeader>

      {rows.length === 0 ? (
        <p className="panel panel-pad text-muted">No activity yet.</p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="panel hidden overflow-x-auto md:block">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Date</th><th scope="col">Activity</th><th scope="col">Progress</th>
                  <th scope="col">Cycle</th><th scope="col">Staff</th><th scope="col">Details</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const v = describeHistory(r);
                  return (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap"><span className="font-semibold">{formatDate(r.created_at)}</span> <span className="text-muted">{formatTime(r.created_at)}</span></td>
                      <td><span className={`badge ring-1 ${TONE_CLASS[v.tone]}`}>{v.label}</span></td>
                      <td className="font-display">{v.progress}</td>
                      <td className="text-muted">{v.cycle ? `#${v.cycle}` : '—'}</td>
                      <td>{r.staff_name ?? '—'}</td>
                      <td className="max-w-xs text-muted">{[v.detail, r.reason && `Reason: ${r.reason}`].filter(Boolean).join(' · ') || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Mobile list */}
          <ol className="space-y-2 md:hidden">
            {rows.map((r) => {
              const v = describeHistory(r);
              return (
                <li key={r.id} className="panel flex items-start justify-between gap-3 p-3.5">
                  <div className="min-w-0">
                    <span className={`badge ring-1 ${TONE_CLASS[v.tone]}`}>{v.label}</span>
                    <p className="mt-1.5 text-sm text-muted">{formatDate(r.created_at)} · {formatTime(r.created_at)} · {r.staff_name ?? '—'}</p>
                    {(v.detail || r.reason) && <p className="mt-1 text-sm text-muted">{[v.detail, r.reason && `Reason: ${r.reason}`].filter(Boolean).join(' · ')}</p>}
                  </div>
                  <span className="font-display text-lg">{v.progress}</span>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </>
  );
}
