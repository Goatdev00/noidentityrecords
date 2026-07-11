-- ============================================================================
-- NO.ID RECORDS — campaigns can target MULTIPLE groups / contacts at once
--
-- group_ids/emails supersede the single group_id/individual_email (kept for
-- backward compatibility; the send function falls back to them).
-- ============================================================================

alter table public.mailing_campaigns
  add column if not exists group_ids uuid[],
  add column if not exists emails text[];

notify pgrst, 'reload schema';
