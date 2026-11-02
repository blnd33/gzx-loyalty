-- =====================================================================
-- GZX Gaming Loyalty System — business logic
-- Every write goes through a SECURITY DEFINER function that:
--   1. verifies the caller is an active staff member (and admin where needed)
--   2. locks the customer row (serializes concurrent cashier actions)
--   3. is idempotent (client-generated idempotency key)
--   4. writes an audit log entry
-- Errors are raised with a stable machine-readable message (e.g. REWARD_PENDING)
-- that the app maps to friendly text.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Identity helpers
-- ---------------------------------------------------------------------
create or replace function public.current_staff_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.staff_profiles where auth_user_id = auth.uid() and active
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff_profiles where auth_user_id = auth.uid() and active)
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.staff_profiles
    where auth_user_id = auth.uid() and active and role = 'super_admin'
  )
$$;

create or replace function public.require_staff(p_admin boolean default false)
returns public.staff_profiles
language plpgsql stable security definer set search_path = public as $$
declare s public.staff_profiles;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  select * into s from public.staff_profiles where auth_user_id = auth.uid() and active;
  if not found then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if p_admin and s.role <> 'super_admin' then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  return s;
end $$;

-- Current signed-in staff member (for the app shell)
create or replace function public.get_my_profile() returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(s) - 'auth_user_id'
  from public.staff_profiles s where s.auth_user_id = auth.uid() and s.active
$$;

-- ---------------------------------------------------------------------
-- Secure identifiers
-- ---------------------------------------------------------------------
-- Six uppercase letters from a CSPRNG. Rejection sampling (bytes >= 234
-- are discarded, 234 = 9 * 26) removes modulo bias.
create or replace function public.generate_customer_code() returns text
language plpgsql volatile set search_path = public, extensions as $$
declare
  b bytea;
  v int;
  code text := '';
begin
  while char_length(code) < 6 loop
    b := extensions.gen_random_bytes(16);
    for i in 0..15 loop
      v := get_byte(b, i);
      if v < 234 then
        code := code || chr(65 + (v % 26));
        exit when char_length(code) = 6;
      end if;
    end loop;
  end loop;
  return code;
end $$;

-- 192 random bits, URL-safe base64 (32 chars). Contains no personal data.
create or replace function public.generate_qr_token() returns text
language sql volatile set search_path = public, extensions as $$
  select translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', '-_')
$$;

-- Insert a card with a fresh code, retrying on the (rare) collision.
create or replace function public.issue_card(p_customer_id uuid)
returns public.loyalty_cards
language plpgsql volatile security definer set search_path = public as $$
declare
  card public.loyalty_cards;
  attempt int := 0;
begin
  loop
    attempt := attempt + 1;
    begin
      insert into public.loyalty_cards (customer_id, unique_code, qr_token)
      values (p_customer_id, public.generate_customer_code(), public.generate_qr_token())
      returning * into card;
      return card;
    exception when unique_violation then
      if attempt >= 25 then
        raise exception 'CODE_GENERATION_FAILED' using errcode = 'P0001';
      end if;
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Loyalty state snapshot (never trusts client counts)
-- ---------------------------------------------------------------------
create or replace function public.customer_state(p_customer_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'customer_id', p_customer_id,
    'cycle_id', cy.id,
    'cycle_number', cy.cycle_number,
    'cycle_status', cy.status,
    'punch_count', cy.punch_count,
    'reward_id', r.id,
    'reward_status', r.status
  )
  from public.loyalty_cycles cy
  left join public.rewards r on r.cycle_id = cy.id and r.status = 'available'
  where cy.customer_id = p_customer_id and cy.status in ('active', 'completed')
$$;

-- ---------------------------------------------------------------------
-- 1-3. Register customer (code + QR token + first cycle)
-- ---------------------------------------------------------------------
create or replace function public.register_customer(
  p_name text,
  p_phone text default null,
  p_notes text default null,
  p_idempotency_key uuid default null
) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  s public.staff_profiles;
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_customer_id uuid;
  card public.loyalty_cards;
