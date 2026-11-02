import type { Metadata } from 'next';
import Link from 'next/link';
import { Gift, Trophy } from 'lucide-react';
import { rpc } from '@/lib/rpc';
import { formatDateTime, relativeDay } from '@/lib/format';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = { title: 'Rewards' };

interface RewardRow {
  reward_id: string; customer_id: string; customer_name: string; code: string | null; status: string;
  unlocked_at: string; redeemed_at: string | null; staff_name: string | null;
}

export default async function RewardsPage() {
  const [available, redeemed] = await Promise.all([
    rpc<RewardRow[]>('list_rewards', { p_status: 'available', p_limit: 200 }),
    rpc<RewardRow[]>('list_rewards', { p_status: 'redeemed', p_limit: 30 }),
  ]);

  return (
    <>
      <PageHeader eyebrow="1 free hour + 1 free drink" title="Rewards">
        Open a customer to redeem — redemption always needs a confirmation.
      </PageHeader>

      <section aria-labelledby="avail-title" className="mb-6">
        <h2 id="avail-title" className="heading mb-3 flex items-center gap-2 text-lg">
          <Gift className="h-5 w-5 text-neon-gold" aria-hidden /> Available now <span className="text-muted">({available.length})</span>
        </h2>
        {available.length === 0 ? (
          <p className="panel panel-pad text-muted">No outstanding rewards.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {available.map((r) => (
              <li key={r.reward_id}>
                <Link href={`/customers/${r.customer_id}`}
                  className="panel flex items-center gap-3 border-neon-gold/40 p-4 transition-shadow hover:shadow-glow-gold">
                  <span className="grid h-12 w-12 flex-none place-items-center rounded-full bg-neon-gold/15 ring-1 ring-neon-gold/50">
                    <Gift className="h-6 w-6 text-neon-gold" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{r.customer_name}</span>
                    <span className="block text-sm text-muted">Unlocked {relativeDay(r.unlocked_at).toLowerCase()}</span>
                  </span>
                  <span className="font-display tracking-widest text-neon-gold">{r.code}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="red-title" className="panel">
        <h2 id="red-title" className="heading flex items-center gap-2 border-b border-line p-4 text-lg sm:px-5">
          <Trophy className="h-5 w-5 text-success" aria-hidden /> Recently redeemed
        </h2>
        {redeemed.length === 0 ? (
          <p className="p-5 text-muted">Nothing redeemed yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th scope="col">Customer</th><th scope="col">Code</th><th scope="col">Redeemed</th><th scope="col">Staff</th></tr></thead>
              <tbody>
                {redeemed.map((r) => (
                  <tr key={r.reward_id}>
                    <td><Link href={`/customers/${r.customer_id}`} className="font-semibold hover:text-neon-orange">{r.customer_name}</Link></td>
                    <td className="font-display tracking-widest text-neon-gold">{r.code}</td>
                    <td className="whitespace-nowrap text-muted">{formatDateTime(r.redeemed_at)}</td>
                    <td>{r.staff_name ?? '—'}</td>
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
