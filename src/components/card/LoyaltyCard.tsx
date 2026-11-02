import { Check, CupSoda, Gift, Lock } from 'lucide-react';
import { ordinal } from '@/lib/format';

/* eslint-disable @next/next/no-img-element -- plain <img> keeps PNG export & print reliable */

export function LoyaltyCardFront({ className = '', glow = true }: { className?: string; glow?: boolean }) {
  return (
    <div className={`gzx-card ${glow ? 'gzx-card--glow' : ''} ${className}`} role="img"
      aria-label="GZX Gaming loyalty card, front: GZX Gaming flame logo, loyalty card title, Miami sunset with palm trees">
      <img className="gzx-card__bg" src="/brand/card-front.webp" alt="" draggable={false} />
    </div>
  );
}

export interface CardBackProps {
  name: string;
  code: string;
  qrSvg: string;
  /** 0–3 paid hours in the current cycle */
  punches: number;
  rewardAvailable: boolean;
  /** 'print' renders the blank physical card (holes are punched by hand). */
  variant?: 'live' | 'print';
  /** index (1-3) of a punch that was just added, for a one-off animation */
  justPunched?: number | null;
  tagline?: string;
  className?: string;
  glow?: boolean;
}

export function LoyaltyCardBack({
  name,
  code,
  qrSvg,
  punches,
  rewardAvailable,
  variant = 'live',
  justPunched = null,
  className = '',
  glow = true,
}: CardBackProps) {
  const live = variant === 'live';
  const filled = live ? Math.max(0, Math.min(3, punches)) : 0;
  const rewardState = !live ? 'print' : rewardAvailable ? 'unlocked' : 'locked';

  return (
    <div
      className={`gzx-card ${glow ? 'gzx-card--glow' : ''} ${className}`}
      role="img"
      aria-label={
        live
          ? `Loyalty card back for ${name}, code ${code}. ${filled} of 3 paid hours. ${rewardAvailable ? 'Reward available.' : 'Reward locked.'}`
          : `Printable loyalty card back for ${name}, code ${code}`
      }
    >
      <img className="gzx-card__bg" src="/brand/card-back-bg.webp" alt="" draggable={false} />

      <div className="gzx-plate">
        <div className="gzx-plate__inner">
          <div className="min-w-0 flex-1">
            <div className="gzx-plate__label">Player</div>
            <div className="gzx-plate__name">{name}</div>
          </div>
          <div className="gzx-plate__divider" aria-hidden />
          <div className="flex-none">
            <div className="gzx-plate__label">Card code</div>
            <div className="gzx-plate__code">{code}</div>
          </div>
        </div>
      </div>

      <div className="gzx-punches" aria-hidden>
        {[1, 2, 3].map((n) => {
          const done = n <= filled;
          return (
            <div key={n} className="flex items-center">
              <div className={`gzx-punch ${done ? 'gzx-punch--done' : ''} ${done && justPunched === n ? 'gzx-punch--new' : ''}`}>
                <span className="gzx-punch__n">
                  {n}
                  <sup>{ordinal(n)}</sup>
                </span>
                <span className="gzx-punch__h">HOUR</span>
                <span className="gzx-punch__p">(PAID)</span>
                {done && (
                  <span className="gzx-punch__check">
                    <Check strokeWidth={4} />
                  </span>
                )}
              </div>
              <div className="gzx-connector" />
            </div>
          );
        })}
        <div className={`gzx-reward ${rewardState === 'locked' ? 'gzx-reward--locked' : ''} ${rewardState === 'unlocked' ? 'gzx-reward--unlocked' : ''}`}>
          {rewardState !== 'locked' && <Rays />}
          <div className="gzx-reward__icons">
            <Gift strokeWidth={2.6} color="#d9152b" fill="#ffd2d8" />
            <CupSoda strokeWidth={2.6} color="#d9152b" fill="#ffd2d8" />
          </div>
          <span className="gzx-reward__h">
            4<sup style={{ fontSize: '0.6em' }}>th</sup> HOUR
          </span>
          <span className="gzx-reward__free">FREE</span>
          <span className="gzx-reward__drink">+ DRINK</span>
          {rewardState === 'locked' && (
            <span className="gzx-reward__lock">
              <Lock strokeWidth={3} />
            </span>
          )}
        </div>
      </div>

      <div className="gzx-qr">
        <div dangerouslySetInnerHTML={{ __html: qrSvg }} />
        <div className="gzx-qr__caption">SCAN ME</div>
      </div>

      <div className="gzx-banner">
        <span className="gzx-banner__text">
          Play <b>3 hours</b> · Get the 4th hour <b>FREE + DRINK</b>
        </span>
      </div>
    </div>
  );
}

function Rays() {
  // little sparkle strokes around the reward circle, as on the printed card
  const angles = [-70, -45, -20, 200, 225, 250];
  return (
    <svg className="gzx-rays" viewBox="0 0 100 100" aria-hidden>
      {angles.map((a) => {
        const r1 = 44, r2 = 50;
        const rad = (a * Math.PI) / 180;
        return (
          <line key={a} x1={50 + r1 * Math.cos(rad)} y1={50 + r1 * Math.sin(rad)} x2={50 + r2 * Math.cos(rad)} y2={50 + r2 * Math.sin(rad)}
            stroke="#ffd447" strokeWidth="1.6" strokeLinecap="round" />
        );
      })}
    </svg>
  );
}
