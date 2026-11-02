-- =====================================================================
-- Database test-suite (numbers refer to the project's testing checklist)
-- Runs as the real `authenticated` role with a simulated JWT subject.
-- =====================================================================
\set ON_ERROR_STOP 1
set client_min_messages = warning;
\pset tuples_only on
\o /dev/null

create schema t;
grant usage on schema t to authenticated, anon;

-- expect_error(sql, expected_message_fragment)
create function t.expect_error(p_sql text, p_expected text) returns void
language plpgsql as $$
begin
  execute p_sql;
  raise exception 'TEST FAILED: expected error % from: %', p_expected, p_sql;
exception when others then
  if sqlerrm like 'TEST FAILED%' then raise; end if;
  if position(p_expected in sqlerrm) = 0 then
    raise exception 'TEST FAILED: expected % but got % (from %)', p_expected, sqlerrm, p_sql;
  end if;
end $$;
grant execute on function t.expect_error(text, text) to authenticated, anon;

create table t.ids (k text primary key, v text);
grant select, insert on t.ids to authenticated;

-- Fixtures: one admin, two cashiers, one inactive cashier
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@gzx.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'cashier1@gzx.test'),
  ('00000000-0000-0000-0000-0000000000c2', 'cashier2@gzx.test'),
  ('00000000-0000-0000-0000-0000000000c3', 'former@gzx.test'),
  ('00000000-0000-0000-0000-0000000000ff', 'stranger@gzx.test');
select public.bootstrap_first_admin('admin@gzx.test', 'Owner Admin');
insert into public.staff_profiles (auth_user_id, full_name, role, active) values
  ('00000000-0000-0000-0000-0000000000c1', 'Cashier One', 'cashier', true),
  ('00000000-0000-0000-0000-0000000000c2', 'Cashier Two', 'cashier', true),
  ('00000000-0000-0000-0000-0000000000c3', 'Former Cashier', 'cashier', false);

\echo '--- bootstrap_first_admin cannot run twice'
select t.expect_error($$select public.bootstrap_first_admin('cashier1@gzx.test','X')$$, 'already exists');

-- ===================== anonymous visitor =====================
\echo '--- 21/16. anonymous visitors cannot read or call anything'
set role anon;
select t.expect_error('select * from public.customers', 'permission denied');
select t.expect_error($$select public.find_customer_by_code('ABCDEF')$$, 'permission denied');
select t.expect_error($$select public.register_customer('Hacker')$$, 'permission denied');
reset role;

-- authenticated but NOT staff
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ff', false);
select t.expect_error($$select public.register_customer('Hacker')$$, 'FORBIDDEN');
do $$ begin
  assert (select count(*) from public.customers) = 0, 'non-staff must see no customers';
end $$;
-- inactive staff member
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c3', false);
select t.expect_error($$select public.find_customer_by_code('ABCDEF')$$, 'FORBIDDEN');

-- ===================== cashier flow =====================
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);

\echo '--- 1/2. register customer -> unique 6-letter code, QR token, cycle 1 at 0/3'
do $$
declare r jsonb; p jsonb;
begin
  r := public.register_customer('  Ahmed   Ali ', '+964 770 123 4567', 'Likes FIFA', '11111111-1111-1111-1111-111111111111');
  assert (r->>'code') ~ '^[A-Z]{6}$', 'code must be 6 uppercase letters';
  assert (r->>'duplicate')::boolean = false;
  insert into t.ids values ('ahmed', r->>'customer_id'), ('ahmed_code', r->>'code');
  p := public.get_customer_profile((r->>'customer_id')::uuid);
  assert p->>'name' = 'Ahmed Ali', 'name is normalized';
  assert (p->'card'->>'qr_token') ~ '^[A-Za-z0-9_-]{32}$', 'qr token is opaque 32 chars';
  assert position('Ahmed' in p->'card'->>'qr_token') = 0;
  assert (p->'state'->>'punch_count')::int = 0 and p->'state'->>'cycle_status' = 'active';
  assert (p->'state'->>'cycle_number')::int = 1;
end $$;

