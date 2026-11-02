import 'server-only';
import { readPublicCard } from './data-store';
import type { PublicLoyaltyCard } from './local-store';
import { createHash } from 'node:crypto';
export { readPublicCard };
export function publicCardVersion(card: PublicLoyaltyCard): string {
  return createHash('sha256').update(JSON.stringify(card)).digest('hex');
}
