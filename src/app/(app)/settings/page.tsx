import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { PageHeader } from '@/components/ui/PageHeader';
import { SettingsForm } from './SettingsForm';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  await requireAdmin();
  const settings = await getSettings();
  return (
    <>
      <PageHeader eyebrow="Administration" title="Settings">
        The loyalty rule is fixed at 3 paid hours → 1 free hour + 1 free drink. Every change here is written to the audit log.
      </PageHeader>
      <SettingsForm initial={settings} />
    </>
  );
}
