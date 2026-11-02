'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  Copy, Download, Gift, History, Loader2, PartyPopper, Plus, Printer, Timer, CircleSlash,
} from 'lucide-react';
import { LoyaltyCardBack, LoyaltyCardFront } from '@/components/card/LoyaltyCard';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { addPaidHour, redeemReward } from '@/lib/actions/loyalty';
import { useIdempotencyKey } from '@/lib/useIdempotencyKey';
import { downloadNodeAsPng } from './CardExport';
import { copyText } from '@/lib/clipboard';

interface Props {
  customerId: string;
  name: string;
  code: string;
  qrSvg: string;
  punches: number;
  rewardAvailable: boolean;
  cycleNumber: number;
  cardActive: boolean;
  customerActive: boolean;
  rewardLabel: string;
  tagline?: string;
}

export function CustomerLoyalty(p: Props) {
  const router = useRouter();
  const [side, setSide] = useState<'back' | 'front'>('back');
  const [dialog, setDialog] = useState<'punch' | 'redeem' | null>(null);
  const [pending, startTransition] = useTransition();
  const [justPunched, setJustPunched] = useState<number | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [receipt, setReceipt] = useState('');
  const [downloading, setDownloading] = useState(false);
  const punchKey = useIdempotencyKey();
  const redeemKey = useIdempotencyKey();
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);

  // Keep progress consistent across devices: refresh when the tab regains focus.
  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && router.refresh();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [router]);

  const blocked = !p.cardActive || !p.customerActive;
  const canPunch = !blocked && !p.rewardAvailable && p.punches < 3;

  function confirmPunch() {
    startTransition(async () => {
      const res = await addPaidHour({
        customerId: p.customerId,
        idempotencyKey: punchKey.get(),
        receiptReference: receipt || undefined,
      });
      if (!res.ok) {
        toast.error(res.error);
        if (res.code) { punchKey.reset(); setDialog(null); router.refresh(); }
        return; // network failure: keep the key so a retry can't double-punch
      }
      punchKey.reset();
      setReceipt('');
      setDialog(null);
      if (res.data.duplicate) {
        toast.info('That paid hour was already recorded.');
      } else if (res.data.reward_unlocked) {
        setJustPunched(3);
        setCelebrate(true);
        toast.success('REWARD UNLOCKED! ' + p.rewardLabel);
      } else {
        setJustPunched(res.data.punch_number);
        toast.success(`Paid hour recorded — ${res.data.punch_count}/3`);
      }
      router.refresh();
    });
  }

  function confirmRedeem() {
    startTransition(async () => {
      const res = await redeemReward({ customerId: p.customerId, idempotencyKey: redeemKey.get() });
      if (!res.ok) {
        toast.error(res.error);
        if (res.code) { redeemKey.reset(); setDialog(null); router.refresh(); }
        return;
      }
      redeemKey.reset();
      setDialog(null);
      setCelebrate(false);
      setJustPunched(null);
      toast.success(res.data.duplicate ? 'Reward was already redeemed.' : `Reward redeemed! New card cycle #${res.data.cycle_number} started at 0/3.`);
      router.refresh();
    });
  }

  async function copyCode() {
    try {
      await copyText(p.code);
      toast.success(`Code ${p.code} copied`);
    } catch {
      toast.error('Could not copy — select the code manually.');
    }
  }

  async function download() {
    setDownloading(true);
    try {
      await downloadNodeAsPng(frontRef.current!, `GZX-${p.code}-front.png`);
      await downloadNodeAsPng(backRef.current!, `GZX-${p.code}-back.png`);
    } catch {
      toast.error('Download failed. Try Print instead.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] xl:grid-rows-[auto_1fr]">
      {/* ---------- Card ---------- */}
      <section aria-label="Loyalty card" className="min-w-0 xl:col-start-1 xl:row-start-1">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div role="tablist" aria-label="Card side" className="inline-flex rounded-xl border border-line bg-white/[0.03] p-1">
            {(['back', 'front'] as const).map((s) => (
              <button key={s} role="tab" aria-selected={side === s} onClick={() => setSide(s)}
                className={`min-h-[36px] rounded-lg px-4 text-sm font-semibold transition-colors ${side === s ? 'bg-panel-2 text-white shadow-glow-pink' : 'text-muted hover:text-white'}`}>
                {s === 'back' ? 'Progress side' : 'Front'}
              </button>
            ))}
          </div>
          <span className="text-sm text-muted">Cycle #{p.cycleNumber}</span>
        </div>
        <div className="mx-auto max-w-[640px]">
          {side === 'back' ? (
            <LoyaltyCardBack name={p.name} code={p.code} qrSvg={p.qrSvg} punches={p.punches}
              rewardAvailable={p.rewardAvailable} justPunched={justPunched} tagline={p.tagline} />
          ) : (
            <LoyaltyCardFront />
          )}
        </div>
      </section>

      {/* ---------- Actions ---------- */}
      <section aria-label="Loyalty actions" className="panel panel-pad flex flex-col gap-4 sm:p-6 xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:self-start">
        <div className="flex items-end justify-between">
          <div>
            <p className="eyebrow">Current progress</p>
            <p className="font-display text-5xl leading-none">
              <span className={p.rewardAvailable ? 'text-neon-gold' : 'text-neon-orange'}>{p.punches}</span>
              <span className="text-2xl text-muted">/3</span>
            </p>
          </div>
          <p className="text-right text-sm text-muted">paid hours<br />this cycle</p>
        </div>
        <div className="flex gap-1.5" aria-hidden>
          {[1, 2, 3].map((n) => (
            <span key={n} className={`h-2.5 flex-1 rounded-full transition-colors duration-300 ${n <= p.punches ? 'bg-gradient-to-r from-neon-orange to-[#ff9a3c] shadow-[0_0_10px_#FF6B00]' : 'bg-white/10'}`} />
          ))}
          <span className={`h-2.5 flex-1 rounded-full ${p.rewardAvailable ? 'bg-neon-gold shadow-[0_0_12px_#FFD447]' : 'bg-neon-gold/15'}`} />
        </div>

        {blocked && (
          <p role="alert" className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-muted">
            <CircleSlash className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
            {!p.customerActive ? 'This customer is deactivated.' : 'This card is deactivated.'} Paid hours and rewards are disabled until an admin reactivates or reissues it.
          </p>
        )}

        {p.rewardAvailable ? (
          <div className={`rounded-2xl border border-neon-gold/60 bg-gradient-to-br from-neon-gold/20 via-neon-orange/10 to-transparent p-4 text-center ${celebrate ? 'animate-reward-glow' : ''}`}>
            <p className="flex items-center justify-center gap-2 font-display text-lg text-neon-gold">
              {celebrate ? <PartyPopper className="h-5 w-5" aria-hidden /> : <Gift className="h-5 w-5" aria-hidden />}
              {celebrate ? 'Reward unlocked!' : 'Reward available'}
            </p>
            <p className="mt-1 font-display text-xl">{p.rewardLabel}</p>
            <button className="btn-gold btn-lg mt-4 w-full text-lg" disabled={blocked} onClick={() => setDialog('redeem')}>
              <Gift className="h-6 w-6" aria-hidden /> Redeem reward
            </button>
            <p className="mt-2 text-xs text-muted">Redeem before recording more paid hours.</p>
          </div>
        ) : (
          <>
            <button className="btn-primary btn-lg w-full text-lg" disabled={!canPunch} onClick={() => setDialog('punch')}>
              <Plus className="h-6 w-6" aria-hidden /> Add 1 paid hour
            </button>
            <p className="-mt-2 text-center text-sm text-muted">
              {3 - p.punches} more paid {3 - p.punches === 1 ? 'hour' : 'hours'} to unlock <span className="text-neon-gold">{p.rewardLabel}</span>
            </p>
          </>
        )}
      </section>

      {/* ---------- Secondary actions (after the main action on phones) ---------- */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:col-start-1 xl:row-start-2 xl:self-start">
        <Link href={`/customers/${p.customerId}/history`} className="btn-ghost whitespace-nowrap px-2 text-sm"><History className="h-4 w-4" aria-hidden /> History</Link>
        <Link href={`/print/${p.customerId}`} target="_blank" className="btn-ghost whitespace-nowrap px-2 text-sm"><Printer className="h-4 w-4" aria-hidden /> Print card</Link>
        <button onClick={download} disabled={downloading} className="btn-ghost whitespace-nowrap px-2 text-sm">
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />} Download PNG
        </button>
        <button onClick={copyCode} className="btn-ghost whitespace-nowrap px-2 text-sm"><Copy className="h-4 w-4" aria-hidden /> Copy code</button>
      </div>

      <ConfirmDialog
        open={dialog === 'punch'}
        onOpenChange={(o) => setDialog(o ? 'punch' : null)}
        title="Confirm paid hour"
        icon={<Timer className="h-9 w-9 text-neon-orange" aria-hidden />}
        description={<>Confirm that <b className="text-white">{p.name}</b> has completed and paid for <b className="text-white">1 gaming hour</b>?</>}
        confirmLabel="Confirm paid hour"
        pending={pending}
        onConfirm={confirmPunch}
      >
        <label htmlFor="receipt" className="field-label">Receipt / session no. <span className="font-normal text-muted">(optional)</span></label>
        <input id="receipt" className="input" maxLength={64} value={receipt} onChange={(e) => setReceipt(e.target.value)} placeholder="e.g. PS5-3 #1042" />
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === 'redeem'}
        onOpenChange={(o) => setDialog(o ? 'redeem' : null)}
        title="Redeem reward"
        tone="gold"
        icon={<Gift className="h-9 w-9 text-neon-gold" aria-hidden />}
        description={<>Confirm that <b className="text-white">{p.name}</b> is receiving the <b className="text-neon-gold">free gaming hour and free drink</b>. The card then starts a new cycle at 0/3.</>}
        confirmLabel="Confirm redemption"
        pending={pending}
        onConfirm={confirmRedeem}
      />

      {/* Off-screen export copies at physical card resolution */}
      <div aria-hidden className="pointer-events-none fixed -left-[5000px] top-0 w-[1011px]">
        <div ref={frontRef}><LoyaltyCardFront glow={false} /></div>
        <div ref={backRef}>
          <LoyaltyCardBack name={p.name} code={p.code} qrSvg={p.qrSvg} punches={p.punches} rewardAvailable={p.rewardAvailable} glow={false} tagline={p.tagline} />
        </div>
      </div>
      <span className="sr-only" aria-live="polite">{p.punches} of 3 paid hours{p.rewardAvailable ? ', reward available' : ''}</span>
    </div>
  );
}
