import { spawn } from 'node:child_process';
const {initializeOwner}=await import(process.env.TEST_DATABASE_URL?'../src/lib/postgres-store.ts':'../src/lib/local-store.ts');
await initializeOwner('owner@test.local','Test-owner-password-123');
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3100'],{stdio:'inherit',env:process.env});
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>{server.kill();process.exit(0);});
server.on('exit',code=>process.exit(code??0));
