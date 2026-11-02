import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CalendarDays, Clock3, Gift, Phone, StickyNote, Timer } from 'lucide-react';
import { requireStaff } from '@/lib/auth';
import { rpc, RpcError } from '@/lib/rpc';
import { cardQrSvg } from '@/lib/qr';
import { getSettings } from '@/lib/settings';
import { formatDate, formatDateTime, relativeDay } from '@/lib/format';
import { uuidSchema } from '@/lib/validation';
import type { CustomerProfile } from '@/lib/types';
import { CustomerLoyalty } from '@/components/customer/CustomerLoyalty';
import { CustomerTools } from '@/components/customer/CustomerTools';
import { ProgressBadge } from '@/components/ui/StatusBadge';

export const metadata: Metadata = { title: 'Customer' };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const staff = await requireStaff();

  let c: CustomerProfile;
  try {
    c = await rpc<CustomerProfile>('get_customer_profile', { p_customer_id: id });
  } catch (e) {
    if (e instanceof RpcError && e.code === 'CUSTOMER_NOT_FOUND') notFound();
    throw e;
  }
  const [qrSvg, settings] = await Promise.all([c.card ? cardQrSvg(c.card.qr_token) : Promise.resolve(''), getSettings()]);
  const rewardAvailable = c.state?.cycle_status === 'completed';
  const punches = c.state?.punch_count ?? 0;

  return (
    <>
      <Link href="/customers" className="mb-3 inline-flex min-h-[44px] items-center gap-1.5 text-sm text-muted hover:text-white">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Customers
      </Link>

      <header className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="heading min-w-0 truncate text-2xl sm:text-3xl">{c.name}</h1>
        {c.card && (
          <span className="rounded-lg border border-neon-gold/40 bg-neon-gold/10 px-3 py-1 font-display text-lg tracking-[0.2em] text-neon-gold">
            {c.card.code}
          </span>
        )}
        <ProgressBadge punches={punches} cycleStatus={c.state?.cycle_status ?? null} cardStatus={c.card?.status} />
        {!c.active && <span className="badge bg-danger/15 text-[#ff9aab]">Customer deactivated</span>}
      </header>

      {c.card ? (
        <CustomerLoyalty
          customerId={c.id}
          name={c.name}
          code={c.card.code}
          qrSvg={qrSvg}
          punches={punches}
          rewardAvailable={rewardAvailable}
          cycleNumber={c.state?.cycle_number ?? 1}
          cardActive={c.card.status === 'active'}
          customerActive={c.active}
          rewardLabel={settings.reward_label}
        />
      ) : (
        <p className="panel panel-pad text-muted">This customer has no active card. An admin can reissue one below.</p>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <section className="panel panel-pad" aria-labelledby="info-title">
          <h2 id="info-title" className="eyebrow mb-3">Customer information</h2>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Info icon={Timer} label="Total paid hours" value={String(c.total_paid_hours)} />
            <Info icon={Gift} label="Rewards redeemed" value={String(c.total_rewards_redeemed)} />
            <Info icon={Clock3} label="Last visit" value={c.last_visit_at ? `${relativeDay(c.last_visit_at)} · ${formatDateTime(c.last_visit_at)}` : 'No visits yet'} />
            <Info icon={CalendarDays} label="Registered" value={formatDate(c.created_at)} />
            <Info icon={Phone} label="Phone" value={c.phone ?? '—'} />
            {rewardAvailable && c.reward_unlocked_at && <Info icon={Gift} label="Reward unlocked" value={formatDateTime(c.reward_unlocked_at)} />}
            {c.notes && <div className="sm:col-span-2"><Info icon={StickyNote} label="Notes" value={c.notes} /></div>}
            {c.card?.status === 'deactivated' && c.card.status_reason && (
              <div className="sm:col-span-2"><Info icon={StickyNote} label="Card deactivated because" value={c.card.status_reason} /></div>
            )}
          </dl>
        </section>
        <CustomerTools
          isAdmin={staff.role === 'super_admin'}
          customerId={c.id}
          name={c.name}
          phone={c.phone}
          notes={c.notes}
          cardActive={c.card?.status === 'active'}
          customerActive={c.active}
          punches={punches}
        />
      </div>
    </>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof Timer; label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 h-5 w-5 flex-none text-neon-pink" aria-hidden />
      <div className="min-w-0">
        <dt className="text-sm text-muted">{label}</dt>
        <dd className="break-words font-semibold">{value}</dd>
      </div>
    </div>
  );
}
