/* SQLite rows have SQL-dependent shapes at this boundary. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { randomBytes, randomInt, randomUUID, createHash, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { StaffProfile } from './types';

export const databasePath = () => resolve(process.env.LOCAL_DB_PATH || 'data/lounge.sqlite');
const globals = globalThis as typeof globalThis & { loungeDb?: DatabaseSync; loungeDbPath?: string };
export function db(): DatabaseSync {
  const path = databasePath();
  if (globals.loungeDb && globals.loungeDbPath === path) return globals.loungeDb;
  mkdirSync(dirname(path), { recursive: true });
  const database = new DatabaseSync(path);
  database.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS staff (id TEXT PRIMARY KEY, full_name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE, password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('super_admin','cashier')), active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, staff_id TEXT NOT NULL REFERENCES staff(id), expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS customers (id TEXT PRIMARY KEY, name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100), phone TEXT, notes TEXT,
      active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, last_visit_at TEXT);
    CREATE TABLE IF NOT EXISTS cards (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id), code TEXT NOT NULL UNIQUE,
      qr_token TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'active', status_reason TEXT, created_at TEXT NOT NULL);
    CREATE UNIQUE INDEX IF NOT EXISTS one_current_card ON cards(customer_id) WHERE status != 'replaced';
    CREATE TABLE IF NOT EXISTS cycles (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id), cycle_number INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','redeemed')), UNIQUE(customer_id,cycle_number));
    CREATE UNIQUE INDEX IF NOT EXISTS one_open_cycle ON cycles(customer_id) WHERE status != 'redeemed';
    CREATE TABLE IF NOT EXISTS punches (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id), cycle_id TEXT NOT NULL REFERENCES cycles(id),
      slot INTEGER NOT NULL CHECK(slot BETWEEN 1 AND 3), staff_id TEXT NOT NULL REFERENCES staff(id), created_at TEXT NOT NULL, voided INTEGER NOT NULL DEFAULT 0,
      receipt_reference TEXT, notes TEXT);
    CREATE UNIQUE INDEX IF NOT EXISTS one_live_slot ON punches(cycle_id,slot) WHERE voided=0;
    CREATE TABLE IF NOT EXISTS rewards (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id), cycle_id TEXT NOT NULL UNIQUE REFERENCES cycles(id),
      status TEXT NOT NULL CHECK(status IN ('available','redeemed','revoked')), unlocked_at TEXT NOT NULL, redeemed_at TEXT, staff_id TEXT REFERENCES staff(id));
    CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id TEXT REFERENCES customers(id), staff_id TEXT REFERENCES staff(id),
      action TEXT NOT NULL, created_at TEXT NOT NULL, metadata TEXT NOT NULL DEFAULT '{}', reason TEXT);
    CREATE TRIGGER IF NOT EXISTS history_no_update BEFORE UPDATE ON history BEGIN SELECT RAISE(ABORT,'History is append-only'); END;
    CREATE TRIGGER IF NOT EXISTS history_no_delete BEFORE DELETE ON history BEGIN SELECT RAISE(ABORT,'History is append-only'); END;
    CREATE TABLE IF NOT EXISTS requests (key TEXT PRIMARY KEY, operation TEXT NOT NULL, customer_id TEXT, staff_id TEXT NOT NULL, result TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS attempts (id INTEGER PRIMARY KEY, bucket TEXT NOT NULL, at INTEGER NOT NULL, failed INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS attempts_bucket_time ON attempts(bucket,at);
    CREATE INDEX IF NOT EXISTS history_customer ON history(customer_id,id);
    CREATE INDEX IF NOT EXISTS punches_customer ON punches(customer_id,created_at);
    CREATE INDEX IF NOT EXISTS rewards_status ON rewards(status,unlocked_at);
  `);
  globals.loungeDb = database; globals.loungeDbPath = path;
  return database;
}
export function one(sql: string, ...args: SQLInputValue[]): any { return db().prepare(sql).get(...args); }
export function all(sql: string, ...args: SQLInputValue[]): any[] { return db().prepare(sql).all(...args); }
function run(sql: string, ...args: SQLInputValue[]) { return db().prepare(sql).run(...args); }
function atomic<T>(fn: () => T): T {
  db().exec('BEGIN IMMEDIATE');
  try { const result = fn(); db().exec('COMMIT'); return result; }
  catch (error) { db().exec('ROLLBACK'); throw error; }
}
const now = () => new Date().toISOString();
function fail(code: string): never { throw new Error(code); }
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
export function passwordHash(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
function passwordMatches(password: string, hash: string) {
  const [salt, expected] = hash.split(':');
  const actual = scryptSync(password, salt, 64);
  return !!expected && expected.length === 128 && timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}
function publicStaff(row: any): StaffProfile { return { id: row.id, full_name: row.full_name, role: row.role, active: !!row.active, created_at: row.created_at }; }
export function initializeOwner(email: string, password: string) {
  if (password.length < 10) fail('INVALID_PASSWORD');
  return atomic(() => {
    if (one('SELECT id FROM staff LIMIT 1')) return false;
    run('INSERT INTO staff VALUES (?,?,?,?,?,?,?)', randomUUID(), 'Lounge Owner', email.toLowerCase(), passwordHash(password), 'super_admin', 1, now());
    return true;
  });
}
export function login(email: string, password: string, address: string) {
  if (!email || email.length > 254 || password.length > 200) return null;
  // Both account and source address are throttled; source comes from the server.
  const buckets = [`login:${email.toLowerCase()}`, `ip:${address}`];
  for (const bucket of buckets) if (one('SELECT count(*) n FROM attempts WHERE bucket=? AND at>? AND failed=1', bucket, Date.now() - 900000).n >= 10) fail('LOGIN_RATE_LIMITED');
  const row = one('SELECT * FROM staff WHERE email=? COLLATE NOCASE', email.trim());
  const valid = row?.active && passwordMatches(password, row.password_hash);
  if (!row) scryptSync(password, 'unregistered-account', 64);
  for (const bucket of buckets) run('INSERT INTO attempts(bucket,at,failed) VALUES (?,?,?)', bucket, Date.now(), valid ? 0 : 1);
  run('DELETE FROM attempts WHERE at<?', Date.now() - 86400000);
  if (!valid) return null;
  const token = randomBytes(32).toString('hex');
  run('DELETE FROM sessions WHERE expires_at<?', Date.now());
  run('INSERT INTO sessions VALUES (?,?,?)', hashToken(token), row.id, Date.now() + 7 * 86400000);
  return { token, staff: publicStaff(row) };
}
export function sessionStaff(token?: string): StaffProfile | null {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const row = one('SELECT s.* FROM sessions t JOIN staff s ON s.id=t.staff_id WHERE t.token_hash=? AND t.expires_at>? AND s.active=1', hashToken(token), Date.now());
  return row ? publicStaff(row) : null;
}
export function logout(token?: string) { if (token) run('DELETE FROM sessions WHERE token_hash=?', hashToken(token)); }
export function listStaff() { return all('SELECT * FROM staff ORDER BY active DESC, full_name').map(publicStaff); }
export function readSettings() { return Object.fromEntries(all('SELECT * FROM settings').map(row => [row.key, JSON.parse(row.value)])); }
export interface PublicLoyaltyCard {
  name: string;
  code: string;
  cycleNumber: number;
  punches: number;
  rewardAvailable: boolean;
}
/** A private QR token grants read-only access to this minimal card snapshot. */
export function readPublicCard(token: string): PublicLoyaltyCard | null {
  if (!/^[A-Za-z0-9_-]{32,64}$/.test(token)) return null;
  const row=one(`SELECT c.name, ca.code, cy.cycle_number,
    (SELECT count(*) FROM punches p WHERE p.cycle_id=cy.id AND p.voided=0) punch_count,
    EXISTS(SELECT 1 FROM rewards r WHERE r.cycle_id=cy.id AND r.status='available') reward_available
    FROM cards ca JOIN customers c ON c.id=ca.customer_id
    JOIN cycles cy ON cy.customer_id=c.id AND cy.status!='redeemed'
    WHERE ca.qr_token=? AND ca.status='active' AND c.active=1`,token);
  return row ? {name:row.name,code:row.code,cycleNumber:row.cycle_number,punches:row.punch_count,rewardAvailable:!!row.reward_available} : null;
}
function audit(staff: string, customer: string | null, action: string, metadata = {}, reason: string | null = null) {
  run('INSERT INTO history(customer_id,staff_id,action,created_at,metadata,reason) VALUES (?,?,?,?,?,?)', customer, staff, action, now(), JSON.stringify(metadata), reason);
}
function admin(staff: StaffProfile) { if (staff.role !== 'super_admin') fail('FORBIDDEN'); }
function state(customer: string) {
  const cycle = one("SELECT * FROM cycles WHERE customer_id=? AND status!='redeemed'", customer);
  if (!cycle) fail('CUSTOMER_NOT_FOUND');
  const reward = one("SELECT * FROM rewards WHERE cycle_id=? AND status='available'", cycle.id);
  return { customer_id: customer, cycle_id: cycle.id, cycle_number: cycle.cycle_number, cycle_status: cycle.status,
    punch_count: one('SELECT count(*) n FROM punches WHERE cycle_id=? AND voided=0', cycle.id).n,
    reward_id: reward?.id ?? null, reward_status: reward ? 'available' : null };
}
function profile(customer: string) {
  const c = one('SELECT * FROM customers WHERE id=?', customer);
  if (!c) fail('CUSTOMER_NOT_FOUND');
  return { ...c, active: !!c.active, card: one("SELECT * FROM cards WHERE customer_id=? AND status!='replaced'", customer) ?? null,
    state: state(customer), reward_unlocked_at: one("SELECT unlocked_at FROM rewards WHERE customer_id=? AND status='available'", customer)?.unlocked_at ?? null,
    total_paid_hours: one('SELECT count(*) n FROM punches WHERE customer_id=? AND voided=0', customer).n,
    total_rewards_redeemed: one("SELECT count(*) n FROM rewards WHERE customer_id=? AND status='redeemed'", customer).n };
}
function issueCard(customer: string) {
  let code = '';
  do { code = Array.from({ length: 6 }, () => String.fromCharCode(65 + randomInt(26))).join(''); } while (one('SELECT id FROM cards WHERE code=?', code));
  run('INSERT INTO cards(id,customer_id,code,qr_token,created_at) VALUES (?,?,?,?,?)', randomUUID(), customer, code, randomBytes(24).toString('base64url'), now());
  return code;
}
const day = (date: string) => new Date(new Date(date).getTime() + 3 * 3600000).toISOString().slice(0, 10);
function checkedCustomer(id: string) {
  const c = profile(id);
  if (!c.active) fail('CUSTOMER_INACTIVE');
  if (c.card?.status !== 'active') fail('CARD_INACTIVE');
  return c;
}
function historyRows(where = '', params: SQLInputValue[] = [], limit = 500) {
  return all(`SELECT h.*, s.full_name staff_name, c.name customer_name, ca.code FROM history h LEFT JOIN staff s ON s.id=h.staff_id
    LEFT JOIN customers c ON c.id=h.customer_id LEFT JOIN cards ca ON ca.customer_id=c.id AND ca.status!='replaced'
    ${where} ORDER BY h.id DESC LIMIT ?`, ...params, limit).map(r => ({ ...r, metadata: JSON.parse(r.metadata) }));
}
function dashboard() {
  const today = day(now());
  const punches = all('SELECT created_at FROM punches WHERE voided=0');
  const rewards = all('SELECT * FROM rewards');
  const customers = all('SELECT created_at FROM customers');
  return { total_customers: customers.length, active_cards: one("SELECT count(*) n FROM cards ca JOIN customers c ON c.id=ca.customer_id WHERE ca.status='active' AND c.active=1").n,
    paid_hours_today: punches.filter(p => day(p.created_at) === today).length, total_paid_hours: punches.length,
    available_rewards: rewards.filter(r => r.status === 'available').length,
    redeemed_today: rewards.filter(r => r.redeemed_at && day(r.redeemed_at) === today).length,
    total_redeemed: rewards.filter(r => r.status === 'redeemed').length,
    new_customers_month: customers.filter(c => day(c.created_at).slice(0, 7) === today.slice(0, 7)).length };
}
function reports(days: number) {
  const punches = all('SELECT * FROM punches WHERE voided=0');
  const rewards = all('SELECT * FROM rewards');
  const customers = all('SELECT * FROM customers');
  const today = day(now());
  const daily = Array.from({length: days}, (_, i) => {
    const date = new Date(`${today}T00:00:00Z`); date.setUTCDate(date.getUTCDate() - days + i + 1);
    const d = date.toISOString().slice(0,10);
    return { day: d, paid_hours: punches.filter(p => day(p.created_at) === d).length,
      redeemed: rewards.filter(r => r.redeemed_at && day(r.redeemed_at) === d).length, new_customers: customers.filter(c => day(c.created_at) === d).length };
  });
  function period(start: string, end: string) { return {
    paid_hours: punches.filter(p => day(p.created_at) >= start && day(p.created_at) < end).length,
    redeemed: rewards.filter(r => r.redeemed_at && day(r.redeemed_at) >= start && day(r.redeemed_at) < end).length,
    new_customers: customers.filter(c => day(c.created_at) >= start && day(c.created_at) < end).length,
  }; }
  const weekly = Array.from({length: 8}, (_, i) => {
    const date = new Date(`${today}T00:00:00Z`); date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7 - (7-i)*7);
    const start = date.toISOString().slice(0,10); date.setUTCDate(date.getUTCDate()+7);
    return {week_start: start, ...period(start,date.toISOString().slice(0,10))};
  });
  const monthly = Array.from({length: 6}, (_, i) => {
    const date = new Date(`${today.slice(0,7)}-01T00:00:00Z`); date.setUTCMonth(date.getUTCMonth() - 5 + i);
    const start = date.toISOString().slice(0,10); date.setUTCMonth(date.getUTCMonth()+1);
    return {month_start: start, ...period(start,date.toISOString().slice(0,10))};
  });
  return { daily, weekly, monthly, top_customers: customers.map(c => ({id:c.id,name:c.name,code:profile(c.id).card?.code,
    paid_hours:punches.filter(p=>p.customer_id===c.id).length,redeemed:rewards.filter(r=>r.customer_id===c.id&&r.status==='redeemed').length})).filter(c=>c.paid_hours>0).sort((a,b)=>b.paid_hours-a.paid_hours).slice(0,20),
    totals: {earned: rewards.filter(r=>r.status!=='revoked').length,redeemed:rewards.filter(r=>r.status==='redeemed').length,outstanding:rewards.filter(r=>r.status==='available').length} };
}

