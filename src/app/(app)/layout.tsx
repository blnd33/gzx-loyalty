import { AppShell } from '@/components/shell/AppShell';
import { requireStaff } from '@/lib/auth';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  const settings = await getSettings();
  return <AppShell staff={staff} loungeName={settings.lounge_name}>{children}</AppShell>;
}
