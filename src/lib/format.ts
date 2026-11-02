// All timestamps are stored in UTC and displayed in the lounge's timezone.
export const TIMEZONE = 'Asia/Baghdad';

const dateFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, day: 'numeric', month: 'short', year: 'numeric' });
const shortDateFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, day: 'numeric', month: 'short' });
const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: false });

export function formatDate(iso: string | null | undefined): string {
  return iso ? dateFmt.format(new Date(iso)) : '—';
}

export function formatShortDate(iso: string | null | undefined): string {
  return iso ? shortDateFmt.format(new Date(iso)) : '—';
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${dateFmt.format(d)} · ${timeFmt.format(d)}`;
}

export function formatTime(iso: string): string {
  return timeFmt.format(new Date(iso));
}

/** "today" / "yesterday" / "3 days ago" relative to Baghdad calendar days. */
export function relativeDay(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return 'Never';
  const key = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(d);
  const days = Math.round((Date.parse(key(now)) - Date.parse(key(new Date(iso)))) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  return formatDate(iso);
}

export function ordinal(n: number): string {
  return n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
}
