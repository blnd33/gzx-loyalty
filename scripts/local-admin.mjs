import {randomBytes} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {one,localRpc,databasePath} from '../src/lib/local-store.ts';
const file=resolve(dirname(databasePath()),'LOCAL-ADMIN-LOGIN.txt');
if(existsSync(file)){
 const saved=readFileSync(file,'utf8');const email=saved.match(/^Email: (.+)$/m)?.[1];
 if(email&&one("SELECT id FROM staff WHERE email=? AND role='super_admin' AND active=1",email)){
  console.log(`Existing new admin kept. Initial login details are in ${file}`);process.exit(0);
 }
}
const owner=one("SELECT id FROM staff WHERE role='super_admin' AND active=1 ORDER BY created_at LIMIT 1");
if(!owner)throw new Error('Run npm run local:init before creating another administrator.');
let number=2;while(one('SELECT id FROM staff WHERE email=?',`admin${number}@lounge.local`))number++;
const email=`admin${number}@lounge.local`;const password=randomBytes(18).toString('base64url');
localRpc('admin_create_staff',{p_full_name:'Lounge Administrator',p_email:email,p_password:password,p_role:'super_admin'},owner.id);
writeFileSync(file,`GZX LOUNGE — NEW LOCAL ADMIN\n\nWebsite: ${process.env.APP_URL||'http://localhost:3000'}/login\nEmail: ${email}\nPassword: ${password}\n\nAll records are saved on this lounge computer in data/lounge.sqlite.\nThe existing accounts and customer records were kept.\nUse My password after signing in to choose your own password.\nKeep this file private.\n`,{mode:0o600});
console.log(`New administrator created: ${email}. Password saved privately in ${file}`);
