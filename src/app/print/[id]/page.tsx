import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { rpc, RpcError } from '@/lib/rpc';
import { cardQrSvg } from '@/lib/qr';
import { getSettings } from '@/lib/settings';
import { uuidSchema } from '@/lib/validation';
import type { CustomerProfile } from '@/lib/types';
import { LoyaltyCardBack, LoyaltyCardFront } from '@/components/card/LoyaltyCard';
import { PrintToolbar } from './PrintToolbar';

export const metadata: Metadata = { title: 'Print card' };
export const dynamic = 'force-dynamic';

/**
 * Print layout: each side is a separate page of 91.6 × 60 mm
 * (85.6 × 54 mm trim + 3 mm bleed on every side). Artwork extends into the
 * bleed; text and QR stay ≥ 3 mm inside the trim line (safe area).
 */
export default async function PrintPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  if (!uuidSchema.safeParse(id).success) notFound();
  await requireStaff();
  let c: CustomerProfile;
  try {
    c = await rpc<CustomerProfile>('get_customer_profile', { p_customer_id: id });
  } catch (e) {
    if (e instanceof RpcError && e.code === 'CUSTOMER_NOT_FOUND') notFound();
    throw e;
  }
  if (!c.card) notFound();
  const qr = await cardQrSvg(c.card.qr_token);
  const settings = await getSettings();
  const marks = sp.marks === '1';

  return (
    <div className="print-root">
      <style>{`
        @page { size: 91.6mm 60mm; margin: 0; }
        @media print {
          html, body { background: #000 !important; }
          .print-toolbar { display: none !important; }
          .print-sheet { margin: 0 !important; box-shadow: none !important; page-break-after: always; break-after: page; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        .print-sheet { position: relative; width: 91.6mm; height: 60mm; overflow: hidden; margin: 0 auto 10mm; background: #1b0d22; box-shadow: 0 10px 40px rgba(0,0,0,.6); }
        .print-sheet .bleed { position: absolute; inset: 0; }
        .print-sheet .trim { position: absolute; left: 3mm; top: 3mm; width: 85.6mm; height: 54mm; }
        .print-sheet .gzx-card { border-radius: 0; width: 100%; height: 100%; aspect-ratio: auto; }
        .print-sheet .bleed-art { position: absolute; inset: 0; background-size: cover; background-position: center; filter: blur(0.6mm); transform: scale(1.04); }
        .mark { position: absolute; background: #fff; }
      `}</style>
      <PrintToolbar customerId={c.id} code={c.card.code} marks={marks} />

      {(['front', 'back'] as const).map((side) => (
        <section key={side} className="print-sheet" aria-label={`Card ${side}`}>
          <div className="bleed-art" style={{ backgroundImage: `url(/brand/${side === 'front' ? 'card-front' : 'card-back-bg'}.webp)` }} />
          <div className="trim">
            {side === 'front' ? (
              <LoyaltyCardFront glow={false} />
            ) : (
              <LoyaltyCardBack name={c.name} code={c.card!.code} qrSvg={qr} punches={0} rewardAvailable={false} variant="print" glow={false} tagline={settings.card_tagline} />
            )}
          </div>
          {marks && <CropMarks />}
        </section>
      ))}
    </div>
  );
}

function CropMarks() {
  // 3 mm crop marks at the trim corners, drawn inside the bleed area
  const s = { len: '2.4mm', w: '0.15mm' };
  const pos: React.CSSProperties[] = [];
  for (const x of ['3mm', 'calc(100% - 3mm)']) for (const y of ['0', 'calc(100% - 2.4mm)']) pos.push({ left: x, top: y, width: s.w, height: s.len });
  for (const y of ['3mm', 'calc(100% - 3mm)']) for (const x of ['0', 'calc(100% - 2.4mm)']) pos.push({ left: x, top: y, width: s.len, height: s.w });
  return <>{pos.map((st, i) => <span key={i} className="mark" style={st} />)}</>;
}
