'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { Loader2, Search } from 'lucide-react';
import { CODE_LENGTH, isValidCode, sanitizeCodeInput } from '@/lib/code';
import { lookupByCode } from '@/lib/actions/lookup';

/** Method B: large six-letter code entry. Typing, pasting and Enter all work. */
export function CodeEntry({ autoFocus = false }: { autoFocus?: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const complete = isValidCode(code);

  function onChange(raw: string) {
    const { value, rejected } = sanitizeCodeInput(raw);
    setCode(value);
    setError(null);
    setHint(rejected ? 'Only letters A–Z are allowed — numbers, spaces and symbols were removed.' : null);
  }

  function submit() {
    if (!complete || pending) return;
    startTransition(async () => {
      const res = await lookupByCode(code);
      if (res.ok) {
        router.push(`/customers/${res.data.customerId}`);
      } else {
        setError(res.error);
        inputRef.current?.select();
      }
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      noValidate
    >
      <label htmlFor="customer-code" className="eyebrow mb-3 block text-center text-sm text-white">
        Enter customer code
      </label>
      <div className="relative mx-auto max-w-[26rem]" onClick={() => inputRef.current?.focus()}>
        {/* Visual slots */}
        <div aria-hidden className="grid grid-cols-6 gap-2 sm:gap-2.5">
          {Array.from({ length: CODE_LENGTH }).map((_, i) => {
            const ch = code[i];
            const isCursor = i === code.length && !complete;
            return (
              <div
                key={i}
                className={`grid aspect-[4/5] place-items-center rounded-xl border-2 bg-ink/80 font-display text-3xl transition-all sm:text-4xl ${
                  ch
                    ? 'border-neon-orange text-white shadow-glow-orange'
                    : isCursor
                      ? 'border-neon-pink/80 text-muted'
                      : 'border-white/10 text-muted/40'
                } ${error ? 'border-danger/80 shadow-none' : ''}`}
              >
                {ch ?? '_'}
              </div>
            );
          })}
        </div>
        {/* The real input sits on top (transparent) so paste, autofill and mobile keyboards behave natively */}
        <input
          ref={inputRef}
          id="customer-code"
          name="code"
          value={code}
          onChange={(e) => onChange(e.target.value)}
          onPaste={(e) => {
            e.preventDefault();
            onChange(e.clipboardData.getData('text'));
          }}
          autoFocus={autoFocus}
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          enterKeyHint="search"
          maxLength={20}
          aria-invalid={!!error}
          aria-describedby="code-help"
          className="absolute inset-0 h-full w-full cursor-text rounded-xl bg-transparent text-transparent caret-transparent opacity-[0.01] outline-none"
        />
      </div>
      <p id="code-help" className="mt-3 min-h-[1.5rem] text-center text-sm" aria-live="polite">
        {error ? <span className="text-[#ff9aab]">{error}</span>
          : hint ? <span className="text-neon-gold">{hint}</span>
          : <span className="text-muted">6 letters, e.g. AXKJTR · lowercase is fine</span>}
      </p>
      <button type="submit" disabled={!complete || pending} className="btn-primary btn-lg mx-auto mt-3 flex w-full max-w-[26rem]">
        {pending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Search className="h-5 w-5" aria-hidden />}
        {pending ? 'Finding…' : 'Find customer'}
      </button>
    </form>
  );
}
