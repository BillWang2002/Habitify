begin;

create table public.habit_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 timezone text not null, revision bigint not null default 0,
 created_at timestamptz not null default now()
);
create table public.habits (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (char_length(name) between 1 and 30),
 kind text not null check (kind in ('complete','quantity')),
 goal integer not null check (goal between 1 and 100000),
 unit text not null check (char_length(unit) between 1 and 6),
 icon text not null check (icon in ('leaf','book','water','walk','sun','target')),
 note text not null default '' check (char_length(note)<=200),
 position integer not null, archived boolean not null default false,
 start_day date not null, deleted_at timestamptz, deleted_progress integer,
 created_at timestamptz not null default now(),
 unique (id,user_id), check (kind <> 'complete' or (goal=1 and unit='次'))
);
-- Targets are immutable in this phase. Each record snapshots its target for future plan editing.
create table public.habit_records (
 habit_id uuid not null, user_id uuid not null, day date not null,
 goal integer not null check (goal>0), progress integer not null check (progress>=0 and progress<=goal),
 completed_at timestamptz, updated_at timestamptz not null default now(),
 primary key (habit_id,day),
 foreign key (habit_id,user_id) references public.habits(id,user_id) on delete cascade
);
create table public.habit_logs (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 habit_id uuid not null, day date not null, before_value integer not null, after_value integer not null,
 created_at timestamptz not null default now(),
 foreign key (habit_id,user_id) references public.habits(id,user_id) on delete cascade
);
create table public.coin_rules (
 version integer primary key, completion integer not null, first_action integer not null,
 daily_cap integer not null, seven_day integer not null, thirty_day integer not null
);
insert into public.coin_rules values (1,10,5,50,50,150);
create table public.coin_entitlements (
 user_id uuid not null references auth.users(id) on delete cascade,
 node text not null, day date not null, habit_id uuid,
 amount integer not null check (amount>=0), rule_version integer not null references public.coin_rules,
 primary key (user_id,node)
);
create table public.coin_ledger (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 node text not null, day date not null, habit_id uuid, delta integer not null check (delta<>0),
 rule_version integer not null references public.coin_rules,
 created_at timestamptz not null default now()
);
create table public.habit_requests (
 user_id uuid not null references auth.users(id) on delete cascade,
 id uuid not null, payload jsonb not null, created_at timestamptz not null default now(),
 primary key (user_id,id)
);
create index on public.habit_records(user_id,day);
create index on public.habit_logs(user_id,created_at desc);
create index on public.coin_ledger(user_id,day);

alter table public.habit_profiles enable row level security;
alter table public.habits enable row level security;
alter table public.habit_records enable row level security;
alter table public.habit_logs enable row level security;
alter table public.coin_rules enable row level security;
alter table public.coin_entitlements enable row level security;
alter table public.coin_ledger enable row level security;
alter table public.habit_requests enable row level security;
create policy own_profiles on public.habit_profiles to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy own_habits on public.habits to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy own_records on public.habit_records to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy own_logs on public.habit_logs to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy own_entitlements on public.coin_entitlements to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy own_ledger on public.coin_ledger to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
create policy own_requests on public.habit_requests to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
revoke all on public.habit_profiles, public.habits, public.habit_records, public.habit_logs,
 public.coin_rules, public.coin_entitlements, public.coin_ledger, public.habit_requests from public,anon,authenticated;
revoke all on sequence public.habit_logs_id_seq, public.coin_ledger_id_seq from public,anon,authenticated;

-- Private helpers: callers cannot supply another user's ID through a public RPC.
create function public.habit_snapshot(p_uid uuid,p_day date) returns jsonb
language sql security definer set search_path='' as $$
 select jsonb_build_object(
 'today',p_day,'serverTime',now(),'timezone',p.timezone,'revision',p.revision,
 'rules',(select to_jsonb(r) from public.coin_rules r where version=1),
 'balance',coalesce((select sum(delta) from public.coin_ledger where user_id=p_uid),0),
 'todayCoins',coalesce((select sum(amount) from public.coin_entitlements where user_id=p_uid and day=p_day),0),
 'actionDay',exists(select 1 from public.habit_records where user_id=p_uid and day=p_day and progress>=goal),
 'habits',coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'name',h.name,'kind',h.kind,'goal',h.goal,'unit',h.unit,'step',1,'icon',h.icon,'note',h.note,'archived',h.archived,'startDay',h.start_day,'progress',coalesce(r.progress,0)) order by h.position,h.created_at,h.id)
 from public.habits h left join public.habit_records r on r.habit_id=h.id and r.day=p_day where h.user_id=p_uid and h.deleted_at is null),'[]'::jsonb),
 'records',coalesce((select jsonb_agg(jsonb_build_object('habitId',habit_id,'day',day,'goal',goal,'progress',progress)) from public.habit_records where user_id=p_uid),'[]'::jsonb),
 'logs',coalesce((select jsonb_agg(jsonb_build_object('habitId',habit_id,'day',day,'from',before_value,'to',after_value,'at',created_at) order by id) from (select * from public.habit_logs where user_id=p_uid order by id desc limit 200) l),'[]'::jsonb),
 'ledger',coalesce((select jsonb_agg(jsonb_build_object('day',day,'delta',delta,'node',node,'at',created_at) order by id desc) from (select * from public.coin_ledger where user_id=p_uid order by id desc limit 100) l),'[]'::jsonb)
 ) from public.habit_profiles p where user_id=p_uid;