/** Every call rechecks the staff account; all writes and retry records commit together. */
export function localRpc(fn: string, a: Record<string, any>, staffId: string): any {
  return atomic(() => {
    const row = one('SELECT * FROM staff WHERE id=? AND active=1', staffId);
    if (!row) fail('NOT_AUTHENTICATED');
    const staff = publicStaff(row);
    const cid = a.p_customer_id as string;
    const adminCalls = ['get_dashboard_stats','get_recent_activity','get_reports','set_customer_active','void_last_punch','set_card_status','reissue_card','admin_create_staff','admin_update_staff','update_setting','reset_staff_password'];
    if (adminCalls.includes(fn)) admin(staff);
    const keyed = ['register_customer','add_paid_hour','redeem_reward'].includes(fn);
    if (keyed) {
      if (!/^[0-9a-f-]{36}$/i.test(a.p_idempotency_key ?? '')) fail('IDEMPOTENCY_KEY_REQUIRED');
      const prev = one('SELECT * FROM requests WHERE key=?', a.p_idempotency_key);
      if (prev) {
        if (prev.operation !== fn || prev.customer_id !== (cid ?? null) || prev.staff_id !== staff.id) fail('IDEMPOTENCY_KEY_REUSED');
        return { ...JSON.parse(prev.result), duplicate: true };
      }
    }
    const execute = (): any => {
      switch (fn) {
        case 'get_my_profile': return staff;
        case 'get_customer_profile': return profile(cid);
        case 'register_customer': {
          const id = randomUUID();
          run('INSERT INTO customers(id,name,phone,notes,created_at) VALUES (?,?,?,?,?)', id, a.p_name, a.p_phone ?? null, a.p_notes ?? null, now());
          run('INSERT INTO cycles(id,customer_id,cycle_number) VALUES (?,?,1)', randomUUID(), id);
          const code = issueCard(id); audit(staff.id,id,'customer.registered',{code});
          return { customer_id:id,code };
        }
        case 'add_paid_hour': {
          const c = checkedCustomer(cid); const s = c.state;
          if (s.reward_id || s.punch_count >= 3) fail('REWARD_PENDING');
          const n = s.punch_count+1;
          run('INSERT INTO punches VALUES (?,?,?,?,?,?,0,?,?)', randomUUID(),cid,s.cycle_id,n,staff.id,now(),a.p_receipt_reference??null,a.p_notes??null);
          run('UPDATE customers SET last_visit_at=? WHERE id=?',now(),cid);
          audit(staff.id,cid,'punch.added',{punch_number:n,cycle_number:s.cycle_number,receipt_reference:a.p_receipt_reference,notes:a.p_notes});
          if (n === 3) {
            run("UPDATE cycles SET status='completed' WHERE id=?",s.cycle_id);
            const reward = one('SELECT id FROM rewards WHERE cycle_id=?',s.cycle_id);
            if (reward) run("UPDATE rewards SET status='available',unlocked_at=? WHERE id=?",now(),reward.id);
            else run("INSERT INTO rewards(id,customer_id,cycle_id,status,unlocked_at) VALUES (?,?,?,'available',?)",randomUUID(),cid,s.cycle_id,now());
            audit(staff.id,cid,'reward.unlocked',{cycle_number:s.cycle_number});
          }
          return {...state(cid),duplicate:false,punch_number:n,reward_unlocked:n===3};
        }
        case 'redeem_reward': {
          const s = checkedCustomer(cid).state;
          if (!s.reward_id) fail('NO_REWARD_AVAILABLE');
          run("UPDATE rewards SET status='redeemed',redeemed_at=?,staff_id=? WHERE id=?",now(),staff.id,s.reward_id);
          run("UPDATE cycles SET status='redeemed' WHERE id=?",s.cycle_id);
          run('INSERT INTO cycles(id,customer_id,cycle_number) VALUES (?,?,?)',randomUUID(),cid,s.cycle_number+1);
          audit(staff.id,cid,'reward.redeemed',{cycle_number:s.cycle_number,new_cycle_number:s.cycle_number+1});
          return {...state(cid),duplicate:false};
        }
        case 'void_last_punch': {
          const s = state(cid); if (!s.punch_count) fail('NOTHING_TO_VOID');
          const p = one('SELECT id FROM punches WHERE cycle_id=? AND voided=0 ORDER BY slot DESC LIMIT 1',s.cycle_id);
          run('UPDATE punches SET voided=1 WHERE id=?',p.id);
          run("UPDATE rewards SET status='revoked' WHERE cycle_id=? AND status='available'",s.cycle_id);
          run("UPDATE cycles SET status='active' WHERE id=?",s.cycle_id);
          audit(staff.id,cid,'punch.voided',{progress:s.punch_count-1,cycle_number:s.cycle_number,reward_revoked:!!s.reward_id},a.p_reason);
          return null;
        }
        case 'update_customer': profile(cid); run('UPDATE customers SET name=?,phone=?,notes=? WHERE id=?',a.p_name,a.p_phone??null,a.p_notes??null,cid); audit(staff.id,cid,'customer.updated'); return null;
        case 'set_customer_active': profile(cid); run('UPDATE customers SET active=? WHERE id=?',a.p_active?1:0,cid); audit(staff.id,cid,`customer.${a.p_active?'reactivated':'deactivated'}`,{},a.p_reason); return null;
        case 'set_card_status': {
          profile(cid); run("UPDATE cards SET status=?,status_reason=? WHERE customer_id=? AND status!='replaced'",a.p_active?'active':'deactivated',a.p_reason,cid);
          audit(staff.id,cid,`card.${a.p_active?'reactivated':'deactivated'}`,{},a.p_reason); return null;
        }
        case 'reissue_card': {
          const c = profile(cid); run("UPDATE cards SET status='replaced',status_reason=? WHERE customer_id=? AND status!='replaced'",a.p_reason,cid);
          const code = issueCard(cid); audit(staff.id,cid,'card.reissued',{old_code:c.card?.code,code},a.p_reason); return {code};
        }
        case 'find_customer_by_code': case 'find_customer_by_qr': {
          const bucket = `lookup:${staff.id}`; const settings = readSettings();
          if (one('SELECT count(*) n FROM attempts WHERE bucket=? AND at>?',bucket,Date.now()-60000).n >= (settings.lookup_limit_per_minute??20)
            || one('SELECT count(*) n FROM attempts WHERE bucket=? AND at>? AND failed=1',bucket,Date.now()-600000).n >= (settings.lookup_failures_per_10min??15)) return {error:'RATE_LIMITED'};
          const card = fn==='find_customer_by_code' ? one('SELECT * FROM cards WHERE code=?',String(a.p_code).trim().toUpperCase()) : one('SELECT * FROM cards WHERE qr_token=?',a.p_token);
          const error = !card ? 'CUSTOMER_NOT_FOUND' : card.status==='replaced' ? 'CARD_REPLACED' : !one('SELECT active FROM customers WHERE id=?',card.customer_id).active ? 'CUSTOMER_INACTIVE' : null;
          run('INSERT INTO attempts(bucket,at,failed) VALUES (?,?,?)',bucket,Date.now(),error?1:0);
          return error?{error}:{customer_id:card.customer_id,card_status:card.status};
        }
        case 'find_possible_duplicates': return all('SELECT * FROM customers WHERE lower(name)=lower(?) OR (phone IS NOT NULL AND phone=?)',a.p_name,a.p_phone??null).map(c=>({...c,code:profile(c.id).card?.code}));
        case 'search_customers': {
          let rows = all('SELECT * FROM customers').map(c => {const p=profile(c.id);return {...c,active:!!c.active,code:p.card?.code,card_status:p.card?.status,punch_count:p.state.punch_count,cycle_status:p.state.cycle_status};});
          const q = String(a.p_query??'').toLowerCase();
          rows=rows.filter(c => (!q || [c.name,c.phone,c.code].some(v=>v?.toLowerCase().includes(q))) && (!a.p_registered_from || day(c.created_at)>=a.p_registered_from) && (!a.p_registered_to || day(c.created_at)<=a.p_registered_to) && (a.p_reward!=='available'||c.cycle_status==='completed') && (a.p_reward!=='none'||c.cycle_status!=='completed'));
          rows.sort((a1,b) => a.p_sort==='name'?a1.name.localeCompare(b.name):String(a.p_sort==='newest'?b.created_at:b.last_visit_at??b.created_at).localeCompare(String(a.p_sort==='newest'?a1.created_at:a1.last_visit_at??a1.created_at)));
          const total=rows.length; return rows.slice(a.p_offset??0,(a.p_offset??0)+(a.p_limit??25)).map(c=>({...c,total_count:total}));
        }
        case 'get_customer_history': profile(cid); return historyRows('WHERE h.customer_id=?',[cid],a.p_limit??500);
        case 'get_recent_activity': return historyRows('WHERE h.customer_id IS NOT NULL',[],a.p_limit??12);
        case 'get_dashboard_stats': return dashboard();
        case 'get_reports': return reports(Math.max(1,Math.min(90,Number(a.p_days)||30)));
        case 'list_rewards': return all('SELECT r.*, c.name customer_name, ca.code, s.full_name staff_name FROM rewards r JOIN customers c ON c.id=r.customer_id LEFT JOIN cards ca ON ca.customer_id=c.id AND ca.status!=? LEFT JOIN staff s ON s.id=r.staff_id WHERE r.status=? ORDER BY coalesce(r.redeemed_at,r.unlocked_at) DESC LIMIT ?', 'replaced',a.p_status,a.p_limit??200).map(r=>({...r,reward_id:r.id}));
        case 'admin_create_staff': {
          if (one('SELECT id FROM staff WHERE email=? COLLATE NOCASE',a.p_email)) fail('EMAIL_EXISTS');
          run('INSERT INTO staff VALUES (?,?,?,?,?,?,?)',randomUUID(),a.p_full_name,a.p_email,passwordHash(a.p_password),a.p_role,1,now());
          audit(staff.id,null,'staff.created',{name:a.p_full_name,role:a.p_role}); return null;
        }
        case 'admin_update_staff': {
          const target=one('SELECT * FROM staff WHERE id=?',a.p_staff_id); if (!target) fail('STAFF_NOT_FOUND');
          if (target.id===staff.id && (!a.p_active || a.p_role!=='super_admin')) fail('CANNOT_DEMOTE_SELF');
          if (target.role==='super_admin' && target.active && (!a.p_active || a.p_role!=='super_admin') && one("SELECT count(*) n FROM staff WHERE role='super_admin' AND active=1").n<=1) fail('LAST_ADMIN');
          run('UPDATE staff SET full_name=?,role=?,active=? WHERE id=?',a.p_full_name,a.p_role,a.p_active?1:0,target.id);
          if (!a.p_active || a.p_role!==target.role) run('DELETE FROM sessions WHERE staff_id=?',target.id);
          audit(staff.id,null,'staff.updated',{staff_id:target.id,role:a.p_role,active:a.p_active}); return null;
        }
        case 'reset_staff_password': {
          if (!one('SELECT id FROM staff WHERE id=?',a.p_staff_id)) fail('STAFF_NOT_FOUND');
          run('UPDATE staff SET password_hash=? WHERE id=?',passwordHash(a.p_password),a.p_staff_id); run('DELETE FROM sessions WHERE staff_id=?',a.p_staff_id);
          audit(staff.id,null,'staff.password_reset',{staff_id:a.p_staff_id}); return null;
        }
        case 'update_setting': run('INSERT INTO settings VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',a.p_key,JSON.stringify(a.p_value)); audit(staff.id,null,'settings.updated',{key:a.p_key,value:a.p_value}); return null;
        default: throw new Error(`Unknown local operation: ${fn}`);
      }
    };
    const result=execute();
    if (keyed) run('INSERT INTO requests VALUES (?,?,?,?,?)',a.p_idempotency_key,fn,cid??null,staff.id,JSON.stringify(result));
    return result;
  });
}

export function changeOwnPassword(staffId: string, current: string, password: string) {
  return atomic(() => {
    const staff=one('SELECT * FROM staff WHERE id=? AND active=1',staffId);
    if (!staff || !passwordMatches(current,staff.password_hash)) return false;
    run('UPDATE staff SET password_hash=? WHERE id=?',passwordHash(password),staffId);
    run('DELETE FROM sessions WHERE staff_id=?',staffId); audit(staffId,null,'staff.password_changed'); return true;
  });
}
