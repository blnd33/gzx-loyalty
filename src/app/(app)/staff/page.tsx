import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { listStaff } from '@/lib/data-store';
import type { StaffProfile } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { StaffManager } from './StaffManager';

export const metadata: Metadata = { title: 'Staff' };

export default async function StaffPage() {
  const me = await requireAdmin();
  const data=await listStaff();
  return (
    <>
      <PageHeader eyebrow="Administration" title="Staff accounts">
        Cashiers can register customers, record paid hours and redeem rewards. Only admins can correct records or change settings.
      </PageHeader>
      <StaffManager staff={(data ?? []) as StaffProfile[]} meId={me.id} serviceKeyConfigured={true} />
    </>
  );
}
