import type { HistoryRow } from '@/lib/types';

export interface HistoryView {
  label: string;
  progress: string;
  tone: 'orange' | 'gold' | 'green' | 'muted' | 'red' | 'pink';
  detail: string | null;
  cycle: number | null;
}

/** Turns an audit-log entry into a readable history line. */
export function describeHistory(row: HistoryRow): HistoryView {
  const m = row.metadata as Record<string, unknown>;
  const cycle = typeof m.cycle_number === 'number' ? m.cycle_number : null;
  const receipt = m.receipt_reference ? `Receipt ${m.receipt_reference}` : null;
  switch (row.action) {
    case 'customer.registered':
      return { label: 'Registered', progress: '0/3', tone: 'pink', detail: m.code ? `Card ${m.code} issued` : null, cycle: 1 };
    case 'punch.added':
      return { label: 'Paid hour', progress: `${m.punch_number}/3`, tone: 'orange', detail: [receipt, m.notes].filter(Boolean).join(' · ') || null, cycle };
    case 'reward.unlocked':
      return { label: 'Reward unlocked', progress: 'Available', tone: 'gold', detail: '1 free hour + 1 free drink', cycle };
    case 'reward.redeemed':
      return { label: 'Reward redeemed', progress: 'Completed', tone: 'green', detail: m.new_cycle_number ? `New cycle #${m.new_cycle_number} started` : null, cycle };
    case 'punch.voided':
      return { label: 'Paid hour corrected', progress: `${m.progress}/3`, tone: 'red', detail: m.reward_revoked ? 'Pending reward withdrawn' : null, cycle };
    case 'card.deactivated':
      return { label: 'Card deactivated', progress: '—', tone: 'red', detail: null, cycle: null };
    case 'card.reactivated':
      return { label: 'Card reactivated', progress: '—', tone: 'muted', detail: null, cycle: null };
    case 'card.reissued':
      return { label: 'Card reissued', progress: '—', tone: 'pink', detail: `${m.old_code ?? '?'} → ${m.code}`, cycle: null };
    case 'customer.updated':
      return { label: 'Details updated', progress: '—', tone: 'muted', detail: null, cycle: null };
    case 'customer.deactivated':
      return { label: 'Customer deactivated', progress: '—', tone: 'red', detail: null, cycle: null };
    case 'customer.reactivated':
      return { label: 'Customer reactivated', progress: '—', tone: 'muted', detail: null, cycle: null };
    default:
      return { label: row.action, progress: '—', tone: 'muted', detail: null, cycle: null };
  }
}

export const TONE_CLASS: Record<HistoryView['tone'], string> = {
  orange: 'bg-neon-orange/15 text-[#ffb27a] ring-neon-orange/30',
  gold: 'bg-neon-gold/15 text-neon-gold ring-neon-gold/40',
  green: 'bg-success/15 text-[#7ee2a3] ring-success/30',
  muted: 'bg-white/5 text-muted ring-white/10',
  red: 'bg-danger/15 text-[#ff9aab] ring-danger/30',
  pink: 'bg-neon-pink/15 text-[#ff8cc0] ring-neon-pink/30',
};
