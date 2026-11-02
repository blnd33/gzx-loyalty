import { spawn, spawnSync } from 'node:child_process';
import { appUrl } from '../src/lib/deployment.ts';
if(process.env.DEPLOYMENT_MODE!=='server') throw new Error('Set DEPLOYMENT_MODE=server for the online server launcher.');
const url=appUrl();
if(!process.env.LOCAL_DB_PATH || !process.env.BACKUP_DIR) throw new Error('Configure LOCAL_DB_PATH and BACKUP_DIR on persistent disks before starting the server.');
function run(script) {
  const result=spawnSync(process.execPath,['--experimental-strip-types',script],{stdio:'inherit',env:process.env});
  if(result.status!==0) throw new Error(`${script} failed. Server was not started.`);
}
run('scripts/local-init.mjs');
run('scripts/local-backup.mjs');
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname',process.env.HOSTNAME||'0.0.0.0','--port',process.env.PORT||'3000'],{stdio:'inherit',env:process.env});
let backupProcess;
const timer=setInterval(()=>{
  if(backupProcess) return;
  backupProcess=spawn(process.execPath,['--experimental-strip-types','scripts/local-backup.mjs'],{stdio:'inherit',env:process.env});
  backupProcess.on('error',error=>{console.error('Scheduled backup failed:',error.message);backupProcess=undefined;});
  backupProcess.on('exit',code=>{if(code)console.error('Scheduled backup failed; check the backup volume.');backupProcess=undefined;});
},24*3600000);
timer.unref();
let shuttingDown=false;
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{if(shuttingDown)return;shuttingDown=true;clearInterval(timer);server.kill(signal);backupProcess?.kill(signal);});
server.on('error',error=>{console.error(error.message);process.exitCode=1;clearInterval(timer);});
server.on('exit',code=>{clearInterval(timer);process.exit(code??0);});
console.log(`Online server configured for ${url}. Database and backups are on the configured persistent disks.`);
