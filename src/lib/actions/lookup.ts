'use server';

import { rpc, RpcError } from '@/lib/rpc';
import { friendlyError } from '@/lib/errors';
import { codeSchema, tokenSchema } from '@/lib/validation';
import type { ActionResult } from '@/lib/types';

type LookupResult = { customer_id?: string; card_status?: string; error?: string };

async function finish(res: LookupResult): Promise<ActionResult<{ customerId: string; cardStatus: string }>> {
  if (res.error || !res.customer_id) {
    const code = res.error ?? 'CUSTOMER_NOT_FOUND';
    return { ok: false, code, error: friendlyError(code) };
  }
  return { ok: true, data: { customerId: res.customer_id, cardStatus: res.card_status ?? 'active' } };
}

/** Method B — manual six-letter code. Read-only: never adds a punch. */
export async function lookupByCode(raw: string) {
  const parsed = codeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, code: 'INVALID_CODE', error: friendlyError('INVALID_CODE') };
  try {
    return await finish(await rpc<LookupResult>('find_customer_by_code', { p_code: parsed.data }));
  } catch (e) {
    return { ok: false as const, code: (e as RpcError).code, error: friendlyError((e as RpcError).code) };
  }
}

/** Method A — QR token. Read-only: never adds a punch. */
export async function lookupByToken(raw: string) {
  const parsed = tokenSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, code: 'INVALID_QR', error: friendlyError('INVALID_QR') };
  try {
    return await finish(await rpc<LookupResult>('find_customer_by_qr', { p_token: parsed.data }));
  } catch (e) {
    return { ok: false as const, code: (e as RpcError).code, error: friendlyError((e as RpcError).code) };
  }
}
