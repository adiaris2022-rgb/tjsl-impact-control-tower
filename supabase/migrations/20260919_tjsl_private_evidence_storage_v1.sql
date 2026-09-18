-- TJSL Impact Control Tower: private evidence storage baseline
insert into storage.buckets (id, name, public)
values ('tjsl-evidence', 'tjsl-evidence', false)
on conflict (id) do update set public = false;

drop policy if exists tjsl_evidence_storage_read on storage.objects;
create policy tjsl_evidence_storage_read
on storage.objects for select to authenticated
using (
  bucket_id = 'tjsl-evidence'
  and (
    has_business_role((storage.foldername(name))[1]::uuid, ARRAY['OWNER','PROGRAM_MANAGER'])
    or (storage.foldername(name))[3]::uuid = partner_for_user((storage.foldername(name))[1]::uuid)
  )
);

drop policy if exists tjsl_evidence_storage_insert on storage.objects;
create policy tjsl_evidence_storage_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'tjsl-evidence'
  and (
    has_business_role((storage.foldername(name))[1]::uuid, ARRAY['OWNER','PROGRAM_MANAGER'])
    or (storage.foldername(name))[3]::uuid = partner_for_user((storage.foldername(name))[1]::uuid)
  )
);

drop policy if exists tjsl_evidence_storage_update on storage.objects;
create policy tjsl_evidence_storage_update
on storage.objects for update to authenticated
using (
  bucket_id = 'tjsl-evidence'
  and (
    has_business_role((storage.foldername(name))[1]::uuid, ARRAY['OWNER','PROGRAM_MANAGER'])
    or (storage.foldername(name))[3]::uuid = partner_for_user((storage.foldername(name))[1]::uuid)
  )
)
with check (
  bucket_id = 'tjsl-evidence'
  and (
    has_business_role((storage.foldername(name))[1]::uuid, ARRAY['OWNER','PROGRAM_MANAGER'])
    or (storage.foldername(name))[3]::uuid = partner_for_user((storage.foldername(name))[1]::uuid)
  )
);

drop policy if exists tjsl_evidence_storage_delete on storage.objects;
create policy tjsl_evidence_storage_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'tjsl-evidence'
  and has_business_role((storage.foldername(name))[1]::uuid, ARRAY['OWNER','PROGRAM_MANAGER'])
);
