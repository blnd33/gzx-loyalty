import type { Metadata } from 'next';
import { Keyboard, QrCode } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { QrScanner } from '@/components/scan/QrScanner';
import { CodeEntry } from '@/components/scan/CodeEntry';
import { friendlyError } from '@/lib/errors';

export const metadata: Metadata = { title: 'Scan / Find customer' };

export default async function ScanPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const error = sp.error ? friendlyError(sp.error) : sp.denied ? 'That page is for administrators only.' : null;
  return (
    <>
      <PageHeader eyebrow="Customer lookup" title="Scan or enter code">
        Opening a card never adds a paid hour — you confirm that on the next screen.
      </PageHeader>
      {error && <p role="alert" className="mb-5 rounded-xl border border-danger/40 bg-danger/10 p-3 text-[#ff9aab]">{error}</p>}
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="panel panel-pad sm:p-6" aria-labelledby="scan-title">
          <h2 id="scan-title" className="heading mb-4 flex items-center gap-2 text-lg">
            <QrCode className="h-5 w-5 text-neon-orange" aria-hidden /> Scan QR code
          </h2>
          <QrScanner />
        </section>
        <section className="panel panel-pad sm:p-6" aria-labelledby="code-title">
          <h2 id="code-title" className="heading mb-6 flex items-center gap-2 text-lg">
            <Keyboard className="h-5 w-5 text-neon-pink" aria-hidden /> Manual code
          </h2>
          <CodeEntry />
        </section>
      </div>
    </>
  );
}
