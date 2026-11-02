import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { CalendarPlus, CreditCard, Gift, Hourglass, Keyboard, ScanLine, Timer, Trophy, UserPlus, Users, QrCode } from 'lucide-react';
import { LoyaltyCardBack, LoyaltyCardFront } from '@/components/card/LoyaltyCard';
import { AppShell } from '@/components/shell/AppShell';
import { CustomerLoyalty } from '@/components/customer/CustomerLoyalty';
import { CodeEntry } from '@/components/scan/CodeEntry';
import { QrScanner } from '@/components/scan/QrScanner';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { ProgressBadge } from '@/components/ui/StatusBadge';
import { BarChart } from '@/components/charts/BarChart';
import type { StaffProfile } from '@/lib/types';

/**
 * Design preview with fixture data (no database). Disabled unless
 * ENABLE_DESIGN_PREVIEW=1 — never enable it in production.
 */
export const dynamic = 'force-dynamic';

const staff: StaffProfile = { id: 'x', full_name: 'Hassan Kareem', role: 'super_admin', active: true, created_at: '' };

export default async function PreviewPage({ searchParams }: { searchParams: Promise<{ screen?: string; p?: string }> }) {
  if (process.env.ENABLE_DESIGN_PREVIEW !== '1') notFound();
  const { screen = 'cards', p = '2' } = await searchParams;
  const qr = await QRCode.toString('https://gzx-loyalty.example/c/Xk2_9fQpLm3VbN8sRt4YwZ1aCd6EgH0j', {
    type: 'svg', errorCorrectionLevel: 'M', margin: 0, color: { dark: '#120A18', light: '#FFFFFF' },
  });

  if (screen === 'cards') {
    return (
      <main className="mx-auto grid max-w-5xl gap-8 p-6">
        <LoyaltyCardFront />
        <LoyaltyCardBack name="Ahmed Ali" code="AXKJTR" qrSvg={qr} punches={0} rewardAvailable={false} />
        <LoyaltyCardBack name="Ahmed Ali" code="AXKJTR" qrSvg={qr} punches={2} rewardAvailable={false} />
        <LoyaltyCardBack name="Mustafa Al-Rubaie" code="BPLMQR" qrSvg={qr} punches={3} rewardAvailable />
        <LoyaltyCardBack name="Ahmed Ali" code="AXKJTR" qrSvg={qr} punches={0} rewardAvailable={false} variant="print" />
      </main>
    );
  }

  const punches = Number(p);
  return (
    <AppShell staff={staff}>
      {screen === 'profile' && (
        <>
          <header className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2">
            <h1 className="heading text-2xl sm:text-3xl">Ahmed Ali</h1>
            <span className="rounded-lg border border-neon-gold/40 bg-neon-gold/10 px-3 py-1 font-display text-lg tracking-[0.2em] text-neon-gold">AXKJTR</span>
            <ProgressBadge punches={punches} cycleStatus={punches === 3 ? 'completed' : 'active'} cardStatus="active" />
          </header>
          <CustomerLoyalty customerId="00000000-0000-0000-0000-000000000001" name="Ahmed Ali" code="AXKJTR" qrSvg={qr}
            punches={punches} rewardAvailable={punches === 3} cycleNumber={2} cardActive customerActive rewardLabel="1 FREE HOUR + 1 FREE DRINK" />
        </>
      )}
      {screen === 'scan' && (
        <>
          <PageHeader eyebrow="Customer lookup" title="Scan or enter code">Opening a card never adds a paid hour — you confirm that on the next screen.</PageHeader>
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="panel panel-pad sm:p-6"><h2 className="heading mb-4 flex items-center gap-2 text-lg"><QrCode className="h-5 w-5 text-neon-orange" /> Scan QR code</h2><QrScanner /></section>
            <section className="panel panel-pad sm:p-6"><h2 className="heading mb-6 flex items-center gap-2 text-lg"><Keyboard className="h-5 w-5 text-neon-pink" /> Manual code</h2><CodeEntry /></section>
          </div>
        </>
      )}
      {screen === 'dashboard' && (
        <>
          <PageHeader eyebrow="Welcome back, Hassan" title="Dashboard" />
          <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[['Scan QR code', ScanLine, 'btn-primary'], ['Enter 6-letter code', Keyboard, 'btn-ghost'], ['Add new customer', UserPlus, 'btn-ghost'], ['View all customers', Users, 'btn-ghost']].map(([l, I, c]) => {
              const Icon = I as typeof Users;
              return <a key={l as string} href="#" className={`${c} min-h-[64px] justify-start rounded-2xl px-4 text-left text-[15px] uppercase tracking-wide sm:text-base`}><Icon className="h-6 w-6 flex-none" />{l as string}</a>;
            })}
          </section>
          <section className="mb-6 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Registered customers" value={248} icon={Users} tone="purple" />
            <StatCard label="Active loyalty cards" value={241} icon={CreditCard} tone="pink" />
            <StatCard label="Paid hours today" value={37} icon={Timer} tone="orange" />
            <StatCard label="Total paid hours" value={1932} icon={Hourglass} tone="orange" />
            <StatCard label="Rewards available" value={12} icon={Gift} tone="gold" />
            <StatCard label="Redeemed today" value={4} icon={Trophy} tone="green" />
            <StatCard label="Total rewards redeemed" value={598} icon={Trophy} tone="green" />
            <StatCard label="New customers this month" value={9} icon={CalendarPlus} tone="purple" />
          </section>
          <BarChart title="Daily paid hours" color="#FF6B00" unit="paid hours" tickEvery={5}
            data={Array.from({ length: 30 }, (_, i) => ({ key: String(i), label: String(i + 4), tooltip: `Day ${i + 4}`, value: [12, 18, 25, 9, 31, 40, 22][i % 7] + (i % 5) }))} />
        </>
      )}
    </AppShell>
  );
}
