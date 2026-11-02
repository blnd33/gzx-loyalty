'use client';

import Link from 'next/link';
import { ArrowLeft, Printer, Scissors } from 'lucide-react';

export function PrintToolbar({ customerId, code, marks }: { customerId: string; code: string; marks: boolean }) {
  return (
    <div className="print-toolbar mx-auto mb-6 flex max-w-xl flex-wrap items-center justify-between gap-2 p-4">
      <Link href={`/customers/${customerId}`} className="btn-ghost text-sm"><ArrowLeft className="h-4 w-4" aria-hidden /> Back</Link>
      <p className="text-sm text-muted">Card <span className="font-display tracking-widest text-neon-gold">{code}</span> · 85.6×54 mm + 3 mm bleed</p>
      <div className="flex gap-2">
        <Link href={`?marks=${marks ? '0' : '1'}`} className="btn-ghost text-sm"><Scissors className="h-4 w-4" aria-hidden /> {marks ? 'Hide' : 'Show'} crop marks</Link>
        <button className="btn-primary text-sm" onClick={() => window.print()}><Printer className="h-4 w-4" aria-hidden /> Print</button>
      </div>
    </div>
  );
}
