-- Optional setup AFTER the mail provider, worker, pg_cron and pg_net are verified.
-- In Vault, add habitify_feedback_mail_worker_key equal to the server worker key.
-- No key is embedded in this file or in the cron command. Not executed by migration 012.
begin;
do $$ begin
 if not exists(select 1 from pg_extension where extname='pg_cron') or not exists(select 1 from pg_extension where extname='pg_net') then raise exception 'ENABLE_CRON_AND_NET_FIRST';end if;
 if not exists(select 1 from vault.decrypted_secrets where name='habitify_feedback_mail_worker_key' and decrypted_secret ~ '^[0-9a-f]{64}$') then raise exception 'CONFIGURE_WORKER_KEY_IN_VAULT_FIRST';end if;
end $$;
select cron.schedule('habitify-feedback-mail','* * * * *',$job$
 select net.http_post(
  url:='https://crtzbheoogvcansekmmw.supabase.co/functions/v1/feedback-mail',
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='habitify_feedback_mail_worker_key')),
  body:='{}'::jsonb,timeout_milliseconds:=20000
 ) where exists(select 1 from habitify_feedback.mail_tasks where (state='pending' and next_at<=now()) or (state='processing' and lease_until<now()));
$job$);
commit;
-- To pause after setup: select cron.unschedule('habitify-feedback-mail');