begin
  s := public.require_staff(false);

  if p_idempotency_key is not null then
    select id into v_customer_id from public.customers where idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object('customer_id', v_customer_id, 'duplicate', true,
        'code', (select unique_code from public.loyalty_cards
                 where customer_id = v_customer_id and status <> 'replaced'));
    end if;
  end if;

  if char_length(v_name) not between 1 and 100 then
    raise exception 'INVALID_NAME' using errcode = 'P0001';
  end if;
  if v_phone is not null and v_phone !~ '^\+?[0-9 ()-]{4,24}$' then
    raise exception 'INVALID_PHONE' using errcode = 'P0001';
  end if;
  if v_notes is not null and char_length(v_notes) > 1000 then
    raise exception 'INVALID_NOTES' using errcode = 'P0001';
  end if;

  begin
    insert into public.customers (name, phone, notes, created_by, idempotency_key)
    values (v_name, v_phone, v_notes, s.id, p_idempotency_key)
    returning id into v_customer_id;
  exception when unique_violation then
    -- same idempotency key submitted concurrently: return the winner
    select id into v_customer_id from public.customers where idempotency_key = p_idempotency_key;
    return jsonb_build_object('customer_id', v_customer_id, 'duplicate', true,
      'code', (select unique_code from public.loyalty_cards
               where customer_id = v_customer_id and status <> 'replaced'));
  end;

  card := public.issue_card(v_customer_id);

  insert into public.loyalty_cycles (customer_id, card_id, cycle_number)
  values (v_customer_id, card.id, 1);

  insert into public.audit_logs (actor_id, customer_id, action, metadata)
  values (s.id, v_customer_id, 'customer.registered',
          jsonb_build_object('code', card.unique_code, 'progress', 0));

  return jsonb_build_object('customer_id', v_customer_id, 'code', card.unique_code, 'duplicate', false);
end $$;

