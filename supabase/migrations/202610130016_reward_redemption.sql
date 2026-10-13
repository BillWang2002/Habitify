begin;
create table public.reward_catalog (
 id text primary key, name text not null, price integer not null check(price>0), active boolean not null default true
);
insert into public.reward_catalog(id,name,price) values ('snack','零食',155),('milk-tea','奶茶',310),('coffee','咖啡',310);
create table public.reward_purchases (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null, product_id text not null references public.reward_catalog(id),
 product_name text not null, price integer not null check(price>0), payload jsonb not null,
 created_at timestamptz not null default now(), unique(user_id,request_id)
);
create index on public.reward_purchases(user_id,created_at desc);
alter table public.reward_catalog enable row level security;
alter table public.reward_purchases enable row level security;
create policy own_purchases on public.reward_purchases to authenticated using(user_id=(select auth.uid()));
revoke all on public.reward_catalog,public.reward_purchases from public,anon,authenticated;

alter function public.habit_snapshot(uuid,date) rename to habit_snapshot_before_rewards;
revoke all on function public.habit_snapshot_before_rewards(uuid,date) from public,anon,authenticated;
create function public.habit_snapshot(p_uid uuid,p_day date) returns jsonb
language sql security definer set search_path='' as $$
 select public.habit_snapshot_before_rewards(p_uid,p_day) || jsonb_build_object(
 'rewardCatalog',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'price',price) order by id) from public.reward_catalog where active),'[]'::jsonb),
 'purchases',coalesce((select jsonb_agg(jsonb_build_object('id',id,'productId',product_id,'name',product_name,'price',price,'createdAt',created_at) order by created_at desc,id) from public.reward_purchases where user_id=p_uid),'[]'::jsonb));
$$;
revoke all on function public.habit_snapshot(uuid,date) from public,anon,authenticated;

create function public.reward_request(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); s jsonb; product public.reward_catalog; old public.reward_purchases; rid uuid; purchase uuid; balance bigint;
begin
 if not public.habit_account_allowed(uid,(auth.jwt()->>'iat')::bigint) then raise exception 'LOGIN_REQUIRED'; end if;
 if p is null or jsonb_typeof(p)<>'object' or p->>'op' is distinct from 'reward-purchase'
 or p - array['op','timezone','requestId','productId','expectedPrice','day','revision'] <> '{}'::jsonb
 or jsonb_typeof(p->'expectedPrice') is distinct from 'number' then raise exception 'INVALID_REQUEST'; end if;
 rid:=(p->>'requestId')::uuid;
 if rid is null then raise exception 'INVALID_REQUEST'; end if;
 -- Shared with habit mutations and administrator balance adjustments.
 perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
 s:=public.habitify_request(jsonb_build_object('op','snapshot','timezone',p->>'timezone'));
 select * into old from public.reward_purchases where user_id=uid and request_id=rid;
 if found then
  if old.payload<>p then raise exception 'REQUEST_REUSED'; end if;
  return s || jsonb_build_object('purchaseId',old.id);
 end if;
 if exists(select 1 from public.habit_requests where user_id=uid and id=rid) then raise exception 'REQUEST_REUSED'; end if;
 if p->>'day' is distinct from s->>'today' then raise exception 'TODAY_CHANGED'; end if;
 if (p->>'revision')::bigint is distinct from (s->>'revision')::bigint then raise exception 'STALE_DATA'; end if;
 select * into product from public.reward_catalog where id=p->>'productId' and active for share;
 if not found then raise exception 'PRODUCT_UNAVAILABLE'; end if;
 if p->'expectedPrice' is distinct from to_jsonb(product.price) then raise exception 'PRICE_CHANGED'; end if;
 select coalesce(sum(delta),0) into balance from public.coin_ledger where user_id=uid;
 if balance<product.price then raise exception 'INSUFFICIENT_COINS'; end if;
 insert into public.reward_purchases(user_id,request_id,product_id,product_name,price,payload)
 values(uid,rid,product.id,product.name,product.price,p) returning id into purchase;
 insert into public.coin_ledger(user_id,node,day,delta,rule_version)
 values(uid,'purchase:'||purchase::text,(s->>'today')::date,-product.price,1);
 -- The shared journal prevents reuse of a purchase ID for a habit mutation.
 insert into public.habit_requests(user_id,id,payload) values(uid,rid,p);
 update public.habit_profiles set revision=revision+1 where user_id=uid;
 return public.habit_snapshot(uid,(s->>'today')::date) || jsonb_build_object('purchaseId',purchase);
end $$;
revoke all on function public.reward_request(jsonb) from public,anon,authenticated;
grant execute on function public.reward_request(jsonb) to authenticated;
commit;
