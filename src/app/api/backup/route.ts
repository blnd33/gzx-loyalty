import { NextResponse } from 'next/server';
import { backup } from 'node:sqlite';
import { readFile, mkdir, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getStaff } from '@/lib/auth';
import { usesPostgres, exportPostgresBackup } from '@/lib/data-store';
import { backupFolder } from '@/lib/deployment';
export const dynamic='force-dynamic';
export async function GET() {
  const staff=await getStaff();
  if(!staff||staff.role!=='super_admin') return new NextResponse('Forbidden',{status:403});
  if(usesPostgres())return NextResponse.json(await exportPostgresBackup(),{headers:{'Content-Disposition':`attachment; filename="GZX-backup-${new Date().toISOString().slice(0,10)}.json"`,'Cache-Control':'no-store'}});
  const {db}=await import('@/lib/local-store');
  await mkdir(resolve(backupFolder()),{recursive:true});
  const path=resolve(backupFolder(),`download-${randomUUID()}.sqlite`);
  try {
    await backup(db(),path);
    const bytes=await readFile(path);
    return new NextResponse(bytes,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="GZX-backup-${new Date().toISOString().slice(0,10)}.sqlite"`,'Cache-Control':'no-store'}});
  } finally { await unlink(path).catch(()=>{}); }
}
