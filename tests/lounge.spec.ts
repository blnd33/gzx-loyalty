import { test, expect } from '@playwright/test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, unlinkSync } from 'node:fs';
import QRCode from 'qrcode';

test('staff login and every main lounge workflow',async({page,context})=>{
  if(process.env.E2E_LAN_MODE==='1')await page.addInitScript(()=>{Object.defineProperty(globalThis.crypto,'randomUUID',{value:undefined,configurable:true});Object.defineProperty(navigator,'clipboard',{value:undefined,configurable:true});});
  await context.grantPermissions(['clipboard-read','clipboard-write']);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/dashboard');await expect(page).toHaveURL(/\/login/);
  await page.getByLabel('Email',{exact:true}).fill('owner@test.local');
  await page.getByLabel('Password',{exact:true}).fill('Test-owner-password-123');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Dashboard',exact:true})).toBeVisible();

  await page.getByRole('link',{name:'Add new customer',exact:true}).click();
  await page.getByLabel('Customer name').fill('Lounge Workflow Test');
  await page.getByLabel('Phone number').fill('07501234567');
  await page.getByLabel('Notes').fill('End to end verification');
  await page.getByRole('button',{name:'Create customer',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Lounge Workflow Test',exact:true})).toBeVisible();
  const profileUrl=page.url();
  const code=(await page.locator('.gzx-plate__code').first().innerText()).trim();
  expect(code).toMatch(/^[A-Z]{6}$/);
  const customerPath=await page.getByRole('link',{name:'Customer view',exact:true}).getAttribute('href');
  const customerContext=await context.browser()!.newContext({viewport:{width:390,height:844}});
  const customerPage=await customerContext.newPage();
  await customerPage.goto(`http://127.0.0.1:3100${customerPath!.replace('/card/','/c/')}`);
  await expect(customerPage).toHaveURL(new RegExp('/card/'));
  await expect(customerPage.getByRole('heading',{name:'Lounge Workflow Test',exact:true})).toBeVisible();
  await expect(customerPage.getByRole('button',{name:'Add 1 paid hour',exact:true})).toHaveCount(0);
  await expect(customerPage.getByRole('button',{name:'Redeem reward',exact:true})).toHaveCount(0);
  expect(await customerPage.content()).not.toContain('07501234567');
  expect(await customerPage.content()).not.toContain('End to end verification');
  const publicResponse=await customerPage.request.get(`http://127.0.0.1:3100${customerPath}`);
  expect(publicResponse.headers()['referrer-policy']).toBe('no-referrer');
  expect(publicResponse.headers()['cache-control']).toContain('no-store');
  const updates=await customerPage.request.get(`http://127.0.0.1:3100/api${customerPath}`);
  expect(Object.keys(await updates.json())).toEqual(['version']);
  expect(updates.headers()['cache-control']).toContain('no-store');
  expect((await customerPage.request.get(`http://127.0.0.1:3100/api/card/${code}`)).status()).toBe(404);
  expect((await customerPage.request.get('http://127.0.0.1:3100/api/backup')).status()).toBe(403);
  await page.getByRole('tab',{name:'Front',exact:true}).click();
  await expect(page.getByRole('img',{name:/loyalty card, front/}).first()).toBeVisible();
  await page.getByRole('tab',{name:'Progress side',exact:true}).click();

  for(let n=1;n<=3;n++){
    await page.getByRole('button',{name:'Add 1 paid hour',exact:true}).click();
    await page.getByLabel('Receipt / session no.').fill(`TEST-${n}`);
    await page.getByRole('button',{name:'Confirm paid hour',exact:true}).click();
    await expect(page.getByRole('alertdialog')).not.toBeVisible();
    await expect(page.getByRole('img',{name:new RegExp(`card back.*${n} of 3 paid hours`)}).first()).toBeVisible();
    // The customer page must update by itself, with no click or reload.
    await expect(customerPage.getByRole('img',{name:new RegExp(`card back.*${n} of 3 paid hours`)})).toBeVisible({timeout:10000});
    if(n===1)await expect(customerPage.getByText('1 paid hour recorded this cycle',{exact:true})).toBeVisible();
  }
  await page.getByRole('button',{name:'Redeem reward',exact:true}).click();
  await page.getByRole('button',{name:'Confirm redemption',exact:true}).click();
  await expect(page.getByText('Cycle #2',{exact:true})).toBeVisible();
  await expect(customerPage.getByText('Cycle #2',{exact:true})).toBeVisible({timeout:10000});
  await page.reload();
  await expect(page.getByRole('img',{name:/card back.*0 of 3 paid hours/}).first()).toBeVisible();

  await page.getByRole('link',{name:'History',exact:true}).click();
  await expect(page.getByText('Loyalty history',{exact:true})).toBeVisible();
  await expect(page.getByText('TEST-1',{exact:false}).first()).toBeVisible();
  await expect(page.getByText('Reward redeemed',{exact:true}).first()).toBeVisible();
  await page.goto('/scan');await page.getByLabel('Enter customer code').fill(code.toLowerCase());
  await page.getByRole('button',{name:'Find customer',exact:true}).click();
  await expect(page).toHaveURL(profileUrl);

  await page.goto('/scan');
  await page.getByLabel('QR code photo',{exact:true}).setInputFiles({name:'loyalty-card.png',mimeType:'image/png',buffer:await QRCode.toBuffer(`http://lounge/c/${customerPath!.split('/').at(-1)}`,{width:600,margin:4})});
  await expect(page).toHaveURL(profileUrl);

  await page.getByRole('button',{name:'Edit details',exact:true}).click();
  await page.getByLabel('Name',{exact:true}).fill('Updated Workflow Customer');
  await page.getByRole('button',{name:'Save changes',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Updated Workflow Customer',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Add 1 paid hour',exact:true}).click();
  await page.getByRole('button',{name:'Confirm paid hour',exact:true}).click();
  await expect(page.getByRole('alertdialog')).not.toBeVisible();
  await page.getByRole('button',{name:'Correct last paid hour',exact:true}).click();
  await page.getByLabel('Reason (saved to the audit log)').fill('Verification correction');
  await page.getByRole('button',{name:'Void paid hour',exact:true}).click();
  await expect(page.getByRole('alertdialog')).not.toBeVisible();
  await expect(page.getByRole('button',{name:'Correct last paid hour',exact:true})).toBeDisabled();

  for(const label of ['Deactivate card','Reactivate card','Deactivate customer','Reactivate customer']){
    await page.getByRole('button',{name:label,exact:true}).click();
    await page.getByLabel('Reason (saved to the audit log)').fill('Verification toggle');
    await page.getByRole('alertdialog').getByRole('button',{name:label.startsWith('Deactivate')?'Deactivate':'Reactivate',exact:true}).click();
    await expect(page.getByRole('alertdialog')).not.toBeVisible();
  }
  await page.getByRole('button',{name:'Reissue card code',exact:true}).click();
  await page.getByLabel('Reason (saved to the audit log)').fill('Test replacement');
  await page.getByRole('button',{name:'Reissue card',exact:true}).click();
  await expect(page.getByRole('alertdialog')).not.toBeVisible();
  await expect(page.locator('.gzx-plate__code').first()).not.toHaveText(code);
  await customerPage.reload();await expect(customerPage.getByRole('heading',{name:'Card unavailable',exact:true})).toBeVisible();
  await customerPage.goto(profileUrl);await expect(customerPage).toHaveURL(/\/login/);
  await customerContext.close();
  await page.getByRole('button',{name:'Copy customer link',exact:true}).click();
  await expect(page.getByText('Customer link copied.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Copy code',exact:true}).click();
  await expect(page.getByText(/Code .* copied/)).toBeVisible();
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'Download PNG',exact:true}).click();
  const png=await downloadPromise;expect(png.suggestedFilename()).toMatch(/front\.png$/);
  await expect(page.getByRole('button',{name:'Download PNG',exact:true})).toBeEnabled({timeout:30000});
  const popupPromise=page.waitForEvent('popup');await page.getByRole('link',{name:'Print card',exact:true}).click();
  const print=await popupPromise;await print.waitForLoadState();
  await expect(print.locator('.print-sheet')).toHaveCount(2);
  await print.getByRole('link',{name:'Show crop marks'}).click();
  await expect(print.locator('.mark')).toHaveCount(16);
  await print.close();

  await page.goto('/customers?q=Updated');await expect(page.getByRole('link',{name:'Updated Workflow Customer',exact:true}).first()).toBeVisible();
  await page.goto('/reports?days=7');await expect(page.getByRole('heading',{name:'Reports',exact:true})).toBeVisible();
  await page.getByRole('link',{name:'90 days',exact:true}).click();await expect(page).toHaveURL(/days=90/);
  await page.goto('/rewards');await expect(page.getByText('Updated Workflow Customer',{exact:true})).toBeVisible();

  await page.goto('/settings');
  await page.getByLabel('Lounge name',{exact:true}).fill('Verified Lounge');
  await page.getByRole('button',{name:'Save settings',exact:true}).click();
  await expect(page.getByText('Settings saved.',{exact:true})).toBeVisible();
  await page.reload();await expect(page.getByLabel('Lounge name',{exact:true})).toHaveValue('Verified Lounge');
  const backupPromise=page.waitForEvent('download');await page.getByRole('link',{name:'Download database backup'}).click();
  const backup=await backupPromise;const path=await backup.path();let qrToken:string;
  if(process.env.TEST_DATABASE_URL){const snapshot=JSON.parse(readFileSync(path!,'utf8'));expect(snapshot.format).toBe('gzx-postgres-backup-v1');expect(snapshot.customers).toHaveLength(1);qrToken=snapshot.cards.find((c:{status:string})=>c.status==='active').qr_token;}
  else{expect(readFileSync(path!).subarray(0,15).toString()).toBe('SQLite format 3');const snapshot=new DatabaseSync(path!);expect((snapshot.prepare('SELECT count(*) n FROM customers').get() as {n:number}).n).toBe(1);qrToken=(snapshot.prepare("SELECT qr_token FROM cards WHERE status='active'").get() as {qr_token:string}).qr_token;snapshot.close();}
  await page.goto(`/c/${qrToken}`);await expect(page).toHaveURL(profileUrl);

  await page.goto('/staff');await page.getByLabel('Full name',{exact:true}).fill('Test Cashier');
  await page.getByLabel('Email (login)').fill('cashier@test.local');await page.getByLabel('Temporary password').fill('Cashier-password-123');
  await page.getByRole('button',{name:'Create login',exact:true}).click();await expect(page.getByRole('cell',{name:'Test Cashier',exact:true})).toBeVisible();
  const staffRow=page.getByRole('row').filter({hasText:'Test Cashier'});
  await staffRow.getByRole('button',{name:'Edit',exact:true}).click();
  await page.getByLabel('Reset password (optional)').fill('New-cashier-password-123');
  await page.getByRole('alertdialog').getByRole('button',{name:'Save',exact:true}).click();
  await expect(page.getByRole('alertdialog')).not.toBeVisible();

  const cashier=await context.browser()!.newContext({viewport:{width:390,height:844}});const cp=await cashier.newPage();
  await cp.goto('http://127.0.0.1:3100/login');await cp.getByLabel('Email',{exact:true}).fill('cashier@test.local');await cp.getByLabel('Password',{exact:true}).fill('New-cashier-password-123');
  await cp.getByRole('button',{name:'Sign in',exact:true}).click();await expect(cp).toHaveURL(/\/scan$/);
  await cp.goto('http://127.0.0.1:3100/dashboard');await expect(cp).toHaveURL(/\/scan/);
  await cp.goto(profileUrl);await expect(cp.getByRole('button',{name:'Correct last paid hour',exact:true})).toHaveCount(0);
  await cp.getByRole('button',{name:'Edit details',exact:true}).click();await cp.getByLabel('Name',{exact:true}).fill('Cashier Updated Customer');
  await cp.getByRole('button',{name:'Save changes',exact:true}).click();await expect(cp.getByRole('heading',{name:'Cashier Updated Customer',exact:true})).toBeVisible();
  await cashier.close();

  await page.goto('/account');await page.getByLabel('Current password',{exact:true}).fill('Test-owner-password-123');
  await page.getByLabel('New password',{exact:true}).fill('Changed-owner-password-123');await page.getByLabel('Confirm new password').fill('Changed-owner-password-123');
  await page.getByRole('button',{name:'Change password',exact:true}).click();await expect(page).toHaveURL(/\/login\?reset=1/);
  await page.getByLabel('Email',{exact:true}).fill('owner@test.local');await page.getByLabel('Password',{exact:true}).fill('Changed-owner-password-123');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page).toHaveURL(/\/dashboard/);
  await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page).toHaveURL(/\/login/);
  expect(errors).toEqual([]);
  // The downloaded backup is a test-only snapshot managed by Playwright's temporary directory.
  unlinkSync(path!);
});