$$;

create function public.habit_reconcile(p_uid uuid,p_day date) returns void
language plpgsql security definer set search_path='' as $$
declare r public.coin_rules; x record; v_amount integer; v_before integer; v_budget integer; v_streak integer; v_start date; v_node text;
begin
 select * into strict r from public.coin_rules where version=1;
 -- Reverse the day's previous allocation and reassign deterministically inside the same transaction.
 -- Only deltas are appended; zero net changes produce no ledger entries.
 v_budget:=r.daily_cap-r.first_action;
 for x in select * from public.habit_records where user_id=p_uid and day=p_day and progress>=goal order by completed_at,habit_id loop
  v_amount:=least(v_budget,r.completion); v_budget:=v_budget-v_amount;
  v_node:='habit:'||x.habit_id||':'||p_day;
  insert into public.coin_entitlements values(p_uid,v_node,p_day,x.habit_id,0,r.version) on conflict do nothing;
  select amount into v_before from public.coin_entitlements where user_id=p_uid and node=v_node;
  if v_before<>v_amount then
   insert into public.coin_ledger(user_id,node,day,habit_id,delta,rule_version) values(p_uid,v_node,p_day,x.habit_id,v_amount-v_before,r.version);
   update public.coin_entitlements set amount=v_amount where user_id=p_uid and node=v_node;
  end if;
 end loop;
 for x in select * from public.coin_entitlements e where e.user_id=p_uid and e.day=p_day and e.habit_id is not null and e.amount>0
 and not exists(select 1 from public.habit_records h where h.habit_id=e.habit_id and h.day=p_day and h.progress>=h.goal) loop
  insert into public.coin_ledger(user_id,node,day,habit_id,delta,rule_version) values(p_uid,x.node,p_day,x.habit_id,-x.amount,x.rule_version);
  update public.coin_entitlements set amount=0 where user_id=p_uid and node=x.node;
 end loop;
 -- Count the uninterrupted run ending today; account action days are derived from actual records.
 with days as (select distinct day from public.habit_records where user_id=p_uid and progress>=goal and day<=p_day),
 numbered as (select day,p_day-day as gap,row_number() over(order by day desc)-1 as sequence from days)
 select count(*) into v_streak from numbered where gap=sequence;
 v_start:=p_day-greatest(v_streak-1,0);
 for x in select * from (values ('first',case when v_streak>0 then r.first_action else 0 end),
 ('seven',case when v_streak>0 and v_streak%7=0 then r.seven_day else 0 end),
 ('thirty',case when v_streak>0 and v_streak%30=0 then r.thirty_day else 0 end)) as awards(kind,amount) loop
  -- Day + reward kind is stable on revoke/re-complete; no new claim is created by toggling.
  v_node:=x.kind||':'||p_day;
  insert into public.coin_entitlements values(p_uid,v_node,p_day,null,0,r.version) on conflict do nothing;
  select amount into v_before from public.coin_entitlements where user_id=p_uid and node=v_node;
  if v_before<>x.amount then
   insert into public.coin_ledger(user_id,node,day,delta,rule_version) values(p_uid,v_node,p_day,x.amount-v_before,r.version);
   update public.coin_entitlements set amount=x.amount where user_id=p_uid and node=v_node;
  end if;
 end loop;
end;
$$;

