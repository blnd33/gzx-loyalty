import { backup } from 'node:sqlite';
import { mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { db } from '../src/lib/local-store.ts';
const folder=resolve(process.env.BACKUP_DIR || 'backups'); mkdirSync(folder,{recursive:true});
const name=`lounge-${new Date().toISOString().replace(/[:.]/g,'-')}.sqlite`;
await backup(db(),resolve(folder,name));
// Keep the most recent 30 automatic snapshots; downloaded backups are unaffected.
const files=readdirSync(folder).filter(f=>/^lounge-\d{4}-.*\.sqlite$/.test(f)).sort().reverse();
for(const file of files.slice(30)) unlinkSync(resolve(folder,file));
console.log(`Backup saved: ${folder}/${name}`);
