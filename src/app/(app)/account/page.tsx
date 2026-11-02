import { requireStaff } from '@/lib/auth';
import { PasswordForm } from './PasswordForm';
export default async function Account() { await requireStaff(); return <PasswordForm />; }
