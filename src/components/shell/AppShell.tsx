'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard, ScanLine, Users, UserPlus, Gift, BarChart3, ShieldCheck, Settings, LogOut, Menu, X,
} from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import type { StaffProfile } from '@/lib/types';

type Item = { href: string; label: string; icon: typeof Users; admin?: boolean };

const NAV: Item[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, admin: true },
  { href: '/scan', label: 'Scan / Find', icon: ScanLine },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/customers/new', label: 'New Customer', icon: UserPlus },
  { href: '/rewards', label: 'Rewards', icon: Gift },
  { href: '/reports', label: 'Reports', icon: BarChart3, admin: true },
  { href: '/staff', label: 'Staff', icon: ShieldCheck, admin: true },
  { href: '/settings', label: 'Settings', icon: Settings, admin: true },
];

const BOTTOM = ['/scan', '/customers', '/customers/new', '/rewards'];

function isActive(path: string, href: string) {
  if (href === '/customers') return path === '/customers' || (path.startsWith('/customers/') && !path.startsWith('/customers/new'));
  return path === href || path.startsWith(`${href}/`);
}

export function AppShell({ staff, children }: { staff: StaffProfile; children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const items = NAV.filter((i) => !i.admin || staff.role === 'super_admin');
  useEffect(() => setOpen(false), [path]);

  const navList = (
    <ul className="space-y-1">
      {items.map(({ href, label, icon: Icon }) => {
        const active = isActive(path, href);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`group flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-[15px] font-semibold transition-colors ${
                active
                  ? 'bg-gradient-to-r from-neon-orange/20 to-neon-pink/10 text-white shadow-[inset_3px_0_0_#FF6B00]'
                  : 'text-muted hover:bg-white/[0.05] hover:text-white'
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? 'text-neon-orange' : 'text-muted group-hover:text-white'}`} aria-hidden />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  const userBlock = (
    <div className="rounded-xl border border-line bg-white/[0.03] p-3">
      <p className="truncate text-sm font-semibold">{staff.full_name}</p>
      <p className="mb-2 text-xs uppercase tracking-wider text-muted">
        {staff.role === 'super_admin' ? 'Super Admin' : 'Cashier'}
      </p>
      <form action="/auth/signout" method="post">
        <button className="btn-ghost w-full text-sm" type="submit">
          <LogOut className="h-4 w-4" aria-hidden /> Sign out
        </button>
      </form>
    </div>
  );

  return (
    <div className="min-h-dvh lg:pl-64">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-panel focus:px-3 focus:py-2">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-rail/95 px-4 py-5 lg:flex">
        <Link href="/" className="mb-7 px-1"><Logo /></Link>
        <nav aria-label="Main" className="flex-1 overflow-y-auto">{navList}</nav>
        {userBlock}
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-rail/90 px-4 backdrop-blur lg:hidden"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <Link href="/"><Logo size={36} /></Link>
        <button className="btn-ghost h-11 w-11 px-0" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="absolute inset-0 bg-black/70" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-[82%] max-w-xs animate-fade-up flex-col bg-rail p-4">
            <div className="mb-5 flex items-center justify-between">
              <Logo size={34} />
              <button className="btn-ghost h-11 w-11 px-0" aria-label="Close menu" onClick={() => setOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav aria-label="Main" className="flex-1 overflow-y-auto">{navList}</nav>
            {userBlock}
          </div>
        </div>
      )}

      <main id="main" className="mx-auto w-full max-w-7xl px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">
        {children}
      </main>

      {/* Mobile bottom nav (4 key actions) */}
      <nav aria-label="Quick" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-rail/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <ul className="grid grid-cols-4">
          {BOTTOM.map((href) => {
            const item = NAV.find((n) => n.href === href)!;
            const Icon = item.icon;
            const active = isActive(path, href);
            return (
              <li key={href}>
                <Link href={href} aria-current={active ? 'page' : undefined}
                  className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${active ? 'text-neon-orange' : 'text-muted'}`}>
                  <Icon className="h-6 w-6" aria-hidden />
                  {item.label.replace(' / Find', '')}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
