import type { ReactNode } from 'react';

export function PageHeader({ eyebrow, title, actions, children }: {
  eyebrow?: string; title: string; actions?: ReactNode; children?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h1 className="heading text-2xl sm:text-3xl">{title}</h1>
        {children && <div className="mt-1.5 text-muted">{children}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
