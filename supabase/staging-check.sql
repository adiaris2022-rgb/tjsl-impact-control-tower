-- Staging: apply after the hardening schema.
-- Create a private Supabase Storage bucket named:
-- tjsl-evidence-private
--
-- Verify:
select count(*) as program_count from tjsl_programs;
select count(*) as partner_count from tjsl_partners;
select count(*) as transaction_count from tjsl_transactions;
select count(*) as verified_evidence_count from tjsl_verified_evidence;