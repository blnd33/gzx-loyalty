import { afterEach, describe, expect, it, vi } from 'vitest';
import { appUrl, secureCookies, redirectBase } from './deployment';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
afterEach(()=>vi.unstubAllEnvs());
describe('online deployment',()=>{
  it('uses the runtime domain for QR URLs and redirects',()=>{
    vi.stubEnv('DEPLOYMENT_MODE','server');vi.stubEnv('APP_URL','https://loyalty.example.com');
    vi.stubEnv('NEXT_PUBLIC_APP_URL','http://localhost:3000');
    expect(appUrl()).toBe('https://loyalty.example.com');expect(secureCookies()).toBe(true);
    expect(redirectBase('http://app:3000/c/token','forged-host.example').origin).toBe('https://loyalty.example.com');
    vi.stubEnv('APP_URL','https://new.example.com');expect(appUrl()).toBe('https://new.example.com');
  });
  it('refuses insecure or incomplete online configuration',()=>{
    vi.stubEnv('DEPLOYMENT_MODE','server');
    for(const value of ['','http://example.com','https://user:pass@example.com','https://example.com/path','https://example.com?secret=x']){
      vi.stubEnv('APP_URL',value);expect(()=>appUrl()).toThrow();
    }
  });
  it('keeps local HTTP cookies usable without enabling them for online HTTPS',()=>{
    vi.stubEnv('DEPLOYMENT_MODE','');vi.stubEnv('APP_URL','http://localhost:3000');
    expect(secureCookies()).toBe(false);expect(redirectBase('http://localhost:3000','127.0.0.1:3000').origin).toBe('http://127.0.0.1:3000');
  });
  it('bootstraps a server from a secret and keeps records and password across restarts',()=>{
    const folder=mkdtempSync(resolve(tmpdir(),'gzx-server-test-'));
    const secret=resolve(folder,'owner-secret');const database=resolve(folder,'lounge.sqlite');
    writeFileSync(secret,'Online-test-password-123');
    const env={...process.env,DEPLOYMENT_MODE:'server',APP_URL:'https://loyalty.example.com',LOCAL_DB_PATH:database,BACKUP_DIR:resolve(folder,'backups'),OWNER_EMAIL:'owner@example.com',OWNER_PASSWORD_FILE:secret};
    const init=()=>spawnSync(process.execPath,['--experimental-strip-types','scripts/local-init.mjs'],{env,encoding:'utf8'});
    const first=init();expect(first.status,first.stderr).toBe(0);expect(first.stdout).not.toContain('Online-test-password-123');expect(existsSync(resolve(folder,'OWNER-LOGIN.txt'))).toBe(false);
    writeFileSync(secret,'Different-bootstrap-password-123');expect(init().status).toBe(0);
    const verify=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','-e',"import { login,localRpc } from './src/lib/local-store.ts';const user=login('owner@example.com','Online-test-password-123','test');if(!user)throw Error('Password was replaced');localRpc('register_customer',{p_name:'Hosted persistent customer',p_idempotency_key:crypto.randomUUID()},user.staff.id);"],{env,encoding:'utf8'});
    expect(verify.status,verify.stderr).toBe(0);
    const backup=spawnSync(process.execPath,['--experimental-strip-types','scripts/local-backup.mjs'],{env,encoding:'utf8'});expect(backup.status,backup.stderr).toBe(0);
    expect(init().status).toBe(0);
    const verifyRestart=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','-e',"import{one}from'./src/lib/local-store.ts';if(one('SELECT count(*) n FROM customers').n!==1)throw Error('Records lost');"],{env,encoding:'utf8'});
    expect(verifyRestart.status,verifyRestart.stderr).toBe(0);
    expect(readFileSync(database).subarray(0,15).toString()).toBe('SQLite format 3');
  });
});
