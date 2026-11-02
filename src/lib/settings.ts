import 'server-only';
import { readSettings } from '@/lib/data-store';

export interface AppSettings {
  lounge_name: string;
  reward_label: string;
  card_tagline: string;
  lookup_limit_per_minute: number;
  lookup_failures_per_10min: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  lounge_name: 'GZX Gaming',
  reward_label: '1 FREE HOUR + 1 FREE DRINK',
  card_tagline: 'Get the 4th hour FREE + DRINK',
  lookup_limit_per_minute: 20,
  lookup_failures_per_10min: 15,
};

export async function getSettings(): Promise<AppSettings> {
  return { ...DEFAULT_SETTINGS, ...await readSettings() } as AppSettings;
}
