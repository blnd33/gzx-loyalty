import type { LucideIcon } from 'lucide-react';

const TONES = {
  orange: 'text-neon-orange bg-neon-orange/10 ring-neon-orange/30',
  pink: 'text-neon-pink bg-neon-pink/10 ring-neon-pink/30',
  purple: 'text-[#b48cff] bg-neon-purple/15 ring-neon-purple/35',
  gold: 'text-neon-gold bg-neon-gold/10 ring-neon-gold/35',
  green: 'text-success bg-success/10 ring-success/30',
};

export function StatCard({ label, value, icon: Icon, tone = 'orange', hint }: {
  label: string; value: number | string; icon: LucideIcon; tone?: keyof typeof TONES; hint?: string;
}) {
  return (
    <div className="panel flex items-center gap-3.5 p-4">
      <span className={`grid h-11 w-11 flex-none place-items-center rounded-xl ring-1 ${TONES[tone]}`}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="font-display text-2xl leading-tight tabular-nums">{value}</p>
        <p className="truncate text-sm text-muted">{label}</p>
        {hint && <p className="text-xs text-muted/80">{hint}</p>}
      </div>
    </div>
  );
}
