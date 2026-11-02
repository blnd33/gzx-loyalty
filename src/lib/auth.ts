import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { sessionStaff } from '@/lib/local-store';
import type { StaffProfile } from '@/lib/types';
export const getStaff = cache(async (): Promise<StaffProfile | null> => sessionStaff((await cookies()).get('lounge_session')?.value));
export async function requireStaff(): Promise<StaffProfile> {
  const staff=await getStaff(); if (!staff) redirect('/login'); return staff;
}
export async function requireAdmin(): Promise<StaffProfile> {
  const staff=await requireStaff(); if(staff.role!=='super_admin') redirect('/scan?denied=1'); return staff;
}
export function homeFor(staff: StaffProfile): string { return staff.role==='super_admin'?'/dashboard':'/scan'; }