\echo '--- registration is idempotent (double submit)'
do $$
declare r jsonb;
begin
  r := public.register_customer('Ahmed Ali', null, null, '11111111-1111-1111-1111-111111111111');
  assert (r->>'duplicate')::boolean, 'same key returns duplicate';
  assert r->>'customer_id' = (select v from t.ids where k = 'ahmed');
  assert (select count(*) from public.customers) = 1;
end $$;

\echo '--- registration validation'
select t.expect_error($$select public.register_customer('   ')$$, 'INVALID_NAME');
select t.expect_error($$select public.register_customer('Bob', 'call me!')$$, 'INVALID_PHONE');

\echo '--- duplicate detection shows matches (no auto-merge)'
do $$ begin
  assert (select count(*) from public.find_possible_duplicates('ahmed ali', null)) = 1;
  assert (select count(*) from public.find_possible_duplicates('zzz', '07701234567')) = 0;
  assert (select count(*) from public.find_possible_duplicates('zzz', '+9647701234567')) = 1;
end $$;

\echo '--- 6/7/8. manual lookup: exact, lowercase, invalid, unknown'
do $$
declare code text := (select v from t.ids where k = 'ahmed_code'); r jsonb;
begin
  r := public.find_customer_by_code(code);
  assert r->>'customer_id' = (select v from t.ids where k = 'ahmed'), 'exact code';
  r := public.find_customer_by_code(lower(code));
  assert r->>'customer_id' = (select v from t.ids where k = 'ahmed'), 'lowercase code';
  r := public.find_customer_by_code(' ' || lower(code) || ' ');
  assert r->>'customer_id' is not null, 'surrounding spaces trimmed';
  assert public.find_customer_by_code('ABC12F')->>'error' = 'INVALID_CODE';
  assert public.find_customer_by_code('ABCDE')->>'error' = 'INVALID_CODE';
  assert public.find_customer_by_code('ABC DEF')->>'error' = 'INVALID_CODE';
  -- an unused code (choose one guaranteed different)
  assert public.find_customer_by_code(case when code = 'QQQQQQ' then 'WWWWWW' else 'QQQQQQ' end)->>'error' = 'CUSTOMER_NOT_FOUND';
end $$;

\echo '--- 5. QR lookup opens the same customer; scanning never punches'
do $$
declare tok text; r jsonb;
begin
  tok := (public.get_customer_profile((select v::uuid from t.ids where k='ahmed'))->'card'->>'qr_token');
  r := public.find_customer_by_qr(tok);
  assert r->>'customer_id' = (select v from t.ids where k = 'ahmed');
  assert public.find_customer_by_qr('not-a-token')->>'error' = 'INVALID_QR';
  assert public.find_customer_by_qr(repeat('A', 32))->>'error' = 'CUSTOMER_NOT_FOUND';
  assert (select count(*) from public.punch_transactions) = 0, 'lookups never create punches';
end $$;

\echo '--- 10/11/12/13. three paid hours -> exactly one reward'
do $$
declare cid uuid := (select v::uuid from t.ids where k='ahmed'); r jsonb;
begin
  r := public.add_paid_hour(cid, 'a0000000-0000-0000-0000-000000000001', 'RCPT-1');
  assert (r->>'punch_count')::int = 1 and not (r->>'reward_unlocked')::boolean;
  r := public.add_paid_hour(cid, 'a0000000-0000-0000-0000-000000000002');
  assert (r->>'punch_count')::int = 2;
  r := public.add_paid_hour(cid, 'a0000000-0000-0000-0000-000000000003');
  assert (r->>'punch_count')::int = 3 and (r->>'reward_unlocked')::boolean;
  assert r->>'cycle_status' = 'completed' and r->>'reward_status' = 'available';
  assert (select count(*) from public.rewards where customer_id = cid) = 1, 'exactly one reward';
end $$;

\echo '--- 19. duplicate punch submission (same idempotency key) is a no-op'
do $$
declare cid uuid := (select v::uuid from t.ids where k='ahmed'); r jsonb;
begin
  r := public.add_paid_hour(cid, 'a0000000-0000-0000-0000-000000000003');
  assert (r->>'duplicate')::boolean;
  assert (select count(*) from public.punch_transactions where customer_id = cid) = 3;