create function public.habitify_request(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_day date; v_tz text; v_revision bigint; v_op text:=p->>'op'; v_id uuid; v_h public.habits; v_other public.habits; v_before integer; v_value integer; v_payload jsonb; v_request uuid;
begin
 if v_uid is null then raise exception 'LOGIN_REQUIRED'; end if;
 if p is null or jsonb_typeof(p)<>'object' or v_op is null or not v_op=any(array['snapshot','create','progress','archive','move','delete','restore']) then raise exception 'INVALID_REQUEST'; end if;
 -- All requests for one account serialize, including first initialization.
 perform pg_advisory_xact_lock(hashtextextended(v_uid::text,0));
 if not exists(select 1 from public.habit_profiles where user_id=v_uid) then
  v_tz:=p->>'timezone';
  if v_tz is null or not exists(select 1 from pg_timezone_names where name=v_tz) then raise exception 'INVALID_TIMEZONE'; end if;
  insert into public.habit_profiles(user_id,timezone) values(v_uid,v_tz);
 end if;
 select timezone,revision into v_tz,v_revision from public.habit_profiles where user_id=v_uid for update;
 v_day:=(now() at time zone v_tz)::date;
 if v_op='snapshot' then return public.habit_snapshot(v_uid,v_day); end if;
 v_request:=(p->>'requestId')::uuid;
 if v_request is null then raise exception 'INVALID_REQUEST'; end if;
 select payload into v_payload from public.habit_requests where user_id=v_uid and id=v_request;
 if found then
  if v_payload<>p then raise exception 'REQUEST_REUSED'; end if;
  return public.habit_snapshot(v_uid,v_day);
 end if;
 if (p->>'day')::date is distinct from v_day then raise exception 'TODAY_CHANGED'; end if;
 if (p->>'revision')::bigint is distinct from v_revision then raise exception 'STALE_DATA'; end if;
 if v_op='create' then
  if (select count(*) from public.habits where user_id=v_uid and deleted_at is null)>=100 then raise exception 'HABIT_LIMIT'; end if;
  insert into public.habits(user_id,name,kind,goal,unit,icon,note,position,start_day)
  values(v_uid,btrim(p->>'name'),p->>'kind',case when p->>'kind'='complete' then 1 else (p->>'goal')::integer end,
   case when p->>'kind'='complete' then '次' else btrim(p->>'unit') end,p->>'icon',coalesce(btrim(p->>'note'),''),
   coalesce((select max(position)+1 from public.habits where user_id=v_uid),0),v_day);
 else
  v_id:=(p->>'habitId')::uuid;
  select * into v_h from public.habits where id=v_id and user_id=v_uid for update;
  if not found or (v_h.deleted_at is not null and v_op<>'restore') then raise exception 'HABIT_NOT_FOUND'; end if;
  if v_op in ('progress','delete','restore') then
   select progress into v_before from public.habit_records where habit_id=v_id and day=v_day;
   v_before:=coalesce(v_before,0);
   if v_op='progress' then
    if v_h.archived then raise exception 'HABIT_ARCHIVED'; end if;
    v_value:=(p->>'value')::integer;
   elsif v_op='delete' then
    v_value:=0; update public.habits set deleted_at=now(),deleted_progress=v_before where id=v_id;
   else
    if v_h.deleted_at is null or now()-v_h.deleted_at>interval '8 seconds' then raise exception 'RESTORE_EXPIRED'; end if;
    v_value:=v_h.deleted_progress; update public.habits set deleted_at=null,deleted_progress=null where id=v_id;
   end if;
   if v_value is null or v_value<0 or v_value>v_h.goal then raise exception 'INVALID_PROGRESS'; end if;
   if v_value<>v_before then
    insert into public.habit_records(habit_id,user_id,day,goal,progress,completed_at) values(v_id,v_uid,v_day,v_h.goal,v_value,case when v_value>=v_h.goal then now() end)
    on conflict(habit_id,day) do update set progress=excluded.progress,updated_at=now(),completed_at=case when excluded.progress>=habit_records.goal then coalesce(habit_records.completed_at,now()) end;
    insert into public.habit_logs(user_id,habit_id,day,before_value,after_value) values(v_uid,v_id,v_day,v_before,v_value);
   end if;
  elsif v_op='archive' then
   if jsonb_typeof(p->'archived') is distinct from 'boolean' then raise exception 'INVALID_REQUEST'; end if;
   update public.habits set archived=(p->>'archived')::boolean where id=v_id;
  elsif v_op='move' then
   if (p->>'direction') not in ('1','-1') or p->>'direction' is null or v_h.archived then raise exception 'INVALID_REQUEST'; end if;
   select * into v_other from public.habits where user_id=v_uid and deleted_at is null and not archived
    and case when p->>'direction'='1' then position>v_h.position else position<v_h.position end
    order by case when p->>'direction'='1' then position else -position end limit 1;
   if found then update public.habits set position=case when id=v_id then v_other.position else v_h.position end where id in (v_id,v_other.id); end if;
  end if;
 end if;
 perform public.habit_reconcile(v_uid,v_day);
 insert into public.habit_requests(user_id,id,payload) values(v_uid,v_request,p);
 update public.habit_profiles set revision=revision+1 where user_id=v_uid;
 return public.habit_snapshot(v_uid,v_day);
end;
$$;
revoke all on function public.habit_snapshot(uuid,date), public.habit_reconcile(uuid,date),public.habitify_request(jsonb) from public,anon,authenticated;
grant execute on function public.habitify_request(jsonb) to authenticated;
commit;
