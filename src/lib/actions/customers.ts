'use server';

import { revalidatePath } from 'next/cache';
import { rpc, RpcError } from '@/lib/rpc';
import { friendlyError } from '@/lib/errors';
import { customerSchema, reasonSchema, uuidSchema } from '@/lib/validation';
import type { ActionResult } from '@/lib/types';

export interface DuplicateMatch {
  id: string;
  name: string;
  phone: string | null;
  code: string | null;
  created_at: string;
}

export async function findDuplicates(name: string, phone?: string): Promise<DuplicateMatch[]> {
  try {
    return await rpc<DuplicateMatch[]>('find_possible_duplicates', {
      p_name: String(name ?? '').slice(0, 100),
      p_phone: phone ? String(phone).slice(0, 24) : null,
    });
  } catch {
    return [];
  }
}

export async function registerCustomer(input: {
  name: string;
  phone?: string;
  notes?: string;
  idempotencyKey: string;
}): Promise<ActionResult<{ customerId: string; code: string }> & { fieldErrors?: Record<string, string> }> {
  const parsed = customerSchema.safeParse(input);
  const key = uuidSchema.safeParse(input.idempotencyKey);
  if (!parsed.success || !key.success) {
    const fieldErrors: Record<string, string> = {};
    parsed.error?.issues.forEach((i) => (fieldErrors[String(i.path[0])] = i.message));
    return { ok: false, error: 'Please fix the highlighted fields.', fieldErrors };
  }
  try {
    const res = await rpc<{ customer_id: string; code: string }>('register_customer', {
      p_name: parsed.data.name,
      p_phone: parsed.data.phone ?? null,
      p_notes: parsed.data.notes ?? null,
      p_idempotency_key: key.data,
    });
    revalidatePath('/customers');
    return { ok: true, data: { customerId: res.customer_id, code: res.code } };
  } catch (e) {
    const code = e instanceof RpcError ? e.code : 'UNKNOWN';
    return { ok: false, code, error: friendlyError(code) };
  }
}

export async function updateCustomer(input: {
  customerId: string;
  name: string;
  phone?: string;
  notes?: string;
}): Promise<ActionResult> {
  const id = uuidSchema.safeParse(input.customerId);
  const parsed = customerSchema.safeParse(input);
  if (!id.success || !parsed.success) {
    return { ok: false, error: parsed.error?.issues[0]?.message ?? 'Invalid request.' };
  }
  try {
    await rpc('update_customer', {
      p_customer_id: id.data,
      p_name: parsed.data.name,
      p_phone: parsed.data.phone ?? null,
      p_notes: parsed.data.notes ?? null,
    });
    revalidatePath(`/customers/${id.data}`);
    return { ok: true, data: undefined };
  } catch (e) {
    const code = e instanceof RpcError ? e.code : 'UNKNOWN';
    return { ok: false, code, error: friendlyError(code) };
  }
}

export async function setCustomerActive(customerId: string, active: boolean, reason: string): Promise<ActionResult> {
  const id = uuidSchema.safeParse(customerId);
  const why = reasonSchema.safeParse(reason);
  if (!id.success) return { ok: false, error: 'Invalid customer.' };
  if (!why.success) return { ok: false, error: why.error.issues[0].message };
  try {
    await rpc('set_customer_active', { p_customer_id: id.data, p_active: active, p_reason: why.data });
    revalidatePath(`/customers/${id.data}`);
    return { ok: true, data: undefined };
  } catch (e) {
    const code = e instanceof RpcError ? e.code : 'UNKNOWN';
    return { ok: false, code, error: friendlyError(code) };
  }
}
