-- =====================================================================
-- DEVELOPMENT / TESTING SEED ONLY — do not run on the production project.
-- Creates sample customers at different loyalty stages through the same
-- functions the app uses (so every row is valid and audited).
-- Prerequisite: an administrator exists (see README "Create the first admin").
-- =====================================================================
do $$
declare
  admin_uid uuid := (select auth_user_id from public.staff_profiles where role = 'super_admin' and active order by created_at limit 1);
  c jsonb;
  i int;
  people text[][] := array[
    array['Ahmed Ali',          '+964 770 123 4567', '3'],  -- reward available
    array['Mustafa Al-Rubaie',  '+964 780 555 0192', '2'],
    array['Zainab Hussein',     '',                  '1'],
    array['Omar Khalid',        '+964 750 222 8811', '0'],
    array['Yousif Saad',        '+964 771 909 3030', 'R'],  -- redeemed once, then 1 hour
    array['Hiba Jasim',         '',                  '2'],
    array['Ali Haider',         '+964 772 404 1188', '3'],
    array['Murtadha Kadhim',    '',                  '0']
  ];
begin
  if admin_uid is null then
    raise exception 'Create the first administrator before seeding.';
  end if;
  -- act as that administrator (works with Supabase auth.uid())
  perform set_config('request.jwt.claim.sub', admin_uid::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', admin_uid, 'role', 'authenticated')::text, true);

  for i in 1..array_length(people, 1) loop
    c := public.register_customer(people[i][1], nullif(people[i][2], ''), null, gen_random_uuid());
    if people[i][3] = 'R' then
      for n in 1..3 loop perform public.add_paid_hour((c->>'customer_id')::uuid, gen_random_uuid(), 'SEED-' || n); end loop;
      perform public.redeem_reward((c->>'customer_id')::uuid, gen_random_uuid());
      perform public.add_paid_hour((c->>'customer_id')::uuid, gen_random_uuid());
    else
      for n in 1..people[i][3]::int loop
        perform public.add_paid_hour((c->>'customer_id')::uuid, gen_random_uuid(), 'SEED-' || n);
      end loop;
    end if;
    raise notice '% -> %', people[i][1], c->>'code';
  end loop;
end $$;
