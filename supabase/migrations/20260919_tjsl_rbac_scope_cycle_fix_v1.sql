create schema if not exists private;

alter table public.business_users
  add column if not exists program_id uuid references public.tjsl_programs(id);

create or replace function private.current_partner_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select bu.partner_id
  from public.business_users bu
  where bu.user_id = (select auth.uid())
    and bu.partner_id is not null
  order by bu.created_at
  limit 1
$$;

create or replace function private.can_access_program(p_program_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tjsl_programs p
    join public.business_users bu on bu.business_id = p.business_id
    where p.id = p_program_id
      and bu.user_id = (select auth.uid())
      and (
        bu.role = 'OWNER'
        or (bu.role = 'PROGRAM_MANAGER' and bu.program_id = p.id)
      )
  )
$$;

create or replace function private.partner_program_id(p_partner_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select tp.program_id from public.tjsl_partners tp where tp.id = p_partner_id
$$;

revoke all on schema private from public;
grant usage on schema private to authenticated;

revoke execute on function private.current_partner_id() from public, anon;
revoke execute on function private.can_access_program(uuid) from public, anon;
revoke execute on function private.partner_program_id(uuid) from public, anon;
grant execute on function private.current_partner_id() to authenticated;
grant execute on function private.can_access_program(uuid) to authenticated;
grant execute on function private.partner_program_id(uuid) to authenticated;

drop policy if exists programs_member_read on public.tjsl_programs;
create policy programs_member_read on public.tjsl_programs
for select to authenticated
using ((select private.can_access_program(id)));

drop policy if exists partners_program_read on public.tjsl_partners;
create policy partners_program_read on public.tjsl_partners
for select to authenticated
using (
  (select private.can_access_program(program_id))
  or id = (select private.current_partner_id())
);

drop policy if exists transactions_scoped_read on public.tjsl_transactions;
create policy transactions_scoped_read on public.tjsl_transactions
for select to authenticated
using (
  (select private.can_access_program((select private.partner_program_id(partner_id))))
  or partner_id = (select private.current_partner_id())
);

drop policy if exists outcomes_scoped_read on public.tjsl_outcomes;
create policy outcomes_scoped_read on public.tjsl_outcomes
for select to authenticated
using (
  (select private.can_access_program((select private.partner_program_id(partner_id))))
  or partner_id = (select private.current_partner_id())
);

drop policy if exists evidence_scoped_read on public.tjsl_evidence;
create policy evidence_scoped_read on public.tjsl_evidence
for select to authenticated
using (
  (select private.can_access_program(
    (select private.partner_program_id(o.partner_id)
     from public.tjsl_outcomes o
     where o.id = tjsl_evidence.outcome_id)
  ))
  or exists (
    select 1
    from public.tjsl_outcomes o
    where o.id = tjsl_evidence.outcome_id
      and o.partner_id = (select private.current_partner_id())
  )
);

drop policy if exists proxies_manager_read on public.tjsl_financial_proxies;
create policy proxies_manager_read on public.tjsl_financial_proxies
for select to authenticated
using (
  (select private.can_access_program(
    (select private.partner_program_id(o.partner_id)
     from public.tjsl_outcomes o
     where o.id = tjsl_financial_proxies.outcome_id)
  ))
);

drop policy if exists sroi_manager_read on public.tjsl_sroi_calculations;
create policy sroi_manager_read on public.tjsl_sroi_calculations
for select to authenticated
using ((select private.can_access_program(program_id)));

drop policy if exists reports_owner_manager_read on public.tjsl_reports;
create policy reports_owner_manager_read on public.tjsl_reports
for select to authenticated
using ((select private.can_access_program(program_id)));

update public.business_users
set program_id = '7150b7d2-6efa-4175-96c2-af04595fb4f0'
where user_id = '1ee68d2f-d5ed-4a6b-a364-0697b8da27af'
  and business_id = '026dbc8d-f2d9-49eb-a253-3a5da7e3c88f';

create index if not exists business_users_program_id_idx
  on public.business_users(program_id);
