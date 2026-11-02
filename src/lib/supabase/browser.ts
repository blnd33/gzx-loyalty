'use client';
import { createBrowserClient } from '@supabase/ssr';

/** Browser client — used only for sign-in / password flows (anon key, RLS applies). */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
