import { NextResponse, type NextRequest } from 'next/server';
import { logout } from '@/lib/data-store';
import { redirectBase } from '@/lib/deployment';
export async function POST(request: NextRequest) {
  const origin=request.headers.get('origin');
  if(origin&&new URL(origin).host!==request.headers.get('host')) return new NextResponse('Forbidden',{status:403});
  await logout(request.cookies.get('lounge_session')?.value);
  const base=redirectBase(request.url,request.headers.get('host'));
  const response=NextResponse.redirect(new URL('/login',base),{status:303});
  response.cookies.delete('lounge_session'); return response;
}
