import { Gift, CircleSlash, Clock3 } from 'lucide-react';

export function ProgressBadge({ punches, cycleStatus, cardStatus }: {
  punches: number | null; cycleStatus: string | null; cardStatus?: string | null;
}) {
  if (cardStatus && cardStatus !== 'active') {
    return (
      <span className="badge bg-white/10 text-muted">
        <CircleSlash className="h-3.5 w-3.5" aria-hidden /> Card {cardStatus}
      </span>
    );
  }
  if (cycleStatus === 'completed') {
    return (
      <span className="badge bg-neon-gold/15 text-neon-gold ring-1 ring-neon-gold/40">
        <Gift className="h-3.5 w-3.5" aria-hidden /> Reward ready
      </span>
    );
  }
  return (
    <span className="badge bg-neon-orange/10 text-[#ffb27a] ring-1 ring-neon-orange/30">
      <Clock3 className="h-3.5 w-3.5" aria-hidden /> {punches ?? 0}/3 hours
    </span>
  );
}

export function PunchDots({ punches, reward }: { punches: number; reward: boolean }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`${punches} of 3 paid hours${reward ? ', reward available' : ''}`}>
      {[1, 2, 3].map((n) => (
        <span key={n} className={`h-2.5 w-2.5 rounded-full ${n <= punches ? 'bg-neon-orange shadow-[0_0_8px_#FF6B00]' : 'bg-white/15'}`} />
      ))}
      <span className={`ml-0.5 h-3 w-3 rounded-full ${reward ? 'bg-neon-gold shadow-[0_0_10px_#FFD447]' : 'border border-neon-gold/40'}`} />
    </span>
  );
}
