'use server';

import { revalidatePath } from 'next/cache';
import { rpc, RpcError } from '@/lib/rpc';
import { friendlyError } from '@/lib/errors';
import { punchSchema, redeemSchema, reasonSchema, uuidSchema } from '@/lib/validation';
import type { ActionResult, LoyaltyState } from '@/lib/types';

type PunchResult = LoyaltyState & { duplicate: boolean; punch_number: number; reward_unlocked: boolean };

function fail(e: unknown): { ok: false; error: string; code: string } {
  const code = e instanceof RpcError ? e.code : 'UNKNOWN';
  return { ok: false, code, error: friendlyError(code) };
}

/** Records exactly one verified paid hour. The punch count is computed by the database. */
export async function addPaidHour(input: {
  customerId: string;
  idempotencyKey: string;
  receiptReference?: string;
  notes?: string;
}): Promise<ActionResult<PunchResult>> {
  const parsed = punchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid request.' };
  try {
    const data = await rpc<PunchResult>('add_paid_hour', {
      p_customer_id: parsed.data.customerId,
      p_idempotency_key: parsed.data.idempotencyKey,
      p_receipt_reference: parsed.data.receiptReference ?? null,
      p_notes: parsed.data.notes ?? null,
    });
    revalidatePath(`/customers/${parsed.data.customerId}`);
    return { ok: true, data };
  } catch (e) {
    return fail(e);
  }
}

/** Redeems the available reward and starts the next cycle atomically. */
export async function redeemReward(input: { customerId: string; idempotencyKey: string }): Promise<
  ActionResult<LoyaltyState & { duplicate: boolean }>
> {
  const parsed = redeemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid request.' };
  try {
    const data = await rpc<LoyaltyState & { duplicate: boolean }>('redeem_reward', {
      p_customer_id: parsed.data.customerId,
      p_idempotency_key: parsed.data.idempotencyKey,
    });
    revalidatePath(`/customers/${parsed.data.customerId}`);
    revalidatePath('/rewards');
    return { ok: true, data };
  } catch (e) {
    return fail(e);
  }
}

/** Admin correction: voids the most recent paid hour of the open cycle. */
export async function voidLastPunch(customerId: string, reason: string): Promise<ActionResult> {
  const id = uuidSchema.safeParse(customerId);
  const why = reasonSchema.safeParse(reason);
  if (!id.success) return { ok: false, error: 'Invalid customer.' };
  if (!why.success) return { ok: false, error: why.error.issues[0].message };
  try {
    await rpc('void_last_punch', { p_customer_id: id.data, p_reason: why.data });
    revalidatePath(`/customers/${id.data}`);
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function setCardStatus(customerId: string, active: boolean, reason: string): Promise<ActionResult> {
  const id = uuidSchema.safeParse(customerId);
  const why = reasonSchema.safeParse(reason);
  if (!id.success) return { ok: false, error: 'Invalid customer.' };
  if (!why.success) return { ok: false, error: why.error.issues[0].message };
  try {
    await rpc('set_card_status', { p_customer_id: id.data, p_active: active, p_reason: why.data });
    revalidatePath(`/customers/${id.data}`);
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function reissueCard(customerId: string, reason: string): Promise<ActionResult<{ code: string }>> {
  const id = uuidSchema.safeParse(customerId);
  const why = reasonSchema.safeParse(reason);
  if (!id.success) return { ok: false, error: 'Invalid customer.' };
  if (!why.success) return { ok: false, error: why.error.issues[0].message };
  try {
    const data = await rpc<{ code: string }>('reissue_card', { p_customer_id: id.data, p_reason: why.data });
    revalidatePath(`/customers/${id.data}`);
    return { ok: true, data };
  } catch (e) {
    return fail(e);
  }
}
