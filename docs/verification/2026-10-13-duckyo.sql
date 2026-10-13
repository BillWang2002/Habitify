-- Historical verification for migration 014; use 2026-10-13-background-avatars.sql after 015.
-- Run on the selected Habitify-dev project. Every synthetic row and write is rolled back.
begin;
do $$
declare a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();cfg jsonb;payload jsonb;result jsonb;rev bigint:=0;bg text;av text;iat bigint:=extract(epoch from now())::bigint+1;
begin
 insert into auth.users(id,email,created_at,updated_at) values(a,'duckyo-a-'||a::text||'@example.invalid',now(),now()),(b,'duckyo-b-'||b::text||'@example.invalid',now(),now());
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated','iat',iat)::text,true);
 foreach bg in array array['study','work','phone','snack','cake','meal'] loop
  foreach av in array array['work','study','meal'] loop
   cfg:=jsonb_build_object('theme','duckyo','background','duckyo-'||bg,'surface','glass','avatar','duckyo-'||av,'mode','light');
   payload:=jsonb_build_object('op','appearance-set','settings',cfg,'expectedRevision',rev,'requestId',gen_random_uuid());
   result:=public.appearance_request(payload);
   if result->'settings' is distinct from cfg or (result->>'revision')::bigint<>rev+1 then raise exception 'CATALOG_SAVE_FAILED';end if;
   if public.appearance_request(payload) is distinct from result then raise exception 'IDEMPOTENCY_FAILED';end if;
   rev:=rev+1;
  end loop;
 end loop;
 begin
  perform public.appearance_request(jsonb_build_object('op','appearance-set','settings',jsonb_set(cfg,'{avatar}','"lumi"'),'expectedRevision',rev,'requestId',gen_random_uuid()));
  raise exception 'CROSS_THEME_ACCEPTED';
 exception when raise_exception then if sqlerrm<>'INVALID_REQUEST' then raise;end if;end;
 begin
  perform public.appearance_request(jsonb_build_object('op','appearance-set','settings',jsonb_set(cfg,'{background}','"https://external.invalid"'),'expectedRevision',rev,'requestId',gen_random_uuid()));
  raise exception 'EXTERNAL_URL_ACCEPTED';
 exception when raise_exception then if sqlerrm<>'INVALID_REQUEST' then raise;end if;end;
 begin
  perform public.appearance_request(jsonb_build_object('op','appearance-set','settings',cfg,'expectedRevision',rev-1,'requestId',gen_random_uuid()));
  raise exception 'STALE_REVISION_ACCEPTED';
 exception when raise_exception then if sqlerrm<>'STALE_DATA' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',b::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated','iat',iat)::text,true);
 result:=public.appearance_request('{"op":"appearance-get"}');
 if result->'settings'->>'theme'<>'growth' or (result->>'revision')::bigint<>0 then raise exception 'OWNER_ISOLATION_FAILED';end if;
 if exists(select 1 from public.account_appearance where user_id=b) then raise exception 'READ_INITIALIZED_DATA';end if;
 if has_function_privilege('anon','public.appearance_request(jsonb)','execute') or not has_function_privilege('authenticated','public.appearance_request(jsonb)','execute') or has_table_privilege('authenticated','public.account_appearance','select') then raise exception 'ACL_CHANGED';end if;
end $$;
select 'passed' as catalog_save_18_combinations,'passed' as idempotency,'passed' as owner_isolation,'passed' as cross_theme_rejection,'passed' as external_url_rejection,'passed' as stale_revision_rejection,
 has_function_privilege('anon','public.appearance_request(jsonb)','execute') as anonymous_allowed,
 has_function_privilege('authenticated','public.appearance_request(jsonb)','execute') as member_allowed,
 has_table_privilege('authenticated','public.account_appearance','select') as direct_table_read_allowed;
rollback;
