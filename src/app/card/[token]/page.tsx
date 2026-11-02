import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Gift, LockKeyhole } from 'lucide-react';
import { readPublicCard, publicCardVersion } from '@/lib/public-card';
import { getSettings } from '@/lib/settings';
import { cardQrSvg } from '@/lib/qr';
import { LoyaltyCardBack } from '@/components/card/LoyaltyCard';
import { Logo } from '@/components/ui/Logo';
import { RefreshCard } from './RefreshCard';

export const dynamic='force-dynamic';
export const metadata: Metadata={title:'My loyalty card',robots:{index:false,follow:false},referrer:'no-referrer'};

export default async function CustomerCard({params}:{params:Promise<{token:string}>}) {
  const {token}=await params;
  const card=await readPublicCard(token);
  if(!card) notFound();
  const settings=await getSettings();
  const qrSvg=await cardQrSvg(token);
  return <main className="mx-auto min-h-dvh w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
    <header className="mb-8 flex flex-wrap items-center justify-between gap-3"><Logo /><span className="text-sm text-muted">{settings.lounge_name}</span></header>
    <p className="eyebrow mb-2">Your loyalty card</p>
    <h1 className="heading mb-2 text-3xl">{card.name}</h1>
    <p className="mb-6 text-muted">Your next reward is getting closer. Show this card to the lounge staff when you play.</p>
    <LoyaltyCardBack name={card.name} code={card.code} qrSvg={qrSvg} punches={card.punches} rewardAvailable={card.rewardAvailable} tagline={settings.card_tagline} />
    <section className={`panel panel-pad mt-6 space-y-3 ${card.rewardAvailable?'border-neon-gold/50':''}`} aria-label="Your progress">
      <div className="flex items-end justify-between gap-4"><div><p className="eyebrow">Paid hours this cycle</p><p className="font-display text-4xl"><span className="text-neon-orange">{card.punches}</span><span className="text-muted"> / 3</span></p></div><span className="text-sm text-muted">Cycle #{card.cycleNumber}</span></div>
      <p className="text-sm text-muted" aria-live="polite">{card.punches} paid {card.punches===1?'hour':'hours'} recorded this cycle</p>
      {card.rewardAvailable ? <div role="status" className="rounded-xl bg-neon-gold/10 p-4"><h2 className="heading flex items-center gap-2 text-xl text-neon-gold"><Gift className="h-6 w-6" />Reward ready!</h2><p className="mt-2 font-semibold">{settings.reward_label}</p><p className="mt-1 text-sm text-muted">Ask staff to redeem it on your next visit.</p></div>
        : <p>{3-card.punches} more paid {3-card.punches===1?'hour':'hours'} to unlock <span className="font-semibold text-neon-gold">{settings.reward_label}</span>.</p>}
      <RefreshCard token={token} initialVersion={publicCardVersion(card)} />
    </section>
    <p className="mt-5 flex items-start gap-2 text-sm text-muted"><LockKeyhole className="mt-0.5 h-4 w-4 flex-none" />Keep this link private. Anyone with this link or your card’s QR can view this card. Only staff can record paid hours or redeem rewards.</p>
  </main>;
}
