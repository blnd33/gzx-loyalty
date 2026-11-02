import { redirect } from 'next/navigation';
import { getStaff, homeFor } from '@/lib/auth';

export default async function Home() {
  const staff = await getStaff();
  redirect(staff ? homeFor(staff) : '/login');
}
