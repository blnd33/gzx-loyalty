import { Logo } from '@/components/ui/Logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
      {/* sunset backdrop taken from the card art, heavily dimmed */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-cover bg-center opacity-25 blur-sm"
        style={{ backgroundImage: 'url(/brand/card-front.webp)' }} />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-ink/60 via-ink/85 to-ink" />
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center"><Logo size={64} /></div>
        {children}
      </div>
    </div>
  );
}
