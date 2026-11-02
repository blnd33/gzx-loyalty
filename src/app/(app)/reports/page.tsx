import type { Metadata } from 'next';
import Link from 'next/link';
import { Gift, Hourglass, Trophy } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { rpc } from '@/lib/rpc';
import { TIMEZONE } from '@/lib/format';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { BarChart, type BarDatum } from '@/components/charts/BarChart';

export const metadata: Metadata = { title: 'Reports' };

interface Reports {
  daily: { day: string; paid_hours: number; redeemed: number; new_customers: number }[];
  weekly: { week_start: string; paid_hours: number; redeemed: number }[];
  monthly: { month_start: string; paid_hours: number; redeemed: number; new_customers: number }[];
  top_customers: { id: string; name: string; code: string; paid_hours: number; redeemed: number }[];
  totals: { earned: number; redeemed: number; outstanding: number };
}

// Dates from the DB are Baghdad calendar dates (YYYY-MM-DD); format them without shifting.
const d = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const days = sp.days === '7' ? 7 : sp.days === '90' ? 90 : 30;
  const r = await rpc<Reports>('get_reports', { p_days: days });

  const daily = (k: 'paid_hours' | 'redeemed'): BarDatum[] =>
    r.daily.map((x) => ({ key: x.day, label: d(x.day, { day: 'numeric' }), tooltip: d(x.day, { weekday: 'short', day: 'numeric', month: 'short' }), value: x[k] }));
  const weekly: BarDatum[] = r.weekly.map((x) => ({ key: x.week_start, label: d(x.week_start, { day: 'numeric', month: 'short' }), tooltip: `Week of ${d(x.week_start, { day: 'numeric', month: 'short' })}`, value: x.paid_hours }));
  const monthly: BarDatum[] = r.monthly.map((x) => ({ key: x.month_start, label: d(x.month_start, { month: 'short' }), tooltip: d(x.month_start, { month: 'long', year: 'numeric' }), value: x.paid_hours }));

  return (
    <>
      <PageHeader eyebrow="Loyalty statistics" title="Reports"
        actions={
          <div role="group" aria-label="Period" className="inline-flex rounded-xl border border-line bg-white/[0.03] p-1">
            {[7, 30, 90].map((n) => (
              <Link key={n} href={`/reports?days=${n}`} aria-current={days === n ? 'true' : undefined}
                className={`grid min-h-[40px] place-items-center rounded-lg px-4 text-sm font-semibold ${days === n ? 'bg-panel-2 text-white shadow-glow-pink' : 'text-muted hover:text-white'}`}>
                {n} days
              </Link>
            ))}
          </div>
        }>
        Days follow {TIMEZONE} time.
      </PageHeader>

      <section aria-label="Reward totals" className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Total rewards earned" value={r.totals.earned} icon={Gift} tone="gold" />
        <StatCard label="Total rewards redeemed" value={r.totals.redeemed} icon={Trophy} tone="green" />
        <StatCard label="Outstanding rewards" value={r.totals.outstanding} icon={Hourglass} tone="pink" hint="Unlocked, not yet used" />
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <BarChart title="Daily paid hours" data={daily('paid_hours')} color="#FF6B00" unit="paid hours" tickEvery={days > 30 ? 10 : days > 7 ? 5 : 1} />
        <BarChart title="Daily rewards redeemed" data={daily('redeemed')} color="#FFD447" unit="rewards" tickEvery={days > 30 ? 10 : days > 7 ? 5 : 1} />
        <BarChart title="Weekly paid hours (last 8 weeks)" data={weekly} color="#FF6B00" unit="paid hours" />
        <BarChart title="Monthly paid hours (last 6 months)" data={monthly} color="#FF6B00" unit="paid hours" />
      </div>

      <section className="panel mt-5" aria-labelledby="top-title">
        <h2 id="top-title" className="heading border-b border-line p-4 text-lg sm:px-5">Most active customers</h2>
        {r.top_customers.length === 0 ? (
          <p className="p-5 text-muted">No paid hours recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th scope="col">#</th><th scope="col">Customer</th><th scope="col">Code</th><th scope="col" className="text-right">Paid hours</th><th scope="col" className="text-right">Rewards used</th></tr></thead>
              <tbody>
                {r.top_customers.map((c, i) => (
                  <tr key={c.id}>
                    <td className="font-display text-muted">{i + 1}</td>
                    <td><Link href={`/customers/${c.id}`} className="font-semibold hover:text-neon-orange">{c.name}</Link></td>
                    <td className="font-display tracking-widest text-neon-gold">{c.code}</td>
                    <td className="text-right tabular-nums">{c.paid_hours}</td>
                    <td className="text-right tabular-nums">{c.redeemed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
