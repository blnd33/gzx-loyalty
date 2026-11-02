import { beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { initializeOwner, login, sessionStaff, logout, localRpc, one, db, changeOwnPassword, readPublicCard } from './local-store';

const password='Test-owner-password-123';
let ownerId:string;
let cashierId:string;
const args=(more:Record<string,unknown>={})=>({p_idempotency_key:randomUUID(),...more});
function call(fn:string,a:Record<string,unknown>={},staff=ownerId) {return localRpc(fn,a,staff);}
function customer(name='Test Customer') {return call('register_customer',args({p_name:name,p_phone:null,p_notes:null}));}
beforeAll(()=>{
  const folder=resolve('data/tests'); mkdirSync(folder,{recursive:true});
  process.env.LOCAL_DB_PATH=resolve(folder,`${randomUUID()}.sqlite`);
  initializeOwner('owner@test.local',password);
  ownerId=one('SELECT id FROM staff').id;
  call('admin_create_staff',{p_full_name:'Cashier',p_email:'cashier@test.local',p_password:password,p_role:'cashier'});
  cashierId=one("SELECT id FROM staff WHERE role='cashier'").id;
});
describe('local staff and permissions',()=>{
  it('hashes passwords and persists revocable sessions',()=>{
    expect(one('SELECT password_hash FROM staff WHERE id=?',ownerId).password_hash).not.toContain(password);
    expect(login('owner@test.local','wrong','test')).toBeNull();
    const result=login('OWNER@test.local',password,'test')!;
    expect(sessionStaff(result.token)?.id).toBe(ownerId);
    logout(result.token); expect(sessionStaff(result.token)).toBeNull();
    expect(initializeOwner('other@test.local',password)).toBe(false);
  });
  it('rejects unauthenticated and cashier administration',()=>{
    expect(()=>call('get_dashboard_stats',{},'missing')).toThrow('NOT_AUTHENTICATED');
    for(const fn of ['get_dashboard_stats','get_reports','admin_create_staff','update_setting','void_last_punch','reissue_card']) expect(()=>call(fn,{},cashierId)).toThrow('FORBIDDEN');
    expect(()=>call('admin_update_staff',{p_staff_id:ownerId,p_full_name:'Owner',p_role:'cashier',p_active:true})).toThrow('CANNOT_DEMOTE_SELF');
  });
  it('disabled staff lose access immediately and duplicate emails are rejected',()=>{
    const token=login('cashier@test.local',password,'cashier-test')!.token;
    call('admin_update_staff',{p_staff_id:cashierId,p_full_name:'Cashier',p_role:'cashier',p_active:false});
    expect(sessionStaff(token)).toBeNull();
    expect(()=>call('search_customers',{},cashierId)).toThrow('NOT_AUTHENTICATED');
    call('admin_update_staff',{p_staff_id:cashierId,p_full_name:'Cashier',p_role:'cashier',p_active:true});
    expect(()=>call('admin_create_staff',{p_full_name:'Another',p_email:'CASHIER@test.local',p_password:password,p_role:'cashier'})).toThrow('EMAIL_EXISTS');
  });
});
describe('local loyalty transactions',()=>{
  it('exposes only a read-only card through a private token and revokes old links',()=>{
    const c=call('register_customer',args({p_name:'Private Card Customer',p_phone:'07501234567',p_notes:'Staff-only note'}));
    const token=call('get_customer_profile',{p_customer_id:c.customer_id}).card.qr_token;
    expect(readPublicCard(c.code)).toBeNull();expect(readPublicCard('invalid')).toBeNull();
    expect(readPublicCard('A'.repeat(32))).toBeNull();
    expect(readPublicCard(token)).toEqual({name:'Private Card Customer',code:c.code,cycleNumber:1,punches:0,rewardAvailable:false});
    for(let i=0;i<3;i++)call('add_paid_hour',args({p_customer_id:c.customer_id}));
    expect(readPublicCard(token)?.rewardAvailable).toBe(true);
    call('redeem_reward',args({p_customer_id:c.customer_id}));
    expect(readPublicCard(token)?.cycleNumber).toBe(2);expect(readPublicCard(token)?.punches).toBe(0);
    call('set_card_status',{p_customer_id:c.customer_id,p_active:false,p_reason:'Lost card'});
    expect(readPublicCard(token)).toBeNull();
    call('reissue_card',{p_customer_id:c.customer_id,p_reason:'Replace private link'});
    expect(readPublicCard(token)).toBeNull();
    const fresh=call('get_customer_profile',{p_customer_id:c.customer_id}).card.qr_token;
    expect(readPublicCard(fresh)?.cycleNumber).toBe(2);
    call('set_customer_active',{p_customer_id:c.customer_id,p_active:false,p_reason:'Closed account'});
    expect(readPublicCard(fresh)).toBeNull();
  });
  it('persists across processes and serializes simultaneous cashiers',async()=>{
    const id=customer('Concurrent Customer').customer_id;
    const moduleUrl=pathToFileURL(resolve('src/lib/local-store.ts')).href;
    const results=await Promise.all(Array.from({length:6},()=>promisify(execFile)(process.execPath,
      ['--experimental-strip-types','--input-type=module','-e',`import { localRpc } from ${JSON.stringify(moduleUrl)}; try { localRpc('add_paid_hour',${JSON.stringify(args({p_customer_id:id}))},${JSON.stringify(ownerId)}); console.log('recorded'); } catch(e) { if(e.message!=='REWARD_PENDING') throw e; console.log('blocked'); }`],{env:{...process.env}})));
    expect(results.filter(r=>r.stdout.trim()==='recorded')).toHaveLength(3);
    expect(one('SELECT count(*) n FROM punches WHERE customer_id=? AND voided=0',id).n).toBe(3);
    expect(one("SELECT count(*) n FROM rewards WHERE customer_id=? AND status='available'",id).n).toBe(1);
  });
  it('registers once, supports code and QR lookup without adding hours',()=>{
    const request=args({p_name:'Registration Test'}); const c=call('register_customer',request,cashierId);
    expect(c.code).toMatch(/^[A-Z]{6}$/); expect(call('register_customer',request,cashierId).customer_id).toBe(c.customer_id);
    const p=call('get_customer_profile',{p_customer_id:c.customer_id});
    expect(call('find_customer_by_code',{p_code:c.code.toLowerCase()}).customer_id).toBe(c.customer_id);
    expect(call('find_customer_by_qr',{p_token:p.card.qr_token}).customer_id).toBe(c.customer_id);
    expect(p.state.punch_count).toBe(0);
    expect(()=>call('register_customer',request,ownerId)).toThrow('IDEMPOTENCY_KEY_REUSED');
  });
  it('unlocks on hour three, rejects a fourth, redeems once and starts a fresh cycle',()=>{
    const c=customer(); const id=c.customer_id; let punch;
    for(let i=1;i<=3;i++) {const request=args({p_customer_id:id,p_receipt_reference:`R-${i}`});punch=call('add_paid_hour',request,cashierId);expect(punch.punch_count).toBe(i);expect(call('add_paid_hour',request,cashierId).duplicate).toBe(true);}
    expect(punch.reward_unlocked).toBe(true);
    expect(()=>call('add_paid_hour',args({p_customer_id:id}))).toThrow('REWARD_PENDING');
    const request=args({p_customer_id:id}); const redeemed=call('redeem_reward',request,cashierId);
    expect(redeemed.cycle_number).toBe(2);expect(redeemed.punch_count).toBe(0);
    expect(call('redeem_reward',request,cashierId).duplicate).toBe(true);
    expect(()=>call('redeem_reward',args({p_customer_id:id}))).toThrow('NO_REWARD_AVAILABLE');
    const history=call('get_customer_history',{p_customer_id:id});
    expect(history.filter((r:{action:string})=>r.action==='punch.added')).toHaveLength(3);
    expect(history.filter((r:{action:string})=>r.action==='reward.redeemed')).toHaveLength(1);
    expect(history.every((r:{staff_name:string})=>!!r.staff_name)).toBe(true);
    expect(()=>db().prepare('DELETE FROM history WHERE customer_id=?').run(id)).toThrow('History is append-only');
  });
  it('rolls back failed operations and prevents cross-customer retry reuse',()=>{
    const a=customer(),b=customer();const req=args({p_customer_id:a.customer_id});call('add_paid_hour',req);
    expect(()=>call('add_paid_hour',{...req,p_customer_id:b.customer_id})).toThrow('IDEMPOTENCY_KEY_REUSED');
    const failed=args({p_customer_id:randomUUID()});expect(()=>call('add_paid_hour',failed)).toThrow('CUSTOMER_NOT_FOUND');
    expect(one('SELECT * FROM requests WHERE key=?',failed.p_idempotency_key)).toBeUndefined();
  });
  it('corrects the last hour, withdraws and re-earns a reward without duplication',()=>{
    const id=customer().customer_id;
    for(let i=0;i<3;i++)call('add_paid_hour',args({p_customer_id:id}));
    call('void_last_punch',{p_customer_id:id,p_reason:'Wrong receipt'});
    expect(call('get_customer_profile',{p_customer_id:id}).state.punch_count).toBe(2);
    call('add_paid_hour',args({p_customer_id:id}));
    expect(one('SELECT count(*) n FROM rewards WHERE customer_id=?',id).n).toBe(1);
    expect(call('get_customer_profile',{p_customer_id:id}).state.reward_status).toBe('available');
  });
  it('blocks inactive customers and cards, replaces codes while keeping progress',()=>{
    const c=customer();const id=c.customer_id;const old=call('get_customer_profile',{p_customer_id:id}).card;
    call('add_paid_hour',args({p_customer_id:id}));
    call('set_card_status',{p_customer_id:id,p_active:false,p_reason:'Lost card'});
    expect(()=>call('add_paid_hour',args({p_customer_id:id}))).toThrow('CARD_INACTIVE');
    const fresh=call('reissue_card',{p_customer_id:id,p_reason:'Replacement'});
    expect(fresh.code).not.toBe(c.code);
    expect(call('find_customer_by_qr',{p_token:old.qr_token}).error).toBe('CARD_REPLACED');
    expect(call('get_customer_profile',{p_customer_id:id}).state.punch_count).toBe(1);
    call('set_customer_active',{p_customer_id:id,p_active:false,p_reason:'Closed account'});
    expect(()=>call('add_paid_hour',args({p_customer_id:id}))).toThrow('CUSTOMER_INACTIVE');
  });
  it('searches, filters, lists rewards, and reports real counts',()=>{
    const c=customer('Specific Search');call('add_paid_hour',args({p_customer_id:c.customer_id}));
    expect(call('search_customers',{p_query:'specific search'})).toHaveLength(1);
    const stats=call('get_dashboard_stats');const r=call('get_reports',{p_days:7});
    expect(stats.total_paid_hours).toBe(one('SELECT count(*) n FROM punches WHERE voided=0').n);
    expect(r.daily).toHaveLength(7);expect(r.weekly).toHaveLength(8);expect(r.monthly).toHaveLength(6);
    expect(r.totals.outstanding).toBe(call('list_rewards',{p_status:'available'}).length);
    expect(r.daily.reduce((n:number,d:{paid_hours:number})=>n+d.paid_hours,0)).toBe(stats.total_paid_hours);
    expect(call('get_recent_activity').length).toBeGreaterThan(0);
  });
  it('enforces lookup throttling and password changes invalidate sessions',()=>{
    call('update_setting',{p_key:'lookup_limit_per_minute',p_value:3});
    for(let i=0;i<3;i++)call('find_customer_by_code',{p_code:'ZZZZZZ'},cashierId);
    expect(call('find_customer_by_code',{p_code:'ZZZZZZ'},cashierId).error).toBe('RATE_LIMITED');
    const token=login('cashier@test.local',password,'change-test')!.token;
    expect(changeOwnPassword(cashierId,'wrong',password+'new')).toBe(false);
    expect(changeOwnPassword(cashierId,password,password+'new')).toBe(true);
    expect(sessionStaff(token)).toBeNull();
    expect(login('cashier@test.local',password+'new','change-test')).not.toBeNull();
  });
});
