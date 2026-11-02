import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';
import { NewCustomerForm } from './NewCustomerForm';

export const metadata: Metadata = { title: 'New customer' };

export default function NewCustomerPage() {
  return (
    <>
      <PageHeader eyebrow="Registration" title="Add new customer">
        A permanent 6-letter code, QR and card are created automatically.
      </PageHeader>
      <NewCustomerForm />
    </>
  );
}