end $$;

\echo '--- 14. fourth paid punch in the same cycle is rejected; reward stays'
select t.expect_error(format($$select public.add_paid_hour(%L, 'a0000000-0000-0000-0000-000000000004')$$,
  (select v from t.ids where k='ahmed')), 'REWARD_PENDING');
do $$ begin
  assert (select count(*) from public.rewards where status = 'available') = 1;
end $$;

\echo '--- cashier cannot change history or settings directly'
select t.expect_error($$update public.punch_transactions set punch_number = 1$$, 'permission denied');
select t.expect_error($$delete from public.audit_logs$$, 'permission denied');
select t.expect_error($$insert into public.punch_transactions (customer_id) values (gen_random_uuid())$$, 'permission denied');
select t.expect_error($$update public.loyalty_cycles set punch_count = 0$$, 'permission denied');

\echo '--- 21. cashier cannot use admin operations'
select t.expect_error(format($$select public.void_last_punch(%L, 'oops')$$, (select v from t.ids where k='ahmed')), 'FORBIDDEN');
select t.expect_error(format($$select public.reissue_card(%L, 'lost card')$$, (select v from t.ids where k='ahmed')), 'FORBIDDEN');
select t.expect_error(format($$select public.set_card_status(%L, false, 'lost card')$$, (select v from t.ids where k='ahmed')), 'FORBIDDEN');
select t.expect_error($$select public.update_setting('lounge_name', '"X"')$$, 'FORBIDDEN');
select t.expect_error($$select public.get_dashboard_stats()$$, 'FORBIDDEN');
select t.expect_error($$select public.admin_update_staff(gen_random_uuid(), 'x', 'cashier', true)$$, 'FORBIDDEN');
do $$ begin
  assert (select count(*) from public.staff_profiles) = 1, 'cashier only sees own staff row';
  assert (select count(*) from public.lookup_attempts) = 0, 'cashier cannot read lookup attempts';
end $$;

\echo '--- 15/16/18. redeem -> new cycle 0/3; second redemption rejected'
do $$
declare cid uuid := (select v::uuid from t.ids where k='ahmed'); r jsonb;
begin
  r := public.redeem_reward(cid, 'b0000000-0000-0000-0000-000000000001');
  assert (r->>'cycle_number')::int = 2 and (r->>'punch_count')::int = 0 and r->>'cycle_status' = 'active';
  assert r->>'reward_id' is null;
  -- retry with the same key is harmless
  r := public.redeem_reward(cid, 'b0000000-0000-0000-0000-000000000001');
  assert (r->>'duplicate')::boolean;
  assert (select count(*) from public.reward_redemptions) = 1;
  assert (select status from public.rewards where customer_id = cid) = 'redeemed';
end $$;
select t.expect_error(format($$select public.redeem_reward(%L, 'b0000000-0000-0000-0000-000000000002')$$,
  (select v from t.ids where k='ahmed')), 'NO_REWARD_AVAILABLE');

\echo '--- 9/17. return later: progress persists, past activity preserved'
do $$
declare cid uuid := (select v::uuid from t.ids where k='ahmed'); r jsonb; n int;
begin
  r := public.add_paid_hour(cid, 'a0000000-0000-0000-0000-000000000005');
  assert (r->>'punch_count')::int = 1 and (r->>'cycle_number')::int = 2;
  select count(*) into n from public.get_customer_history(cid);
  -- registered + 3 punches + unlocked + redeemed + 1 punch
  assert n = 7, format('history has %s rows', n);
  assert (select count(*) from public.loyalty_cycles where customer_id = cid) = 2;
  assert (public.get_customer_profile(cid)->>'total_paid_hours')::int = 4;
  assert (public.get_customer_profile(cid)->>'total_rewards_redeemed')::int = 1;
end $$;

