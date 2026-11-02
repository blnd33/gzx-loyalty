import 'server-only';
export function usesPostgres(){if(process.env.DATABASE_PROVIDER==='local')return false;return ['netlify','neon','postgres'].includes(process.env.DATABASE_PROVIDER||'')||!!process.env.DATABASE_URL||!!process.env.NETLIFY_DB_URL||!!process.env.TEST_DATABASE_URL;}
async function backend(){return usesPostgres()?import('./postgres-store'):import('./local-store');}
let ownerReady:Promise<void>|undefined;
async function ensureOwner(){
  if(!usesPostgres())return;
  ownerReady??=(async()=>{const store=await backend();if(await store.one('SELECT id FROM staff LIMIT 1'))return;
    const email=process.env.OWNER_EMAIL||'admin@lounge.local';const password=process.env.OWNER_INITIAL_PASSWORD;
    if(!password||password.length<10||password.length>72)throw new Error('Configure OWNER_INITIAL_PASSWORD in Netlify before the first login.');
    await store.initializeOwner(email,password);
  })().catch(error=>{ownerReady=undefined;throw error;});
  await ownerReady;
}
export async function login(email:string,password:string,address:string){await ensureOwner();return(await backend()).login(email,password,address);}
export async function sessionStaff(token?:string){return(await backend()).sessionStaff(token);}
export async function logout(token?:string){return(await backend()).logout(token);}
export async function listStaff(){return(await backend()).listStaff();}
export async function readSettings(){return(await backend()).readSettings();}
export async function readPublicCard(token:string){return(await backend()).readPublicCard(token);}
export async function one(sql:string,...args:(string|number|null)[]){return(await backend()).one(sql,...args);}
export async function localRpc(fn:string,args:Record<string,unknown>,staffId:string){return(await backend()).localRpc(fn,args,staffId);}
export async function changeOwnPassword(staffId:string,current:string,password:string){return(await backend()).changeOwnPassword(staffId,current,password);}
export async function exportPostgresBackup(){const store=await import('./postgres-store');return store.exportBackup();}
