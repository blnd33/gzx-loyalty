import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
process.chdir(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const [domain, email='admin@lounge.local']=process.argv.slice(2);
if(!domain || domain.length>253 || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain)) throw new Error('Usage: node deploy/configure.mjs loyalty.your-domain.com [owner-email] — enter a hostname, without https:// or a path.');
if(!/^[^\s@=]+@[^\s@=]+\.[^\s@=]+$/.test(email)) throw new Error('Invalid owner login email.');
if(existsSync('.env.server')) throw new Error('.env.server already exists; edit it to change your domain. Existing credentials were not replaced.');
mkdirSync('.secrets',{recursive:true,mode:0o700});
// Parent directory restricts host access; the read-only container secret is readable by its non-root app user.
if(!existsSync('.secrets/owner_password')) writeFileSync('.secrets/owner_password',randomBytes(24).toString('base64url')+'\n',{mode:0o644,flag:'wx'});
chmodSync('.secrets',0o700);chmodSync('.secrets/owner_password',0o644);
writeFileSync('.env.server',`APP_DOMAIN=${domain.toLowerCase()}\nOWNER_EMAIL=${email.toLowerCase()}\n`,{mode:0o600,flag:'wx'});
console.log(`Configured https://${domain.toLowerCase()}\nOwner login: ${email.toLowerCase()}\nInitial password: stored privately in .secrets/owner_password (not printed).\nStart: docker compose --env-file .env.server up -d --build`);
