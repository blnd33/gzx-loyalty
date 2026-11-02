'use client';
import { useCallback, useRef } from 'react';
import { createRequestId } from './random-id';

/**
 * One key per intended action. The same key is reused if the request is
 * retried (double tap, network hiccup) so the server records it only once;
 * call reset() after a confirmed success to prepare for the next action.
 */
export function useIdempotencyKey() {
  const ref = useRef<string | null>(null);
  const get = useCallback(() => (ref.current ??= createRequestId()), []);
  const reset = useCallback(() => {
    ref.current = null;
  }, []);
  return { get, reset };
}
