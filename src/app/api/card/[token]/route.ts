import { NextResponse } from 'next/server';
import { readPublicCard, publicCardVersion } from '@/lib/public-card';
export const dynamic='force-dynamic';
export async function GET(_request: Request,{params}:{params:Promise<{token:string}>}) {
  const {token}=await params;
  const card=await readPublicCard(token);
  const headers={'Cache-Control':'private, no-store, max-age=0','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'};
  if(!card) return NextResponse.json({available:false},{status:404,headers});
  return NextResponse.json({version:publicCardVersion(card)},{headers});
}
