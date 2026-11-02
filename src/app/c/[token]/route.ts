import { NextResponse, type NextRequest } from 'next/server';
import { getStaff } from '@/lib/auth';
import { rpc } from '@/lib/rpc';
import { isValidToken } from '@/lib/code';
import { redirectBase } from '@/lib/deployment';
export async function GET(request: NextRequest,{params}:{params:Promise<{token:string}>}) {
  const {token}=await params;
  const base=redirectBase(request.url,request.headers.get('host'));
  if(!isValidToken(token)) return NextResponse.redirect(new URL('/scan?error=INVALID_QR',base));
  if(!await getStaff()) {
    const response=NextResponse.redirect(new URL(`/card/${token}`,base));
    response.headers.set('Cache-Control','private, no-store');response.headers.set('Referrer-Policy','no-referrer');
    return response;
  }
  try {
    const data=await rpc<{customer_id?:string;error?:string}>('find_customer_by_qr',{p_token:token});
    return NextResponse.redirect(new URL(data.customer_id?`/customers/${data.customer_id}`:`/scan?error=${data.error??'CUSTOMER_NOT_FOUND'}`,base));
  } catch { return NextResponse.redirect(new URL('/scan?error=FORBIDDEN',base)); }
}
