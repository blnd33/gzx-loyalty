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
      <section className="panel panel-pad mt-6 space-y-3">
        <h2 className="heading text-lg">Back up lounge data</h2>
        <p className="text-muted">Download a complete backup of customers, staff accounts, paid hours and history. Keep a copy away from the hosting computer. Snapshots are saved at startup, and every day when using the online server launcher.</p>
        <a href="/api/backup" className="btn-primary" download>Download database backup</a>
      </section>
    </>
  );
}
