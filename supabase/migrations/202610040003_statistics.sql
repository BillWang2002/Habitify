begin;
-- Own historical plans. No direct client access and no new public RPC.
create table public.habit_plan_events (
 habit_id uuid not null, user_id uuid not null, day date not null,
 active boolean not null, goal integer not null check(goal>0),
 primary key(habit_id,day),
 foreign key(habit_id,user_id) references public.habits(id,user_id) on delete cascade
);
alter table public.habit_plan_events enable row level security;
create policy own_plan_events on public.habit_plan_events to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
revoke all on public.habit_plan_events from public,anon,authenticated;

-- A restore cancels pending closure. Closing preserves the current day's plan.
create function public.habit_plan_change(p_id uuid,p_uid uuid,p_day date,p_active boolean,p_goal integer)
returns void language plpgsql security definer set search_path='' as $$
declare effective date:=p_day+case when p_active then 0 else 1 end;
begin
 delete from public.habit_plan_events where habit_id=p_id and day>=effective;
 insert into public.habit_plan_events values(p_id,p_uid,effective,p_active,p_goal)
 on conflict(habit_id,day) do update set active=excluded.active,goal=excluded.goal;
end $$;

-- Replay the existing authenticated request audit before enabling the trigger.
do $$
declare h record; r record; archived boolean; deleted boolean;
begin
 for h in select * from public.habits loop
  archived:=false; deleted:=false;
  insert into public.habit_plan_events values(h.id,h.user_id,h.start_day,true,h.goal);
  for r in select payload from public.habit_requests
   where user_id=h.user_id and payload->>'habitId'=h.id::text
    and payload->>'op' in ('archive','delete','restore')
   order by created_at,(payload->>'revision')::bigint,id loop
   case r.payload->>'op'
    when 'archive' then archived:=(r.payload->>'archived')::boolean;
    when 'delete' then deleted:=true;
    when 'restore' then deleted:=false;
   end case;
   perform public.habit_plan_change(h.id,h.user_id,(r.payload->>'day')::date,not archived and not deleted,h.goal);
  end loop;
 end loop;
end $$;

create function public.habit_track_plan() returns trigger
language plpgsql security definer set search_path='' as $$
declare d date;
begin
 if TG_OP='UPDATE' and new.goal is distinct from old.goal then raise exception 'PLAN_EDIT_NOT_SUPPORTED'; end if;
 if TG_OP='INSERT' then
  insert into public.habit_plan_events values(new.id,new.user_id,new.start_day,not new.archived and new.deleted_at is null,new.goal);
 elsif new.archived is distinct from old.archived or (new.deleted_at is null) is distinct from (old.deleted_at is null) then
  select (now() at time zone timezone)::date into strict d from public.habit_profiles where user_id=new.user_id;
  perform public.habit_plan_change(new.id,new.user_id,d,not new.archived and new.deleted_at is null,new.goal);

 end if;
 return new;
end $$;
create trigger habit_plan_history after insert or update on public.habits for each row execute function public.habit_track_plan();

create function public.habit_statistics_data(p_uid uuid) returns jsonb
language sql security definer set search_path='' as $$
 select jsonb_build_object(
 'habits',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'kind',kind,'goal',goal,'unit',unit,'icon',icon,'archived',archived,'deleted',deleted_at is not null,'startDay',start_day) order by position,created_at,id) from public.habits where user_id=p_uid),'[]'::jsonb),
 'plans',coalesce((select jsonb_agg(jsonb_build_object('habitId',habit_id,'day',day,'active',active,'goal',goal) order by day,habit_id) from public.habit_plan_events where user_id=p_uid),'[]'::jsonb)
 );
$$;
revoke all on function public.habit_plan_change(uuid,uuid,date,boolean,integer),public.habit_track_plan(),public.habit_statistics_data(uuid) from public,anon,authenticated;

create or replace function public.habit_snapshot(p_uid uuid,p_day date) returns jsonb
language sql security definer set search_path='' as $$
 select jsonb_build_object(
 'statistics',public.habit_statistics_data(p_uid),
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

commit;
