-- Authenticated write policies for TJSL Impact Control Tower.
-- Migration: tjsl_authenticated_write_policies_v1

create or replace function private.can_access_partner(p_partner_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.tjsl_partners p
    join public.tjsl_programs pr on pr.id = p.program_id
    join public.business_users bu on bu.business_id = pr.business_id
    where p.id = p_partner_id
      and bu.user_id = (select auth.uid())
      and (
        bu.role = 'OWNER'
        or (bu.role = 'PROGRAM_MANAGER' and bu.program_id = pr.id)
        or (bu.role in ('PARTNER','STAFF') and bu.partner_id = p.id)
      )
  )
$$;

create or replace function private.can_manage_program(p_program_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.tjsl_programs p
    join public.business_users bu on bu.business_id = p.business_id
    where p.id = p_program_id
      and bu.user_id = (select auth.uid())
      and bu.role in ('OWNER','PROGRAM_MANAGER')
      and (bu.role = 'OWNER' or bu.program_id = p.id)
  )
$$;

create or replace function private.outcome_partner_id(p_outcome_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select o.partner_id from public.tjsl_outcomes o where o.id = p_outcome_id
$$;

revoke all on function private.can_access_partner(uuid) from public, anon;
revoke all on function private.can_manage_program(uuid) from public, anon;
revoke all on function private.outcome_partner_id(uuid) from public, anon;
grant execute on function private.can_access_partner(uuid) to authenticated;
grant execute on function private.can_manage_program(uuid) to authenticated;
grant execute on function private.outcome_partner_id(uuid) to authenticated;
grant usage on schema private to authenticated;

drop policy if exists businesses_owner_write on public.businesses;
create policy businesses_owner_write on public.businesses
for update to authenticated
using (public.has_business_role(id, array['OWNER']::text[]))
with check (public.has_business_role(id, array['OWNER']::text[]));

drop policy if exists business_users_owner_write on public.business_users;
drop policy if exists business_users_owner_insert on public.business_users;
create policy business_users_owner_insert on public.business_users
for insert to authenticated
with check (public.has_business_role(business_id, array['OWNER']::text[]));
drop policy if exists business_users_owner_update on public.business_users;
create policy business_users_owner_update on public.business_users
for update to authenticated
using (public.has_business_role(business_id, array['OWNER']::text[]))
with check (public.has_business_role(business_id, array['OWNER']::text[]));
drop policy if exists business_users_owner_delete on public.business_users;
create policy business_users_owner_delete on public.business_users
for delete to authenticated
using (public.has_business_role(business_id, array['OWNER']::text[]));

drop policy if exists programs_manager_insert on public.tjsl_programs;
create policy programs_manager_insert on public.tjsl_programs
for insert to authenticated
with check (public.has_business_role(business_id, array['OWNER']::text[]));
drop policy if exists programs_manager_update on public.tjsl_programs;
create policy programs_manager_update on public.tjsl_programs
for update to authenticated
using (private.can_manage_program(id))
with check (private.can_manage_program(id));
drop policy if exists programs_owner_delete on public.tjsl_programs;
create policy programs_owner_delete on public.tjsl_programs
for delete to authenticated
using (public.has_business_role(business_id, array['OWNER']::text[]));

drop policy if exists partners_manager_insert on public.tjsl_partners;
create policy partners_manager_insert on public.tjsl_partners
for insert to authenticated
with check (private.can_manage_program(program_id));
drop policy if exists partners_manager_update on public.tjsl_partners;
create policy partners_manager_update on public.tjsl_partners
for update to authenticated
using (private.can_manage_program(program_id))
with check (private.can_manage_program(program_id));
drop policy if exists partners_owner_delete on public.tjsl_partners;
create policy partners_owner_delete on public.tjsl_partners
for delete to authenticated
using (private.can_manage_program(program_id));

drop policy if exists transactions_scoped_insert on public.tjsl_transactions;
create policy transactions_scoped_insert on public.tjsl_transactions
for insert to authenticated
with check (private.can_access_partner(partner_id));
drop policy if exists transactions_scoped_update on public.tjsl_transactions;
create policy transactions_scoped_update on public.tjsl_transactions
for update to authenticated
using (private.can_access_partner(partner_id))
with check (private.can_access_partner(partner_id));
drop policy if exists transactions_manager_delete on public.tjsl_transactions;
create policy transactions_manager_delete on public.tjsl_transactions
for delete to authenticated
using (private.can_manage_program((select p.program_id from public.tjsl_partners p where p.id = partner_id)));

drop policy if exists outcomes_partner_insert on public.tjsl_outcomes;
create policy outcomes_partner_insert on public.tjsl_outcomes
for insert to authenticated
with check (
  private.can_access_partner(partner_id)
  and exists (
    select 1 from public.business_users bu
    where bu.user_id = (select auth.uid())
      and bu.partner_id = partner_id
      and bu.role in ('PARTNER','STAFF')
  )
);
drop policy if exists outcomes_partner_update on public.tjsl_outcomes;
drop policy if exists outcomes_manager_update on public.tjsl_outcomes;
drop policy if exists outcomes_scoped_update on public.tjsl_outcomes;
create policy outcomes_scoped_update on public.tjsl_outcomes
for update to authenticated
using (private.can_access_partner(partner_id))
with check (
  private.can_manage_program((select p.program_id from public.tjsl_partners p where p.id = partner_id))
  or (private.can_access_partner(partner_id) and status <> 'VERIFIED')
);

drop policy if exists evidence_partner_insert on public.tjsl_evidence;
create policy evidence_partner_insert on public.tjsl_evidence
for insert to authenticated
with check (
  private.can_access_partner(private.outcome_partner_id(outcome_id))
  and exists (
    select 1 from public.business_users bu
    where bu.user_id = (select auth.uid())
      and bu.partner_id = private.outcome_partner_id(outcome_id)
      and bu.role in ('PARTNER','STAFF')
  )
  and status <> 'VERIFIED'
);
drop policy if exists evidence_partner_update on public.tjsl_evidence;
drop policy if exists evidence_manager_update on public.tjsl_evidence;
drop policy if exists evidence_scoped_update on public.tjsl_evidence;
create policy evidence_scoped_update on public.tjsl_evidence
for update to authenticated
using (private.can_access_partner(private.outcome_partner_id(outcome_id)))
with check (
  private.can_manage_program(
    (select p.program_id from public.tjsl_partners p
     where p.id = private.outcome_partner_id(outcome_id))
  )
  or (
    private.can_access_partner(private.outcome_partner_id(outcome_id))
    and status <> 'VERIFIED'
  )
);

drop policy if exists proxies_manager_insert on public.tjsl_financial_proxies;
create policy proxies_manager_insert on public.tjsl_financial_proxies
for insert to authenticated
with check (
  private.can_manage_program((
    select p.program_id
    from public.tjsl_partners p
    join public.tjsl_outcomes o on o.partner_id = p.id
    where o.id = outcome_id
  ))
);
drop policy if exists proxies_manager_update on public.tjsl_financial_proxies;
create policy proxies_manager_update on public.tjsl_financial_proxies
for update to authenticated
using (private.can_manage_program((
  select p.program_id from public.tjsl_partners p
  join public.tjsl_outcomes o on o.partner_id = p.id
  where o.id = outcome_id
)))
with check (private.can_manage_program((
  select p.program_id from public.tjsl_partners p
  join public.tjsl_outcomes o on o.partner_id = p.id
  where o.id = outcome_id
)));

drop policy if exists sroi_manager_insert on public.tjsl_sroi_calculations;
create policy sroi_manager_insert on public.tjsl_sroi_calculations
for insert to authenticated with check (private.can_manage_program(program_id));
drop policy if exists sroi_manager_update on public.tjsl_sroi_calculations;
create policy sroi_manager_update on public.tjsl_sroi_calculations
for update to authenticated
using (private.can_manage_program(program_id))
with check (private.can_manage_program(program_id));

drop policy if exists reports_manager_insert on public.tjsl_reports;
create policy reports_manager_insert on public.tjsl_reports
for insert to authenticated with check (private.can_manage_program(program_id));
drop policy if exists reports_manager_update on public.tjsl_reports;
create policy reports_manager_update on public.tjsl_reports
for update to authenticated
using (private.can_manage_program(program_id))
with check (private.can_manage_program(program_id));