\echo '--- search: by name, code (lowercase), phone, reward filter'
do $$
declare code text := (select v from t.ids where k = 'ahmed_code');
begin
  assert (select count(*) from public.search_customers('ahm')) = 1;
  assert (select count(*) from public.search_customers(lower(code))) = 1;
  assert (select count(*) from public.search_customers('770 123')) = 1;
  assert (select count(*) from public.search_customers('100%')) = 0, 'wildcards are escaped';
  assert (select count(*) from public.search_customers(null, 'available')) = 0;
  assert (select total_count from public.search_customers(null, 'all') limit 1) = 1;
end $$;
reset role;

-- ===================== admin flow =====================
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);

\echo '--- admin correction: void last punch requires a reason and is audited'
select t.expect_error(format($$select public.void_last_punch(%L, '')$$, (select v from t.ids where k='ahmed')), 'REASON_REQUIRED');
do $$
declare cid uuid := (select v::uuid from t.ids where k='ahmed'); r jsonb;
begin
  r := public.void_last_punch(cid, 'Punched by mistake');
  assert (r->>'punch_count')::int = 0;
  assert (select count(*) from public.punch_transactions where customer_id = cid and voided_at is not null) = 1;
  assert (select reason from public.audit_logs where action = 'punch.voided') = 'Punched by mistake';
end $$;

\echo '--- voiding the 3rd punch revokes the pending reward; re-punch restores it'
do $$
declare cid uuid := (select v::uuid from t.ids where k='ahmed'); r jsonb;
begin
  perform public.add_paid_hour(cid, 'a0000000-0000-0000-0000-000000000006');
  perform public.add_paid_hour(cid, 'a0000000-0000-0000-0000-000000000007');
  r := public.add_paid_hour(cid, 'a0000000-0000-0000-0000-000000000008');
  assert r->>'reward_status' = 'available';
  r := public.void_last_punch(cid, 'Wrong customer');
  assert (r->>'punch_count')::int = 2 and r->>'cycle_status' = 'active' and r->>'reward_id' is null;
  r := public.add_paid_hour(cid, 'a0000000-0000-0000-0000-000000000009');
  assert r->>'reward_status' = 'available' and (r->>'punch_count')::int = 3;
  assert (select count(*) from public.rewards where customer_id = cid) = 2, 'one reward row per cycle';
end $$;

\echo '--- 3. rare code collision is retried'
reset role;
-- make the generator collide twice, then fall back to the real one
create sequence t.collisions;  -- sequences are not rolled back by the retry's subtransaction
grant select on sequence t.collisions to authenticated;
alter function public.generate_customer_code() rename to generate_customer_code_real;
create function public.generate_customer_code() returns text language plpgsql volatile as $$
declare v int;
begin
  v := nextval('t.collisions');
  if v <= 2 then return (select unique_code from public.loyalty_cards order by created_at limit 1); end if;
  return public.generate_customer_code_real();
end $$;
set role authenticated;
do $$
declare r jsonb;
begin
  r := public.register_customer('Sara', null, null, null);
  assert (r->>'code') ~ '^[A-Z]{6}$';
  assert r->>'code' <> (select v from t.ids where k = 'ahmed_code');
  assert (select last_value from t.collisions) = 3, 'two collisions then success';
  insert into t.ids values ('sara', r->>'customer_id');
end $$;
reset role;
drop function public.generate_customer_code();
alter function public.generate_customer_code_real() rename to generate_customer_code;
set role authenticated;

\echo '--- card deactivate / reactivate / reissue'
do $$
declare cid uuid := (select v::uuid from t.ids where k='sara'); old_code text; r jsonb;
begin
  old_code := public.get_customer_profile(cid)->'card'->>'code';
  perform public.set_card_status(cid, false, 'Card lost');
  assert public.find_customer_by_code(old_code)->>'card_status' = 'deactivated';
  begin
    perform public.add_paid_hour(cid, 'c0000000-0000-0000-0000-000000000001');
    assert false, 'punch on deactivated card must fail';
  exception when others then assert sqlerrm = 'CARD_INACTIVE', sqlerrm; end;
  perform public.set_card_status(cid, true, 'Found it');
  perform public.add_paid_hour(cid, 'c0000000-0000-0000-0000-000000000002');
  r := public.reissue_card(cid, 'Card stolen');
  assert r->>'code' <> old_code;
  assert public.find_customer_by_code(old_code)->>'error' = 'CARD_REPLACED', 'old code no longer opens profile';
  assert public.find_customer_by_code(r->>'code')->>'customer_id' = cid::text;
  assert (public.get_customer_profile(cid)->'state'->>'punch_count')::int = 1, 'progress carries over';
