import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Printer, Search, UserPlus } from 'lucide-react';
import { rpc } from '@/lib/rpc';
import { formatDate, relativeDay } from '@/lib/format';
import type { CustomerRow } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProgressBadge, PunchDots } from '@/components/ui/StatusBadge';

export const metadata: Metadata = { title: 'Customers' };
const PAGE_SIZE = 25;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const q = (sp.q ?? '').slice(0, 100);
  const reward = ['available', 'none'].includes(sp.reward ?? '') ? sp.reward! : 'all';
  const sort = ['newest', 'name'].includes(sp.sort ?? '') ? sp.sort! : 'recent';
  const from = sp.from && DATE_RE.test(sp.from) ? sp.from : null;
  const to = sp.to && DATE_RE.test(sp.to) ? sp.to : null;
  const page = Math.max(1, Math.min(10_000, Number.parseInt(sp.page ?? '1', 10) || 1));

  const rows = await rpc<CustomerRow[]>('search_customers', {
    p_query: q || null, p_reward: reward, p_registered_from: from, p_registered_to: to,
    p_sort: sort, p_limit: PAGE_SIZE, p_offset: (page - 1) * PAGE_SIZE,
  });
  const total = rows[0]?.total_count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const link = (p: number) => {
    const u = new URLSearchParams();
    if (q) u.set('q', q);
    if (reward !== 'all') u.set('reward', reward);
    if (sort !== 'recent') u.set('sort', sort);
    if (from) u.set('from', from);
    if (to) u.set('to', to);
    if (p > 1) u.set('page', String(p));
    return `/customers${u.size ? `?${u}` : ''}`;
  };

  return (
    <>
      <PageHeader eyebrow="Management" title="Customers"
        actions={<Link href="/customers/new" className="btn-primary"><UserPlus className="h-5 w-5" aria-hidden /> Add customer</Link>}>
        {total} {total === 1 ? 'customer' : 'customers'}{q || reward !== 'all' || from || to ? ' match your filters' : ''}
      </PageHeader>

      <form method="get" role="search" className="panel panel-pad mb-4 grid gap-3 md:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto] md:items-end">
        <div>
          <label htmlFor="q" className="field-label">Search</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden />
            <input id="q" name="q" defaultValue={q} className="input pl-10" placeholder="Name, 6-letter code or phone" autoComplete="off" />
          </div>
        </div>
        <div>
          <label htmlFor="reward" className="field-label">Reward</label>
          <select id="reward" name="reward" defaultValue={reward} className="input">
            <option value="all">All</option>
            <option value="available">Reward available</option>
            <option value="none">No reward yet</option>
          </select>
        </div>
        <div>
          <label htmlFor="from" className="field-label">Registered from</label>
          <input id="from" name="from" type="date" defaultValue={from ?? ''} className="input" />
        </div>
        <div>
          <label htmlFor="to" className="field-label">Registered to</label>
          <input id="to" name="to" type="date" defaultValue={to ?? ''} className="input" />
        </div>
        <div>
          <label htmlFor="sort" className="field-label">Sort</label>
          <select id="sort" name="sort" defaultValue={sort} className="input">
            <option value="recent">Recent activity</option>
            <option value="newest">Newest registered</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>
        <button className="btn-primary" type="submit"><Search className="h-4 w-4" aria-hidden /> Apply</button>
      </form>

      {rows.length === 0 ? (
        <div className="panel panel-pad text-center text-muted">
          No customers found. <Link href="/customers/new" className="text-neon-orange hover:underline">Register a new customer</Link>
        </div>
      ) : (
        <>
          <div className="panel hidden overflow-x-auto lg:block">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Customer</th><th scope="col">Code</th><th scope="col">Phone</th><th scope="col">Punches</th>
                  <th scope="col">Reward status</th><th scope="col">Last visit</th><th scope="col">Registered</th><th scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className={c.active ? '' : 'opacity-60'}>
                    <td><Link href={`/customers/${c.id}`} className="font-semibold hover:text-neon-orange">{c.name}</Link></td>
                    <td className="font-display tracking-widest text-neon-gold">{c.code ?? '—'}</td>
                    <td className="text-muted">{c.phone ?? '—'}</td>
                    <td><PunchDots punches={c.punch_count ?? 0} reward={c.cycle_status === 'completed'} /></td>
                    <td><ProgressBadge punches={c.punch_count} cycleStatus={c.cycle_status} cardStatus={c.card_status} /></td>
                    <td className="whitespace-nowrap text-muted">{relativeDay(c.last_visit_at)}</td>
                    <td className="whitespace-nowrap text-muted">{formatDate(c.created_at)}</td>
                    <td className="whitespace-nowrap text-right">
                      <Link href={`/customers/${c.id}`} className="btn-ghost min-h-[36px] px-3 text-sm">Open card</Link>{' '}
                      <Link href={`/print/${c.id}`} target="_blank" className="btn-ghost min-h-[36px] px-2.5" aria-label={`Print card for ${c.name}`}>
                        <Printer className="h-4 w-4" aria-hidden />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-2 lg:hidden">
            {rows.map((c) => (
              <li key={c.id}>
                <Link href={`/customers/${c.id}`} className={`panel flex items-center gap-3 p-3.5 transition-colors hover:border-white/15 ${c.active ? '' : 'opacity-60'}`}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{c.name}</p>
                    <p className="text-sm text-muted">{relativeDay(c.last_visit_at)}{c.phone ? ` · ${c.phone}` : ''}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="font-display text-sm tracking-widest text-neon-gold">{c.code}</span>
                    <ProgressBadge punches={c.punch_count} cycleStatus={c.cycle_status} cardStatus={c.card_status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {pages > 1 && (
            <nav aria-label="Pagination" className="mt-4 flex items-center justify-between">
              {page > 1 ? <Link href={link(page - 1)} className="btn-ghost"><ChevronLeft className="h-4 w-4" aria-hidden /> Previous</Link> : <span />}
              <span className="text-sm text-muted">Page {page} of {pages}</span>
              {page < pages ? <Link href={link(page + 1)} className="btn-ghost">Next <ChevronRight className="h-4 w-4" aria-hidden /></Link> : <span />}
            </nav>
          )}
        </>
      )}
    </>
  );
}
