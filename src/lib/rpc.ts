import 'server-only';
import { getStaff } from '@/lib/auth';
import { localRpc } from '@/lib/data-store';
import { errorCode, friendlyError } from '@/lib/errors';
export class RpcError extends Error {
  constructor(public code: string) { super(friendlyError(code)); }
}
export async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const staff=await getStaff(); if(!staff) throw new RpcError('NOT_AUTHENTICATED');
  try { return await localRpc(fn,args??{},staff.id) as T; }
  catch(error) { const code=errorCode(error); if(code==='UNKNOWN') console.error(`[local:${fn}]`,error); throw new RpcError(code); }
}
