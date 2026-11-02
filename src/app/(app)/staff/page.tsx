import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { StaffProfile } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { StaffManager } from './StaffManager';

export const metadata: Metadata = { title: 'Staff' };

export default async function StaffPage() {
  const me = await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from('staff_profiles')
    .select('id, full_name, role, active, created_at')
    .order('active', { ascending: false })
    .order('full_name');
  return (
    <>
      <PageHeader eyebrow="Administration" title="Staff accounts">
        Cashiers can register customers, record paid hours and redeem rewards. Only admins can correct records or change settings.
      </PageHeader>
      <StaffManager staff={(data ?? []) as StaffProfile[]} meId={me.id} serviceKeyConfigured={!!process.env.SUPABASE_SERVICE_ROLE_KEY} />
    </>
  );
}