end $$;

\echo '--- 12. dashboard statistics and reports'
do $$
declare s jsonb; rep jsonb;
begin
  s := public.get_dashboard_stats();
  assert (s->>'total_customers')::int = 2;
  assert (s->>'active_cards')::int = 2;
  assert (s->>'total_paid_hours')::int = 7, s::text;   -- 9 punches - 2 voided
  assert (s->>'paid_hours_today')::int = 7;
  assert (s->>'available_rewards')::int = 1;
  assert (s->>'redeemed_today')::int = 1 and (s->>'total_redeemed')::int = 1;
  assert (s->>'new_customers_month')::int = 2;
  rep := public.get_reports(30);
  assert jsonb_array_length(rep->'daily') = 30;
  assert jsonb_array_length(rep->'weekly') = 8;
  assert jsonb_array_length(rep->'monthly') = 6;
  assert (rep->'totals'->>'outstanding')::int = 1;
  assert (rep->'top_customers'->0->>'name') = 'Ahmed Ali';
  assert (select count(*) from public.get_recent_activity(50)) > 5;
end $$;

\echo '--- settings validation'
select t.expect_error($$select public.update_setting('lookup_limit_per_minute', '"abc"')$$, 'INVALID_SETTING');
select t.expect_error($$select public.update_setting('unknown_key', '1')$$, 'INVALID_SETTING');
select public.update_setting('lookup_limit_per_minute', '30');

\echo '--- staff: cannot demote self, cannot remove last admin'
select t.expect_error($$select public.admin_update_staff(public.current_staff_id(), 'Owner', 'cashier', true)$$, 'CANNOT_DEMOTE_SELF');
do $$
declare c2 uuid := (select id from public.staff_profiles where full_name = 'Cashier Two');
begin
  perform public.admin_update_staff(c2, 'Cashier Two', 'cashier', true);
  assert (select count(*) from public.staff_profiles) = 4, 'admin sees all staff';
end $$;

\echo '--- 22. lookup rate limiting (failures per 10 min)'
select public.update_setting('lookup_failures_per_10min', '5');
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', false);
do $$
declare i int; code text := (select v from t.ids where k = 'ahmed_code');
begin
  for i in 1..5 loop
    assert public.find_customer_by_code('ZZZZZZ')->>'error' in ('CUSTOMER_NOT_FOUND');
  end loop;
  assert public.find_customer_by_code(code)->>'error' = 'RATE_LIMITED', 'blocked after 5 failures';
  assert public.find_customer_by_qr(repeat('B', 32))->>'error' = 'RATE_LIMITED';
end $$;
reset role;

\echo '--- history and transactions are immutable even for the database owner'
select t.expect_error($$delete from public.audit_logs$$, 'IMMUTABLE');
select t.expect_error($$delete from public.punch_transactions$$, 'IMMUTABLE');
select t.expect_error($$update public.punch_transactions set punch_number = 2 where punch_number = 1$$, 'IMMUTABLE');
select t.expect_error($$delete from public.customers$$, 'IMMUTABLE');

\echo '--- constraints: max one valid punch per slot, one open cycle, one reward per cycle'
select t.expect_error($$insert into public.loyalty_cycles (customer_id, card_id, cycle_number)
  select customer_id, card_id, 99 from public.loyalty_cycles where status = 'active' limit 1$$, 'loyalty_cycles_one_open_per_customer');
select t.expect_error($$insert into public.loyalty_cards (customer_id, unique_code, qr_token)
  values ((select id from public.customers limit 1), 'abcdef', repeat('x', 32))$$, 'loyalty_cards_unique_code_check');
select t.expect_error($$insert into public.rewards (customer_id, cycle_id)
  select customer_id, cycle_id from public.rewards limit 1$$, 'rewards_cycle_id_key');

\echo 'SQL TESTS PASSED'
