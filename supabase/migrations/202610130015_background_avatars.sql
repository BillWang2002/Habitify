begin;
-- Tie every avatar to its background; keep the existing owner-only RPC and ACL.
create or replace function public.appearance_request(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); row public.account_appearance; cfg jsonb; rid uuid; expected bigint;
 defaults constant jsonb:='{"theme":"growth","background":"plain","surface":"paper","avatar":"growth","mode":"system"}';
begin
 if not public.habit_account_allowed(uid,(auth.jwt()->>'iat')::bigint) then raise exception 'LOGIN_REQUIRED'; end if;
 if p is null or jsonb_typeof(p)<>'object' or p->>'op' not in ('appearance-get','appearance-set') or p->>'op' is null then raise exception 'INVALID_REQUEST'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 if not public.habit_account_allowed(uid,(auth.jwt()->>'iat')::bigint) then raise exception 'LOGIN_REQUIRED'; end if;
 select * into row from public.account_appearance where user_id=uid;
 if p->>'op'='appearance-get' then
  if exists(select 1 from jsonb_object_keys(p) k where k<>'op') then raise exception 'INVALID_REQUEST'; end if;
  return jsonb_build_object('settings',coalesce(row.settings,defaults),'revision',coalesce(row.revision,0));
 end if;
 if exists(select 1 from jsonb_object_keys(p) k where k not in ('op','settings','requestId','expectedRevision')) then raise exception 'INVALID_REQUEST'; end if;
 cfg:=p->'settings';rid:=(p->>'requestId')::uuid;expected:=(p->>'expectedRevision')::bigint;
 if rid is null or expected is null or expected<0 or cfg is null or jsonb_typeof(cfg)<>'object' then raise exception 'INVALID_REQUEST'; end if;
 -- Older clients may still send the removed generic avatar IDs. Map only those legacy IDs.
 if cfg->>'avatar' in ('default','star') or (cfg->>'theme'='growth' and cfg->>'avatar'='lumi') then
  cfg:=jsonb_set(cfg,'{avatar}',to_jsonb((case when cfg->>'theme'='lumi' then 'lumi' when cfg->>'theme'='duckyo' then 'duckyo-work' else 'growth' end)::text),false);
 end if;
 if (select count(*) from jsonb_object_keys(cfg))<>5 or exists(select 1 from jsonb_each(cfg) t where jsonb_typeof(t.value)<>'string')
 or coalesce(cfg->>'theme','') not in ('growth','lumi','duckyo') or coalesce(cfg->>'avatar','') not in ('growth','lumi','lumi-meadow','lumi-harbor','lumi-library','duckyo-work','duckyo-study','duckyo-phone','duckyo-snack','duckyo-cake','duckyo-meal') or coalesce(cfg->>'mode','') not in ('system','light','dark')
 or (cfg->>'theme'='growth' and (coalesce(cfg->>'background','')<>'plain' or coalesce(cfg->>'surface','')<>'paper' or coalesce(cfg->>'avatar','')<>'growth'))
 or (cfg->>'theme'='lumi' and (coalesce(cfg->>'background','') not in ('garden','sky','meadow','harbor','library') or coalesce(cfg->>'surface','') not in ('paper','glass') or coalesce(cfg->>'avatar','') not in ('lumi','lumi-meadow','lumi-harbor','lumi-library')))
 or (cfg->>'theme'='duckyo' and (coalesce(cfg->>'background','') not in ('duckyo-study','duckyo-work','duckyo-phone','duckyo-snack','duckyo-cake','duckyo-meal') or coalesce(cfg->>'surface','') not in ('paper','glass') or coalesce(cfg->>'avatar','') not in ('duckyo-work','duckyo-study','duckyo-phone','duckyo-snack','duckyo-cake','duckyo-meal')))
 then raise exception 'INVALID_REQUEST';end if;
 -- Accept former same-theme choices for old clients, but always store the
 -- background's canonical avatar. Removed meal backgrounds fall back to study.
 if cfg->>'theme'='duckyo' and cfg->>'background'='duckyo-meal' then
  cfg:=jsonb_set(cfg,'{background}','"duckyo-study"',false);
 end if;
 cfg:=jsonb_set(cfg,'{avatar}',to_jsonb((case
  when cfg->>'theme'='growth' then 'growth'
  when cfg->>'theme'='duckyo' then cfg->>'background'
  when cfg->>'background'='meadow' then 'lumi-meadow'
  when cfg->>'background'='harbor' then 'lumi-harbor'
  when cfg->>'background'='library' then 'lumi-library'
  else 'lumi' end)::text),false);
 if row.last_request=rid then
  if row.last_payload is distinct from p then raise exception 'REQUEST_REUSED';end if;
  return jsonb_build_object('settings',row.settings,'revision',row.revision);
 end if;
 if coalesce(row.revision,0)<>expected then raise exception 'STALE_DATA';end if;
 insert into public.account_appearance(user_id,settings,revision,last_request,last_payload) values(uid,cfg,expected+1,rid,p)
 on conflict(user_id) do update set settings=excluded.settings,revision=excluded.revision,last_request=excluded.last_request,last_payload=excluded.last_payload,updated_at=now()
 returning * into row;
 return jsonb_build_object('settings',row.settings,'revision',row.revision);
end $$;
-- CREATE OR REPLACE retains the existing authenticated-only function ACL.
-- Normalize saved appearances atomically. Only changed rows get a new CAS
-- revision; clear old fingerprints so open clients must reload before writing.
-- Use the same per-account lock as the RPC, including accounts without a
-- saved appearance, so in-flight writes cannot overwrite migrated revisions.
do $$ declare uid uuid; begin
 for uid in select id from auth.users order by id loop
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 end loop;
end $$;
with backgrounds as (
 select user_id,settings,case when settings->>'theme'='duckyo' and settings->>'background'='duckyo-meal'
  then jsonb_set(settings,'{background}','"duckyo-study"',false) else settings end as cfg
 from public.account_appearance
), canonical as (
 select user_id,jsonb_set(cfg,'{avatar}',to_jsonb((case
  when cfg->>'theme'='growth' then 'growth'
  when cfg->>'theme'='duckyo' then cfg->>'background'
  when cfg->>'background'='meadow' then 'lumi-meadow'
  when cfg->>'background'='harbor' then 'lumi-harbor'
  when cfg->>'background'='library' then 'lumi-library'
  else 'lumi' end)::text),false) as cfg from backgrounds
)
update public.account_appearance a set settings=c.cfg,revision=a.revision+1,
 last_request=null,last_payload=null,updated_at=now()
from canonical c where a.user_id=c.user_id and a.settings is distinct from c.cfg;
commit;
