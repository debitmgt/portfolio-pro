-- supabase/migrations/002_lifecycle_emails.sql
-- Tracking columns for the automated account-lifecycle email sequence
-- (see app/api/cron/send-lifecycle-emails/route.ts). Nullable timestamps —
-- null means "not sent yet"; each is stamped once, right after a successful
-- send, so the daily cron never double-sends.

alter table public.profiles
  add column if not exists welcome_email_sent_at timestamptz,
  add column if not exists day3_email_sent_at timestamptz,
  add column if not exists day14_email_sent_at timestamptz;
