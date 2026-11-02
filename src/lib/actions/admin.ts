'use server';

import { revalidatePath } from 'next/cache';
import { getStaff } from '@/lib/auth';
import { rpc, RpcError } from '@/lib/rpc';
import { friendlyError } from '@/lib/errors';
import { z } from 'zod';
import { settingsSchema, staffCreateSchema, staffUpdateSchema } from '@/lib/validation';
import type { ActionResult } from '@/lib/types';

function fail(e: unknown): { ok: false; error: string; code: string } {
  const code = e instanceof RpcError ? e.code : 'UNKNOWN';
  return { ok: false, code, error: friendlyError(code) };
}

/** Creates a local staff login with a salted password hash. */
export async function createStaff(input: {
  fullName: string;
  email: string;
  password: string;
  role: 'super_admin' | 'cashier';
}): Promise<ActionResult> {
  const me = await getStaff();
  if (!me || me.role !== 'super_admin') return { ok: false, error: friendlyError('FORBIDDEN') };
  const parsed = staffCreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' };

  try {
    await rpc('admin_create_staff',{p_full_name:parsed.data.fullName,p_email:parsed.data.email,p_password:parsed.data.password,p_role:parsed.data.role});
  } catch(e) { return fail(e); }
  revalidatePath('/staff');
  return { ok: true, data: undefined, message: `${parsed.data.fullName} can now sign in.` };
}

export async function updateStaff(input: {
  staffId: string;
  fullName: string;
  role: 'super_admin' | 'cashier';
  active: boolean;
}): Promise<ActionResult> {
  const parsed = staffUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  try {
    await rpc('admin_update_staff', {
      p_staff_id: parsed.data.staffId,
      p_full_name: parsed.data.fullName,
      p_role: parsed.data.role,
      p_active: parsed.data.active,
    });
    revalidatePath('/staff');
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function saveSettings(input: Record<string, unknown>): Promise<ActionResult> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid settings.' };
  try {
    for (const [key, value] of Object.entries(parsed.data)) {
      await rpc('update_setting', { p_key: key, p_value: value });
    }
    revalidatePath('/settings');
    return { ok: true, data: undefined, message: 'Settings saved.' };
  } catch (e) {
    return fail(e);
  }
}

export async function resetStaffPassword(staffId: string,password: string): Promise<ActionResult> {
  const parsed=z.object({staffId:z.string().uuid(),password:z.string().min(10).max(72)}).safeParse({staffId,password});
  if(!parsed.success) return {ok:false,error:'Use a password between 10 and 72 characters.'};
  try { await rpc('reset_staff_password',{p_staff_id:parsed.data.staffId,p_password:parsed.data.password}); return {ok:true,data:undefined}; }
  catch(e) { return fail(e); }
}
