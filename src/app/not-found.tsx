import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <div className="mb-5 flex justify-center"><Logo size={56} /></div>
        <h1 className="heading text-3xl">Not found</h1>
        <p className="mt-2 text-muted">That page or customer does not exist.</p>
        <Link href="/" className="btn-primary mt-6">Go home</Link>
      </div>
    </main>
  );
}
