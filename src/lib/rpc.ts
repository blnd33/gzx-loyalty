import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { errorCode, friendlyError } from '@/lib/errors';

export class RpcError extends Error {
  constructor(public code: string) {
    super(friendlyError(code));
  }
}

/** Calls a Postgres function as the signed-in staff member. */
export async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    const code = errorCode(error);
    if (code === 'UNKNOWN') console.error(`[rpc:${fn}]`, error);
    throw new RpcError(code);
  }
  return data as T;
}
