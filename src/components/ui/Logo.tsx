/* eslint-disable @next/next/no-img-element */
export function Logo({ size = 40, withText = true }: { size?: number; withText?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <img src="/brand/logo-256.webp" width={size} height={size} alt="GZX Gaming"
        className="rounded-full shadow-[0_0_14px_rgba(255,107,0,.55)]" />
      {withText && (
        <span className="leading-none">
          <span className="block font-display text-lg tracking-wide">
            <span className="text-neon-orange">GZX</span> GAMING
          </span>
          <span className="block text-[11px] font-semibold uppercase tracking-[0.28em] text-muted">Loyalty</span>
        </span>
      )}
    </span>
  );
}
