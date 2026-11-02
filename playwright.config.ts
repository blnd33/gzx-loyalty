import { defineConfig } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
process.env.LOCAL_DB_PATH=resolve('data/e2e',`${randomUUID()}.sqlite`);
export default defineConfig({
  testDir:'tests',timeout:150000,workers:1,fullyParallel:false,
  use:{baseURL:'http://127.0.0.1:3100',viewport:{width:1440,height:1000},trace:'retain-on-failure',actionTimeout:15000},
  webServer:{command:'node --experimental-strip-types scripts/e2e-server.mjs',url:'http://127.0.0.1:3100/api/health',reuseExistingServer:false,timeout:30000},
  reporter:'list',
});
