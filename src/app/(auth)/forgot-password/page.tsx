import Link from 'next/link';
export default function ForgotPassword() {
  return <section className="panel panel-pad space-y-4"><h1 className="heading text-2xl">Password help</h1>
    <p>Ask a lounge administrator to reset your password in Staff accounts.</p>
    <p className="text-muted">If you are the owner and cannot sign in, use the owner recovery command on the computer or server hosting the app.</p>
    <Link href="/login" className="btn-primary">Back to sign in</Link></section>;
}
