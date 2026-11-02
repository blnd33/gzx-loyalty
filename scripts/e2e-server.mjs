import { spawn } from 'node:child_process';
import { initializeOwner } from '../src/lib/local-store.ts';
initializeOwner('owner@test.local','Test-owner-password-123');
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3100'],{stdio:'inherit',env:process.env});
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>{server.kill();process.exit(0);});
server.on('exit',code=>process.exit(code??0));
