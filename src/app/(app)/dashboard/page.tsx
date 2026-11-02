import type { Metadata } from 'next';
import Link from 'next/link';
import {
  CalendarPlus, CreditCard, Gift, Keyboard, ScanLine, Timer, Trophy, UserPlus, Users, Hourglass,
} from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { rpc } from '@/lib/rpc';
import { formatShortDate, formatTime } from '@/lib/format';
import { describeHistory, TONE_CLASS } from '@/lib/history';
import type { HistoryRow } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';

export const metadata: Metadata = { title: 'Dashboard' };

interface Stats {
  total_customers: number; active_cards: number; paid_hours_today: number; total_paid_hours: number;
  available_rewards: number; redeemed_today: number; total_redeemed: number; new_customers_month: number;
}
type Activity = HistoryRow & { customer_id: string; customer_name: string; code: string | null };

export default async function DashboardPage() {
  const staff = await requireAdmin();
  const [stats, activity] = await Promise.all([
    rpc<Stats>('get_dashboard_stats'),
    rpc<Activity[]>('get_recent_activity', { p_limit: 12 }),
  ]);

  const quick = [
    { href: '/scan', label: 'Scan QR code', icon: ScanLine, cls: 'btn-primary' },
    { href: '/scan#customer-code', label: 'Enter 6-letter code', icon: Keyboard, cls: 'btn-ghost' },
    { href: '/customers/new', label: 'Add new customer', icon: UserPlus, cls: 'btn-ghost' },
    { href: '/customers', label: 'View all customers', icon: Users, cls: 'btn-ghost' },
  ];

  return (
    <>
      <PageHeader eyebrow={`Welcome back, ${staff.full_name.split(' ')[0]}`} title="Dashboard" />

      <section aria-label="Quick actions" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {quick.map(({ href, label, icon: Icon, cls }) => (
          <Link key={href} href={href} className={`${cls} min-h-[64px] justify-start rounded-2xl px-4 text-left text-[15px] uppercase tracking-wide sm:text-base`}>
            <Icon className="h-6 w-6 flex-none" aria-hidden /> {label}
          </Link>
        ))}
      </section>

      <section aria-label="Statistics" className="mb-6 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Registered customers" value={stats.total_customers} icon={Users} tone="purple" />
        <StatCard label="Active loyalty cards" value={stats.active_cards} icon={CreditCard} tone="pink" />
        <StatCard label="Paid hours today" value={stats.paid_hours_today} icon={Timer} tone="orange" />
        <StatCard label="Total paid hours" value={stats.total_paid_hours} icon={Hourglass} tone="orange" />
        <StatCard label="Rewards available" value={stats.available_rewards} icon={Gift} tone="gold" />
        <StatCard label="Redeemed today" value={stats.redeemed_today} icon={Trophy} tone="green" />
        <StatCard label="Total rewards redeemed" value={stats.total_redeemed} icon={Trophy} tone="green" />
        <StatCard label="New customers this month" value={stats.new_customers_month} icon={CalendarPlus} tone="purple" />
      </section>

      <section className="panel" aria-labelledby="recent-title">
        <div className="flex items-center justify-between border-b border-line p-4 sm:px-5">
          <h2 id="recent-title" className="heading text-lg">Recent activity</h2>
          <Link href="/reports" className="text-sm text-muted hover:text-white">Reports →</Link>
        </div>
        {activity.length === 0 ? (
          <p className="p-5 text-muted">No activity yet. Register a customer to get started.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {activity.map((a) => {
              const v = describeHistory(a);
              return (
                <li key={a.id}>
                  <Link href={`/customers/${a.customer_id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 transition-colors hover:bg-white/[0.03] sm:px-5">
                    <span className={`badge ring-1 ${TONE_CLASS[v.tone]}`}>{v.label}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold">
                      {a.customer_name} <span className="ml-1 font-display text-sm tracking-widest text-neon-gold">{a.code}</span>
                    </span>
                    <span className="font-display text-sm">{v.progress}</span>
                    <span className="w-full text-sm text-muted sm:w-auto">{a.staff_name ?? '—'} · {formatShortDate(a.created_at)} {formatTime(a.created_at)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
