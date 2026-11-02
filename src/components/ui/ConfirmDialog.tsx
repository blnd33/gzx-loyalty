'use client';

import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'primary' | 'gold' | 'danger';
  pending?: boolean;
  onConfirm: () => void;
  children?: ReactNode;
  icon?: ReactNode;
}

/** Accessible confirmation dialog (focus-trapped, Esc to cancel, large touch targets). */
export function ConfirmDialog({
  open, onOpenChange, title, description, confirmLabel, cancelLabel = 'Cancel',
  tone = 'primary', pending = false, onConfirm, children, icon,
}: Props) {
  const btn = tone === 'gold' ? 'btn-gold' : tone === 'danger' ? 'btn-danger' : 'btn-primary';
  return (
    <AlertDialog.Root open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-fade-up" />
        <AlertDialog.Content
          className="panel fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md p-5 shadow-2xl data-[state=open]:animate-fade-up
            sm:inset-x-0 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:p-6"
          style={{ background: '#22162B' }}
        >
          {icon && <div className="mb-3">{icon}</div>}
          <AlertDialog.Title className="heading text-xl">{title}</AlertDialog.Title>
          <AlertDialog.Description asChild>
            <div className="mt-2 text-base leading-relaxed text-muted">{description}</div>
          </AlertDialog.Description>
          {children && <div className="mt-4">{children}</div>}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel className="btn-ghost btn-lg sm:min-h-[48px] sm:text-base" disabled={pending}>
              {cancelLabel}
            </AlertDialog.Cancel>
            <button
              type="button"
              className={`${btn} btn-lg sm:min-h-[48px] sm:text-base`}
              disabled={pending}
              onClick={onConfirm}
              autoFocus
            >
              {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
              {pending ? 'Saving…' : confirmLabel}
            </button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
