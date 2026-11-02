import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { StaffProfile } from '@/lib/types';

/** Current active staff profile, or null (memoised per request). */
export const getStaff = cache(async (): Promise<StaffProfile | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.rpc('get_my_profile');
  if (error || !data) return null;
  return data as StaffProfile;
});

export async function requireStaff(): Promise<StaffProfile> {
  const staff = await getStaff();
  if (!staff) redirect('/login?error=no_access');
  return staff;
}

/** Admin-only pages: cashiers are sent to the scanner. */
export async function requireAdmin(): Promise<StaffProfile> {
  const staff = await requireStaff();
  if (staff.role !== 'super_admin') redirect('/scan?denied=1');
  return staff;
}

export function homeFor(staff: StaffProfile): string {
  return staff.role === 'super_admin' ? '/dashboard' : '/scan';
}