-- Possible duplicates shown before registering (never auto-merged)
create or replace function public.find_possible_duplicates(p_name text, p_phone text default null)
returns table (id uuid, name text, phone text, code text, created_at timestamptz)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
begin
  perform public.require_staff(false);
  if char_length(v_name) < 2 and char_length(v_digits) < 6 then
    return;
  end if;
  return query
    select c.id, c.name, c.phone, lc.unique_code::text, c.created_at
    from public.customers c
    left join public.loyalty_cards lc on lc.customer_id = c.id and lc.status <> 'replaced'
    where (char_length(v_name) >= 2 and (lower(c.name) = lower(v_name) or c.name % v_name))
       or (char_length(v_digits) >= 6 and regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') = v_digits)
    order by c.created_at desc
    limit 5;
end $$;

-- ---------------------------------------------------------------------
-- 4-5. Lookups with rate limiting. These RETURN errors (instead of
-- raising) so that failed attempts are recorded for rate limiting.
-- ---------------------------------------------------------------------
create or replace function public.lookup_rate_limited(p_staff_id uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  per_minute int := coalesce((select (setting_value #>> '{}')::int from public.application_settings
                              where setting_key = 'lookup_limit_per_minute'), 20);
  fail_limit int := coalesce((select (setting_value #>> '{}')::int from public.application_settings
                              where setting_key = 'lookup_failures_per_10min'), 15);
begin
  return (select count(*) from public.lookup_attempts
          where staff_id = p_staff_id and attempted_at > now() - interval '1 minute') >= per_minute
      or (select count(*) from public.lookup_attempts
          where staff_id = p_staff_id and not success
            and attempted_at > now() - interval '10 minutes') >= fail_limit;
end $$;

create or replace function public.find_customer_by_code(p_code text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  s public.staff_profiles;
  v_code text := upper(btrim(coalesce(p_code, '')));
  card public.loyalty_cards;
  v_found boolean;
begin
  s := public.require_staff(false);
  if public.lookup_rate_limited(s.id) then
    return jsonb_build_object('error', 'RATE_LIMITED');
  end if;
  if v_code !~ '^[A-Z]{6}$' then
    insert into public.lookup_attempts (staff_id, method, success) values (s.id, 'code', false);
    return jsonb_build_object('error', 'INVALID_CODE');
  end if;
  select * into card from public.loyalty_cards where unique_code = v_code;
  v_found := found;  -- capture before the INSERT below resets FOUND
  insert into public.lookup_attempts (staff_id, method, success)
  values (s.id, 'code', v_found and card.status <> 'replaced');
  if not v_found then
    return jsonb_build_object('error', 'CUSTOMER_NOT_FOUND');
  end if;
  if card.status = 'replaced' then
    return jsonb_build_object('error', 'CARD_REPLACED');
  end if;
  return jsonb_build_object('customer_id', card.customer_id, 'card_status', card.status);
end $$;

create or replace function public.find_customer_by_qr(p_token text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  s public.staff_profiles;
  v_token text := btrim(coalesce(p_token, ''));
  card public.loyalty_cards;
  v_found boolean;
begin
  s := public.require_staff(false);
  if public.lookup_rate_limited(s.id) then
    return jsonb_build_object('error', 'RATE_LIMITED');
  end if;
  if v_token !~ '^[A-Za-z0-9_-]{32,64}$' then
    insert into public.lookup_attempts (staff_id, method, success) values (s.id, 'qr', false);
    return jsonb_build_object('error', 'INVALID_QR');
  end if;
  select * into card from public.loyalty_cards where qr_token = v_token;
  v_found := found;  -- capture before the INSERT below resets FOUND
  insert into public.lookup_attempts (staff_id, method, success)
  values (s.id, 'qr', v_found and card.status <> 'replaced');
  if not v_found then
    return jsonb_build_object('error', 'CUSTOMER_NOT_FOUND');
  end if;
  if card.status = 'replaced' then
    return jsonb_build_object('error', 'CARD_REPLACED');
  end if;
  return jsonb_build_object('customer_id', card.customer_id, 'card_status', card.status);
end $$;

-- ---------------------------------------------------------------------
-- 6. Customer profile
-- ---------------------------------------------------------------------
create or replace function public.get_customer_profile(p_customer_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  result jsonb;
begin
  perform public.require_staff(false);
  select jsonb_build_object(
    'id', c.id, 'name', c.name, 'phone', c.phone, 'notes', c.notes, 'active', c.active,
    'created_at', c.created_at, 'last_visit_at', c.last_visit_at,
    'card', (select jsonb_build_object('id', lc.id, 'code', lc.unique_code, 'qr_token', lc.qr_token,
                                       'status', lc.status, 'status_reason', lc.status_reason,
                                       'created_at', lc.created_at)
             from public.loyalty_cards lc where lc.customer_id = c.id and lc.status <> 'replaced'),
    'state', public.customer_state(c.id),
    'reward_unlocked_at', (select r.unlocked_at from public.rewards r
                           join public.loyalty_cycles cy on cy.id = r.cycle_id
                           where r.customer_id = c.id and r.status = 'available' and cy.status = 'completed'),
    'total_paid_hours', (select count(*) from public.punch_transactions p
                         where p.customer_id = c.id and p.voided_at is null),
    'total_rewards_redeemed', (select count(*) from public.rewards r
                               where r.customer_id = c.id and r.status = 'redeemed')
  ) into result
  from public.customers c where c.id = p_customer_id;

  if result is null then
    raise exception 'CUSTOMER_NOT_FOUND' using errcode = 'P0001';
  end if;
  return result;
end $$;

-- ---------------------------------------------------------------------
-- 7-8. Add a verified paid hour (unlocks the reward on the 3rd)
-- ---------------------------------------------------------------------
create or replace function public.add_paid_hour(
  p_customer_id uuid,
  p_idempotency_key uuid,
  p_receipt_reference text default null,
  p_notes text default null
) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  s public.staff_profiles;
  cust public.customers;
  card public.loyalty_cards;
  cyc public.loyalty_cycles;
  existing public.punch_transactions;
  v_count int;
  v_reward_id uuid;
  v_txn_id uuid;
  v_receipt text := nullif(btrim(coalesce(p_receipt_reference, '')), '');
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
begin
  s := public.require_staff(false);
  if p_idempotency_key is null then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode = 'P0001';
  end if;

  -- Serialize every loyalty write for this customer.
  select * into cust from public.customers where id = p_customer_id for update;
  if not found then
    raise exception 'CUSTOMER_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Idempotent retry: same key => same result, no second punch.
  select * into existing from public.punch_transactions where idempotency_key = p_idempotency_key;
  if found then
    if existing.customer_id <> p_customer_id then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = 'P0001';
    end if;
    return public.customer_state(p_customer_id)
      || jsonb_build_object('duplicate', true, 'punch_number', existing.punch_number,
                            'reward_unlocked', false);
  end if;

  if not cust.active then
    raise exception 'CUSTOMER_INACTIVE' using errcode = 'P0001';
  end if;
  select * into card from public.loyalty_cards where customer_id = p_customer_id and status <> 'replaced';
  if not found or card.status <> 'active' then
    raise exception 'CARD_INACTIVE' using errcode = 'P0001';
  end if;
  if v_receipt is not null and char_length(v_receipt) > 64 then
    raise exception 'INVALID_RECEIPT' using errcode = 'P0001';
  end if;
  if v_notes is not null and char_length(v_notes) > 500 then
    raise exception 'INVALID_NOTES' using errcode = 'P0001';
  end if;

  select * into cyc from public.loyalty_cycles
  where customer_id = p_customer_id and status in ('active', 'completed') for update;
  if not found then
    raise exception 'INTEGRITY_ERROR' using errcode = 'P0001';
  end if;
  if cyc.status = 'completed' then
    raise exception 'REWARD_PENDING' using errcode = 'P0001';
  end if;

  select count(*) into v_count from public.punch_transactions
  where cycle_id = cyc.id and voided_at is null;
  if v_count <> cyc.punch_count or v_count >= 3 then
    raise exception 'INTEGRITY_ERROR' using errcode = 'P0001';
  end if;
  v_count := v_count + 1;

  insert into public.punch_transactions
    (customer_id, card_id, cycle_id, staff_id, paid_hours, punch_number,
     receipt_reference, notes, idempotency_key)
  values
    (p_customer_id, card.id, cyc.id, s.id, 1, v_count, v_receipt, v_notes, p_idempotency_key)
  returning id into v_txn_id;

  insert into public.audit_logs (actor_id, customer_id, action, metadata)
  values (s.id, p_customer_id, 'punch.added',
          jsonb_build_object('transaction_id', v_txn_id, 'punch_number', v_count,
                             'cycle_number', cyc.cycle_number, 'receipt_reference', v_receipt,
                             'notes', v_notes, 'progress', v_count));

  if v_count = 3 then
    update public.loyalty_cycles
      set punch_count = 3, status = 'completed', completed_at = now()
      where id = cyc.id;

    insert into public.rewards (customer_id, cycle_id)
    values (p_customer_id, cyc.id)
    on conflict (cycle_id) do update
      set status = 'available', unlocked_at = now(), redeemed_at = null
      where public.rewards.status = 'void'
    returning id into v_reward_id;
    if v_reward_id is null then
      raise exception 'INTEGRITY_ERROR' using errcode = 'P0001';
    end if;

    insert into public.audit_logs (actor_id, customer_id, action, metadata)
    values (s.id, p_customer_id, 'reward.unlocked',
            jsonb_build_object('reward_id', v_reward_id, 'cycle_number', cyc.cycle_number));
  else
    update public.loyalty_cycles set punch_count = v_count where id = cyc.id;
  end if;

  update public.customers set last_visit_at = now() where id = p_customer_id;

  return public.customer_state(p_customer_id)
    || jsonb_build_object('duplicate', false, 'punch_number', v_count, 'reward_unlocked', v_count = 3);
end $$;

-- ---------------------------------------------------------------------
-- 9-10. Redeem reward and start the next cycle (atomic)
-- ---------------------------------------------------------------------
create or replace function public.redeem_reward(
  p_customer_id uuid,
  p_idempotency_key uuid
) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  s public.staff_profiles;
  cust public.customers;
  card public.loyalty_cards;
  cyc public.loyalty_cycles;
  rw public.rewards;
  existing public.reward_redemptions;
  v_new_cycle int;
begin
  s := public.require_staff(false);
  if p_idempotency_key is null then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED' using errcode = 'P0001';
  end if;

  select * into cust from public.customers where id = p_customer_id for update;
  if not found then
    raise exception 'CUSTOMER_NOT_FOUND' using errcode = 'P0001';
  end if;

  select * into existing from public.reward_redemptions where idempotency_key = p_idempotency_key;
  if found then
    if existing.customer_id <> p_customer_id then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = 'P0001';
    end if;
    return public.customer_state(p_customer_id) || jsonb_build_object('duplicate', true);
  end if;

  select * into card from public.loyalty_cards where customer_id = p_customer_id and status <> 'replaced';
  if not found or card.status <> 'active' then
    raise exception 'CARD_INACTIVE' using errcode = 'P0001';
  end if;

  select * into cyc from public.loyalty_cycles
  where customer_id = p_customer_id and status in ('active', 'completed') for update;
  if not found or cyc.status <> 'completed' then
    raise exception 'NO_REWARD_AVAILABLE' using errcode = 'P0001';
  end if;

  select * into rw from public.rewards where cycle_id = cyc.id and status = 'available' for update;
  if not found then
    raise exception 'NO_REWARD_AVAILABLE' using errcode = 'P0001';
  end if;

  update public.rewards set status = 'redeemed', redeemed_at = now() where id = rw.id;

  insert into public.reward_redemptions (reward_id, customer_id, staff_id, item, idempotency_key)
  values (rw.id, p_customer_id, s.id, 'free_hour_and_drink', p_idempotency_key);

  update public.loyalty_cycles set status = 'redeemed', closed_at = now() where id = cyc.id;

  v_new_cycle := cyc.cycle_number + 1;
  insert into public.loyalty_cycles (customer_id, card_id, cycle_number)
  values (p_customer_id, card.id, v_new_cycle);

  update public.customers set last_visit_at = now() where id = p_customer_id;

  insert into public.audit_logs (actor_id, customer_id, action, metadata)
  values (s.id, p_customer_id, 'reward.redeemed',
          jsonb_build_object('reward_id', rw.id, 'cycle_number', cyc.cycle_number,
                             'new_cycle_number', v_new_cycle, 'item', 'free_hour_and_drink'));

  return public.customer_state(p_customer_id) || jsonb_build_object('duplicate', false);
end $$;

-- ---------------------------------------------------------------------
-- Admin corrections (always with an audit reason)
-- ---------------------------------------------------------------------
create or replace function public.void_last_punch(p_customer_id uuid, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  s public.staff_profiles;
  cyc public.loyalty_cycles;
  v_punch public.punch_transactions;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  s := public.require_staff(true);
  if char_length(v_reason) < 3 then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;
  perform 1 from public.customers where id = p_customer_id for update;
  if not found then
    raise exception 'CUSTOMER_NOT_FOUND' using errcode = 'P0001';
  end if;

  select * into cyc from public.loyalty_cycles
  where customer_id = p_customer_id and status in ('active', 'completed') for update;
  if not found or cyc.punch_count = 0 then
    raise exception 'NOTHING_TO_VOID' using errcode = 'P0001';
  end if;

  select * into v_punch from public.punch_transactions
  where cycle_id = cyc.id and punch_number = cyc.punch_count and voided_at is null
  for update;
  if not found then
    raise exception 'INTEGRITY_ERROR' using errcode = 'P0001';
  end if;

  update public.punch_transactions
    set voided_at = now(), voided_by = s.id, void_reason = v_reason
    where id = v_punch.id;

  if cyc.status = 'completed' then
    update public.rewards set status = 'void' where cycle_id = cyc.id and status = 'available';
    update public.loyalty_cycles
      set status = 'active', punch_count = 2, completed_at = null
      where id = cyc.id;
  else
    update public.loyalty_cycles set punch_count = cyc.punch_count - 1 where id = cyc.id;
  end if;

  insert into public.audit_logs (actor_id, customer_id, action, metadata, reason)
  values (s.id, p_customer_id, 'punch.voided',
          jsonb_build_object('transaction_id', v_punch.id, 'punch_number', v_punch.punch_number,
                             'cycle_number', cyc.cycle_number, 'progress', cyc.punch_count - 1,
                             'reward_revoked', cyc.status = 'completed'),
          v_reason);

  return public.customer_state(p_customer_id);
end $$;

-- ---------------------------------------------------------------------
-- 14. Card management (admin)
-- ---------------------------------------------------------------------
create or replace function public.set_card_status(p_customer_id uuid, p_active boolean, p_reason text)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  s public.staff_profiles;
  card public.loyalty_cards;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  s := public.require_staff(true);
  if char_length(v_reason) < 3 then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;
  perform 1 from public.customers where id = p_customer_id for update;
  select * into card from public.loyalty_cards
  where customer_id = p_customer_id and status <> 'replaced' for update;
  if not found then
    raise exception 'CUSTOMER_NOT_FOUND' using errcode = 'P0001';
  end if;

  if p_active then
    update public.loyalty_cards set status = 'active', deactivated_at = null, status_reason = v_reason
    where id = card.id;
  else
    update public.loyalty_cards set status = 'deactivated', deactivated_at = coalesce(deactivated_at, now()),
      status_reason = v_reason
    where id = card.id;
  end if;

  insert into public.audit_logs (actor_id, customer_id, action, metadata, reason)
  values (s.id, p_customer_id, case when p_active then 'card.reactivated' else 'card.deactivated' end,
          jsonb_build_object('code', card.unique_code), v_reason);
  return jsonb_build_object('code', card.unique_code, 'status', case when p_active then 'active' else 'deactivated' end);
end $$;

create or replace function public.reissue_card(p_customer_id uuid, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  s public.staff_profiles;
  old_card public.loyalty_cards;
  new_card public.loyalty_cards;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  s := public.require_staff(true);
  if char_length(v_reason) < 3 then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;
  perform 1 from public.customers where id = p_customer_id for update;
  if not found then
    raise exception 'CUSTOMER_NOT_FOUND' using errcode = 'P0001';
  end if;
  select * into old_card from public.loyalty_cards
  where customer_id = p_customer_id and status <> 'replaced' for update;

  if found then
    update public.loyalty_cards
      set status = 'replaced', deactivated_at = coalesce(deactivated_at, now()), status_reason = v_reason
      where id = old_card.id;
  end if;

  new_card := public.issue_card(p_customer_id);

  -- progress carries over to the new card
  update public.loyalty_cycles set card_id = new_card.id
  where customer_id = p_customer_id and status in ('active', 'completed');

  insert into public.audit_logs (actor_id, customer_id, action, metadata, reason)
  values (s.id, p_customer_id, 'card.reissued',
          jsonb_build_object('old_code', old_card.unique_code, 'code', new_card.unique_code), v_reason);

  return jsonb_build_object('code', new_card.unique_code);
end $$;

-- ---------------------------------------------------------------------
-- Customer maintenance
-- ---------------------------------------------------------------------
create or replace function public.update_customer(
  p_customer_id uuid, p_name text, p_phone text default null, p_notes text default null
) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  s public.staff_profiles;
  before public.customers;
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
begin
  s := public.require_staff(false);
  select * into before from public.customers where id = p_customer_id for update;
  if not found then
    raise exception 'CUSTOMER_NOT_FOUND' using errcode = 'P0001';
  end if;
  if char_length(v_name) not between 1 and 100 then
    raise exception 'INVALID_NAME' using errcode = 'P0001';
  end if;
  if v_phone is not null and v_phone !~ '^\+?[0-9 ()-]{4,24}$' then
    raise exception 'INVALID_PHONE' using errcode = 'P0001';
  end if;
  if v_notes is not null and char_length(v_notes) > 1000 then
    raise exception 'INVALID_NOTES' using errcode = 'P0001';
  end if;

  update public.customers set name = v_name, phone = v_phone, notes = v_notes where id = p_customer_id;

  insert into public.audit_logs (actor_id, customer_id, action, metadata)
  values (s.id, p_customer_id, 'customer.updated',
          jsonb_build_object('before', jsonb_build_object('name', before.name, 'phone', before.phone),
                             'after', jsonb_build_object('name', v_name, 'phone', v_phone)));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.set_customer_active(p_customer_id uuid, p_active boolean, p_reason text)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  s public.staff_profiles;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  s := public.require_staff(true);
  if char_length(v_reason) < 3 then
    raise exception 'REASON_REQUIRED' using errcode = 'P0001';
  end if;
  update public.customers set active = p_active where id = p_customer_id;
  if not found then
    raise exception 'CUSTOMER_NOT_FOUND' using errcode = 'P0001';
  end if;
  insert into public.audit_logs (actor_id, customer_id, action, metadata, reason)
  values (s.id, p_customer_id, case when p_active then 'customer.reactivated' else 'customer.deactivated' end,
          '{}'::jsonb, v_reason);
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------
-- 11. History (complete, survives cycle resets)
-- ---------------------------------------------------------------------
create or replace function public.get_customer_history(
  p_customer_id uuid, p_limit int default 200, p_offset int default 0
) returns table (
  id bigint, action text, created_at timestamptz, staff_name text,
  metadata jsonb, reason text
)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_staff(false);
  return query
    select a.id, a.action, a.created_at, sp.full_name, a.metadata, a.reason
    from public.audit_logs a
    left join public.staff_profiles sp on sp.id = a.actor_id
    where a.customer_id = p_customer_id
    order by a.created_at desc, a.id desc
    limit least(greatest(p_limit, 1), 500) offset greatest(p_offset, 0);
end $$;

-- ---------------------------------------------------------------------
-- Customer list / search
-- ---------------------------------------------------------------------
create or replace function public.search_customers(
  p_query text default null,
  p_reward text default 'all',          -- all | available | none
  p_registered_from date default null,  -- Baghdad local dates
  p_registered_to date default null,
  p_sort text default 'recent',         -- recent | newest | name
  p_limit int default 25,
  p_offset int default 0
) returns table (
  id uuid, name text, phone text, code text, card_status text,
  punch_count smallint, cycle_status text, last_visit_at timestamptz,
  created_at timestamptz, active boolean, total_count bigint
)
language plpgsql stable security definer set search_path = public as $$
declare
  q text := nullif(btrim(coalesce(p_query, '')), '');
  q_like text;
  q_digits text;
begin
  perform public.require_staff(false);
  if q is not null then
    q_like := '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
    q_digits := regexp_replace(q, '\D', '', 'g');
  end if;

  return query
    select c.id, c.name, c.phone, lc.unique_code::text, lc.status,
           cy.punch_count, cy.status, c.last_visit_at, c.created_at, c.active,
           count(*) over ()
    from public.customers c
    left join public.loyalty_cards lc on lc.customer_id = c.id and lc.status <> 'replaced'
    left join public.loyalty_cycles cy on cy.customer_id = c.id and cy.status in ('active', 'completed')
    where (q is null
           or c.name ilike q_like
           or lc.unique_code = upper(q)
           or (char_length(q_digits) >= 3 and regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') like '%' || q_digits || '%'))
      and (p_reward = 'all'
           or (p_reward = 'available' and cy.status = 'completed')
           or (p_reward = 'none' and coalesce(cy.status, 'active') <> 'completed'))
      and (p_registered_from is null or (c.created_at at time zone public.app_tz())::date >= p_registered_from)
      and (p_registered_to is null or (c.created_at at time zone public.app_tz())::date <= p_registered_to)
    order by
      case when p_sort = 'name' then lower(c.name) end asc,
      case when p_sort = 'newest' then c.created_at end desc,
      case when p_sort = 'recent' then coalesce(c.last_visit_at, c.created_at) end desc,
      c.id
    limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
end $$;

-- ---------------------------------------------------------------------
-- Rewards overview
-- ---------------------------------------------------------------------
create or replace function public.list_rewards(p_status text default 'available', p_limit int default 50)
returns table (
  reward_id uuid, customer_id uuid, customer_name text, code text, status text,
  unlocked_at timestamptz, redeemed_at timestamptz, staff_name text
)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_staff(false);
  return query
    select r.id, c.id, c.name, lc.unique_code::text, r.status, r.unlocked_at, r.redeemed_at, sp.full_name
    from public.rewards r
    join public.customers c on c.id = r.customer_id
    left join public.loyalty_cards lc on lc.customer_id = c.id and lc.status <> 'replaced'
    left join public.reward_redemptions rr on rr.reward_id = r.id
    left join public.staff_profiles sp on sp.id = rr.staff_id
    where r.status = p_status
    order by coalesce(r.redeemed_at, r.unlocked_at) desc
    limit least(greatest(p_limit, 1), 200);
end $$;

-- ---------------------------------------------------------------------
-- 12. Dashboard + reports (admin)
-- ---------------------------------------------------------------------
create or replace function public.get_dashboard_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  tz text := public.app_tz();
  today date := (now() at time zone tz)::date;
begin
  perform public.require_staff(true);
  return jsonb_build_object(
    'total_customers',      (select count(*) from public.customers),
    'active_cards',         (select count(*) from public.loyalty_cards where status = 'active'),
    'paid_hours_today',     (select count(*) from public.punch_transactions
                             where voided_at is null and (created_at at time zone tz)::date = today),
    'total_paid_hours',     (select count(*) from public.punch_transactions where voided_at is null),
    'available_rewards',    (select count(*) from public.rewards where status = 'available'),
    'redeemed_today',       (select count(*) from public.rewards
                             where status = 'redeemed' and (redeemed_at at time zone tz)::date = today),
    'total_redeemed',       (select count(*) from public.rewards where status = 'redeemed'),
    'new_customers_month',  (select count(*) from public.customers
                             where date_trunc('month', created_at at time zone tz) = date_trunc('month', now() at time zone tz))
  );
end $$;

create or replace function public.get_recent_activity(p_limit int default 15)
returns table (
  id bigint, action text, created_at timestamptz, customer_id uuid, customer_name text,
  code text, staff_name text, metadata jsonb
)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_staff(true);
  return query
    select a.id, a.action, a.created_at, c.id, c.name, lc.unique_code::text, sp.full_name, a.metadata
    from public.audit_logs a
    join public.customers c on c.id = a.customer_id
    left join public.loyalty_cards lc on lc.customer_id = c.id and lc.status <> 'replaced'
    left join public.staff_profiles sp on sp.id = a.actor_id
    where a.action in ('punch.added', 'reward.unlocked', 'reward.redeemed', 'customer.registered', 'punch.voided')
    order by a.created_at desc, a.id desc
    limit least(greatest(p_limit, 1), 100);
end $$;

create or replace function public.get_reports(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  tz text := public.app_tz();
  today date := (now() at time zone tz)::date;
  v_days int := least(greatest(coalesce(p_days, 30), 7), 120);
begin
  perform public.require_staff(true);
  return jsonb_build_object(
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', d::date,
        'paid_hours', (select count(*) from public.punch_transactions p
                       where p.voided_at is null and (p.created_at at time zone tz)::date = d::date),
        'redeemed', (select count(*) from public.rewards r
                     where r.status = 'redeemed' and (r.redeemed_at at time zone tz)::date = d::date),
        'new_customers', (select count(*) from public.customers c
                          where (c.created_at at time zone tz)::date = d::date)
      ) order by d), '[]'::jsonb)
      from generate_series(today - (v_days - 1), today, interval '1 day') d
    ),
    'weekly', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'week_start', w::date,
        'paid_hours', (select count(*) from public.punch_transactions p
                       where p.voided_at is null
                         and date_trunc('week', p.created_at at time zone tz)::date = w::date),
        'redeemed', (select count(*) from public.rewards r
                     where r.status = 'redeemed'
                       and date_trunc('week', r.redeemed_at at time zone tz)::date = w::date)
      ) order by w), '[]'::jsonb)
      from generate_series(date_trunc('week', today::timestamp) - interval '7 weeks',
                           date_trunc('week', today::timestamp), interval '1 week') w
    ),
    'monthly', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'month_start', m::date,
        'paid_hours', (select count(*) from public.punch_transactions p
                       where p.voided_at is null
                         and date_trunc('month', p.created_at at time zone tz)::date = m::date),
        'redeemed', (select count(*) from public.rewards r
                     where r.status = 'redeemed'
                       and date_trunc('month', r.redeemed_at at time zone tz)::date = m::date),
        'new_customers', (select count(*) from public.customers c
                          where date_trunc('month', c.created_at at time zone tz)::date = m::date)
      ) order by m), '[]'::jsonb)
      from generate_series(date_trunc('month', today::timestamp) - interval '5 months',
                           date_trunc('month', today::timestamp), interval '1 month') m
    ),
    'top_customers', (
      select coalesce(jsonb_agg(t order by t.paid_hours desc, t.name), '[]'::jsonb)
      from (
        select c.id, c.name, lc.unique_code as code, count(p.id) as paid_hours,
               (select count(*) from public.rewards r where r.customer_id = c.id and r.status = 'redeemed') as redeemed
        from public.customers c
        join public.punch_transactions p on p.customer_id = c.id and p.voided_at is null
        left join public.loyalty_cards lc on lc.customer_id = c.id and lc.status <> 'replaced'
        group by c.id, c.name, lc.unique_code
        order by count(p.id) desc, c.name
        limit 10
      ) t
    ),
    'totals', jsonb_build_object(
      'earned', (select count(*) from public.rewards where status in ('available', 'redeemed')),
      'redeemed', (select count(*) from public.rewards where status = 'redeemed'),
      'outstanding', (select count(*) from public.rewards where status = 'available')
    )
  );
