import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { initializeOwner, one, db, passwordHash, databasePath } from '../src/lib/local-store.ts';

const args=process.argv.slice(2);
const configuredPassword=process.env.OWNER_PASSWORD_FILE ? readFileSync(process.env.OWNER_PASSWORD_FILE,'utf8').trim() : undefined;
const password=args.includes('--reset') ? randomBytes(15).toString('base64url') : configuredPassword || randomBytes(15).toString('base64url');
let email=process.env.OWNER_EMAIL || 'admin@lounge.local';
if(password.length < 10 || password.length > 72) throw new Error('Owner password must contain 10–72 characters.');
if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('OWNER_EMAIL must be a valid login email.');
if(process.env.DEPLOYMENT_MODE==='server' && !one('SELECT id FROM staff LIMIT 1') && !configuredPassword) throw new Error('An online installation requires OWNER_PASSWORD_FILE for its first owner account.');
let changed=false;
if(args.includes('--reset')) {
  const owner=one("SELECT id,email FROM staff WHERE role='super_admin' AND active=1 ORDER BY created_at LIMIT 1");
  if(!owner) throw new Error('No owner exists. Run npm run local:init first.');
  email=owner.email;
  const database=db(); database.exec('BEGIN IMMEDIATE');
  try {
    database.prepare('UPDATE staff SET password_hash=? WHERE id=?').run(passwordHash(password),owner.id);
    database.prepare('DELETE FROM sessions WHERE staff_id=?').run(owner.id);
    database.prepare('DELETE FROM attempts WHERE bucket=?').run(`login:${email}`);
    database.prepare("DELETE FROM attempts WHERE bucket LIKE 'ip:%'").run();
    database.prepare('INSERT INTO history(staff_id,action,created_at,metadata) VALUES (?,?,?,?)').run(owner.id,'owner.password_recovered',new Date().toISOString(),JSON.stringify({recovery_id:randomUUID()}));
    database.exec('COMMIT'); changed=true;
  } catch(error) { database.exec('ROLLBACK'); throw error; }
} else changed=initializeOwner(email,password);
if(changed && (!configuredPassword || args.includes('--reset'))) {
  const path=resolve(dirname(databasePath()),'OWNER-LOGIN.txt'); mkdirSync(dirname(path),{recursive:true});
  writeFileSync(path,`GZX LOUNGE — OWNER LOGIN\n\nWebsite: ${process.env.APP_URL || 'http://localhost:3000'}\nEmail: ${email}\nPassword: ${password}\n\nKeep this file private. Change the password using My password after signing in.\nStaff accounts are created on the Staff page. No Supabase account is needed.\n`,{mode:0o600});
  console.log(`Owner account ready. Login details saved in ${path}`);
} else if(changed) console.log(`Owner account created: ${email}. Use the password from your server secret file.`);
else console.log('Existing owner and data kept; bootstrap credentials were not reapplied.');
