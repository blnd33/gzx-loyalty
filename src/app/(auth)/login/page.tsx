import type { Metadata } from 'next';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Staff sign in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const notice =
    sp.error === 'no_access' ? 'This account is not an active GZX staff member. Ask an admin for access.'
    : sp.error === 'link_expired' ? 'That link has expired. Request a new password reset.'
    : sp.reset === '1' ? 'Password updated. Sign in with your new password.'
    : null;
  const next = sp.next && sp.next.startsWith('/') && !sp.next.startsWith('//') && !/[\\\x00-\x20]/.test(sp.next) ? sp.next : '/';
  return <LoginForm next={next} notice={notice} />;
}