end $$;

-- ---------------------------------------------------------------------
-- 13. Staff & settings (admin)
-- ---------------------------------------------------------------------
create or replace function public.admin_create_staff_profile(
  p_auth_user_id uuid, p_full_name text, p_role text
) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  s public.staff_profiles;
  v_id uuid;
begin
  s := public.require_staff(true);
  if p_role not in ('super_admin', 'cashier') then
    raise exception 'INVALID_ROLE' using errcode = 'P0001';
  end if;
  if char_length(btrim(coalesce(p_full_name, ''))) not between 1 and 100 then
    raise exception 'INVALID_NAME' using errcode = 'P0001';
  end if;
  insert into public.staff_profiles (auth_user_id, full_name, role)
  values (p_auth_user_id, btrim(p_full_name), p_role)
  returning id into v_id;
  insert into public.audit_logs (actor_id, action, metadata)
  values (s.id, 'staff.created', jsonb_build_object('staff_id', v_id, 'role', p_role, 'name', btrim(p_full_name)));
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.admin_update_staff(
  p_staff_id uuid, p_full_name text, p_role text, p_active boolean
) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  s public.staff_profiles;
  target public.staff_profiles;
begin
  s := public.require_staff(true);
  if p_role not in ('super_admin', 'cashier') then
    raise exception 'INVALID_ROLE' using errcode = 'P0001';
  end if;
  if char_length(btrim(coalesce(p_full_name, ''))) not between 1 and 100 then
    raise exception 'INVALID_NAME' using errcode = 'P0001';
  end if;
  -- serialize staff changes so the last-admin check cannot race
  lock table public.staff_profiles in share row exclusive mode;
  select * into target from public.staff_profiles where id = p_staff_id;
  if not found then
    raise exception 'STAFF_NOT_FOUND' using errcode = 'P0001';
  end if;
  if target.id = s.id and (p_role <> 'super_admin' or not p_active) then
    raise exception 'CANNOT_DEMOTE_SELF' using errcode = 'P0001';
  end if;

  update public.staff_profiles
    set full_name = btrim(p_full_name), role = p_role, active = p_active
    where id = p_staff_id;

  if (select count(*) from public.staff_profiles where role = 'super_admin' and active) = 0 then
    raise exception 'LAST_ADMIN' using errcode = 'P0001';
  end if;

  insert into public.audit_logs (actor_id, action, metadata)
  values (s.id, 'staff.updated', jsonb_build_object(
    'staff_id', p_staff_id,
    'before', jsonb_build_object('name', target.full_name, 'role', target.role, 'active', target.active),
    'after', jsonb_build_object('name', btrim(p_full_name), 'role', p_role, 'active', p_active)));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.update_setting(p_key text, p_value jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  s public.staff_profiles;
  old_value jsonb;
begin
  s := public.require_staff(true);
  case p_key
    when 'lounge_name', 'reward_label', 'card_tagline' then
      if jsonb_typeof(p_value) <> 'string' or char_length(p_value #>> '{}') not between 1 and 80 then
        raise exception 'INVALID_SETTING' using errcode = 'P0001';
      end if;
    when 'lookup_limit_per_minute', 'lookup_failures_per_10min' then
      if jsonb_typeof(p_value) <> 'number' or (p_value #>> '{}')::numeric not between 3 and 500
         or (p_value #>> '{}')::numeric <> trunc((p_value #>> '{}')::numeric) then
        raise exception 'INVALID_SETTING' using errcode = 'P0001';
      end if;
    else
      raise exception 'INVALID_SETTING' using errcode = 'P0001';
  end case;

  select setting_value into old_value from public.application_settings where setting_key = p_key for update;
  update public.application_settings
    set setting_value = p_value, updated_at = now(), updated_by = s.id
    where setting_key = p_key;
  insert into public.audit_logs (actor_id, action, metadata)
  values (s.id, 'settings.updated', jsonb_build_object('key', p_key, 'before', old_value, 'after', p_value));
  return jsonb_build_object('ok', true);
end $$;

-- Run ONCE from the Supabase SQL editor to promote the first admin.
-- Not executable by anon/authenticated users (see grants).
create or replace function public.bootstrap_first_admin(p_email text, p_full_name text) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  v_user uuid;
  v_id uuid;
begin
  if exists (select 1 from public.staff_profiles where role = 'super_admin') then
    raise exception 'An administrator already exists. Use the Staff page instead.';
  end if;
  select id into v_user from auth.users where lower(email) = lower(btrim(p_email));
  if v_user is null then
    raise exception 'No auth user with email %. Create it in Authentication > Users first.', p_email;
  end if;
  insert into public.staff_profiles (auth_user_id, full_name, role)
  values (v_user, btrim(p_full_name), 'super_admin') returning id into v_id;
  insert into public.audit_logs (actor_id, action, metadata)
  values (v_id, 'staff.bootstrap_admin', jsonb_build_object('email', lower(btrim(p_email))));
  return v_id;
end $$;
