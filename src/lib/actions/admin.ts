'use server';

import { revalidatePath } from 'next/cache';
import { getStaff } from '@/lib/auth';
import { rpc, RpcError } from '@/lib/rpc';
import { friendlyError } from '@/lib/errors';
import { createAdminClient } from '@/lib/supabase/admin';
import { settingsSchema, staffCreateSchema, staffUpdateSchema } from '@/lib/validation';
import type { ActionResult } from '@/lib/types';

function fail(e: unknown): { ok: false; error: string; code: string } {
  const code = e instanceof RpcError ? e.code : 'UNKNOWN';
  return { ok: false, code, error: friendlyError(code) };
}

/**
 * Creates a staff login. The service-role key is used ONLY for the Auth user;
 * the profile row is created through admin_create_staff_profile(), which
 * re-verifies on the database side that the caller is an administrator.
 */
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

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName },
  });
  if (error || !data.user) {
    return { ok: false, error: error?.message ?? 'Could not create the login.' };
  }
  try {
    await rpc('admin_create_staff_profile', {
      p_auth_user_id: data.user.id,
      p_full_name: parsed.data.fullName,
      p_role: parsed.data.role,
    });
  } catch (e) {
    await admin.auth.admin.deleteUser(data.user.id); // roll back the orphan login
    return fail(e);
  }
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
