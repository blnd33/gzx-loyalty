-- =====================================================================
-- GZX Gaming Loyalty System — Row Level Security & privileges
-- * Anonymous visitors can read nothing and call nothing.
-- * Signed-in staff can READ through RLS policies.
-- * Nobody can INSERT/UPDATE/DELETE tables directly: every write goes
--   through the SECURITY DEFINER functions, which re-check the role.
-- =====================================================================

alter table public.staff_profiles        enable row level security;
alter table public.customers             enable row level security;
alter table public.loyalty_cards         enable row level security;
alter table public.loyalty_cycles        enable row level security;
alter table public.punch_transactions    enable row level security;
alter table public.rewards               enable row level security;
alter table public.reward_redemptions    enable row level security;
alter table public.audit_logs            enable row level security;
alter table public.application_settings  enable row level security;
alter table public.lookup_attempts       enable row level security;

-- Table privileges ------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public from authenticated;
grant select on all tables in schema public to authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- Read policies ---------------------------------------------------------
create policy staff_read_self_or_admin on public.staff_profiles
  for select to authenticated
  using (auth_user_id = auth.uid() or public.is_admin());

create policy staff_read_customers on public.customers
  for select to authenticated using (public.is_staff());
create policy staff_read_cards on public.loyalty_cards
  for select to authenticated using (public.is_staff());
create policy staff_read_cycles on public.loyalty_cycles
  for select to authenticated using (public.is_staff());
create policy staff_read_punches on public.punch_transactions
  for select to authenticated using (public.is_staff());
create policy staff_read_rewards on public.rewards
  for select to authenticated using (public.is_staff());
create policy staff_read_redemptions on public.reward_redemptions
  for select to authenticated using (public.is_staff());
create policy staff_read_settings on public.application_settings
  for select to authenticated using (public.is_staff());

-- Cashiers see customer activity; admins see everything (staff/settings too).
create policy read_audit on public.audit_logs
  for select to authenticated
  using (public.is_admin() or (public.is_staff() and customer_id is not null));

create policy admin_read_lookup_attempts on public.lookup_attempts
  for select to authenticated using (public.is_admin());

-- Function privileges ---------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

-- Used inside RLS policies (evaluated as the caller)
grant execute on function public.is_staff()  to authenticated;
grant execute on function public.is_admin()  to authenticated;
grant execute on function public.current_staff_id() to authenticated;
grant execute on function public.app_tz() to authenticated;

-- Staff API (each function re-checks role internally)
grant execute on function public.get_my_profile() to authenticated;
grant execute on function public.register_customer(text, text, text, uuid) to authenticated;
grant execute on function public.find_possible_duplicates(text, text) to authenticated;
grant execute on function public.find_customer_by_code(text) to authenticated;
grant execute on function public.find_customer_by_qr(text) to authenticated;
grant execute on function public.get_customer_profile(uuid) to authenticated;
grant execute on function public.add_paid_hour(uuid, uuid, text, text) to authenticated;
grant execute on function public.redeem_reward(uuid, uuid) to authenticated;
grant execute on function public.get_customer_history(uuid, int, int) to authenticated;
grant execute on function public.search_customers(text, text, date, date, text, int, int) to authenticated;
grant execute on function public.list_rewards(text, int) to authenticated;
grant execute on function public.update_customer(uuid, text, text, text) to authenticated;

-- Admin API (require_staff(true) inside)
grant execute on function public.void_last_punch(uuid, text) to authenticated;
grant execute on function public.set_card_status(uuid, boolean, text) to authenticated;
grant execute on function public.reissue_card(uuid, text) to authenticated;
grant execute on function public.set_customer_active(uuid, boolean, text) to authenticated;
grant execute on function public.get_dashboard_stats() to authenticated;
grant execute on function public.get_recent_activity(int) to authenticated;
grant execute on function public.get_reports(int) to authenticated;
grant execute on function public.admin_create_staff_profile(uuid, text, text) to authenticated;
grant execute on function public.admin_update_staff(uuid, text, text, boolean) to authenticated;
grant execute on function public.update_setting(text, jsonb) to authenticated;

-- NOT granted (internal / SQL-editor only):
--   require_staff, customer_state, issue_card, generate_customer_code,
--   generate_qr_token, lookup_rate_limited, bootstrap_first_admin,
--   forbid_mutation, guard_punch_update, touch_updated_at

-- Keep future objects locked down by default
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon;

-- Housekeeping: old lookup attempts are only needed for rate limiting.
-- (Optional) schedule with pg_cron: delete from public.lookup_attempts where attempted_at < now() - interval '7 days';
