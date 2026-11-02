import { NextResponse } from 'next/server';
import { one } from '@/lib/data-store';
export const dynamic='force-dynamic';
export async function GET() {
  try {await one('SELECT 1');return NextResponse.json({app:'gzx-loyalty-local',status:'ok'},{headers:{'Cache-Control':'no-store'}});}
  catch{return NextResponse.json({status:'unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
