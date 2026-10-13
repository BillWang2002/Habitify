-- Selected Habitify-dev only. Synthetic users, funding and purchases are rolled back.
begin;
do $$
declare a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();s jsonb;p jsonb;r jsonb;iat bigint:=extract(epoch from now())::bigint+1;
begin
 if has_function_privilege('anon','public.reward_request(jsonb)','execute') or not has_function_privilege('authenticated','public.reward_request(jsonb)','execute')
 or has_function_privilege('authenticated','public.habit_snapshot(uuid,date)','execute')
 or has_table_privilege('authenticated','public.reward_purchases','select') or has_table_privilege('authenticated','public.reward_purchases','insert') then raise exception 'GRANT_FAILED';end if;
 insert into auth.users(id,email,created_at,updated_at) values(a,'redeem-a-'||a::text||'@example.invalid',now(),now()),(b,'redeem-b-'||b::text||'@example.invalid',now(),now());
 perform set_config('request.jwt.claim.sub',a::text,true);perform set_config('request.jwt.claim.iat',iat::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated','iat',iat)::text,true);
 s:=public.habitify_request('{"op":"snapshot","timezone":"Australia/Sydney"}');
 if jsonb_array_length(s->'rewardCatalog')<>3 or (select price from public.reward_catalog where id='snack')<>155 or (select price from public.reward_catalog where id='coffee')<>310 or (select price from public.reward_catalog where id='milk-tea')<>310 then raise exception 'CATALOG_FAILED';end if;
 insert into public.coin_ledger(user_id,node,day,delta,rule_version) values(a,'verification-funding',(s->>'today')::date,500,1);
 p:=jsonb_build_object('op','reward-purchase','productId','snack','expectedPrice',155,'requestId',gen_random_uuid(),'day',s->>'today','revision',s->'revision','timezone','Australia/Sydney');r:=public.reward_request(p);
 if (r->>'balance')::int<>345 or jsonb_array_length(r->'purchases')<>1 then raise exception 'PURCHASE_FAILED';end if;
 if public.reward_request(p) is distinct from r then raise exception 'RETRY_FAILED';end if;
 begin perform public.reward_request(p||jsonb_build_object('expectedPrice',1));raise exception 'REUSE_ACCEPTED';exception when raise_exception then if sqlerrm<>'REQUEST_REUSED' then raise;end if;end;
 p:=p||jsonb_build_object('revision',r->'revision','requestId',gen_random_uuid());
 begin perform public.reward_request(p||jsonb_build_object('expectedPrice',1));raise exception 'PRICE_ACCEPTED';exception when raise_exception then if sqlerrm<>'PRICE_CHANGED' then raise;end if;end;
 r:=public.reward_request(p||jsonb_build_object('productId','coffee','expectedPrice',310));
 begin perform public.reward_request(p||jsonb_build_object('revision',r->'revision','requestId',gen_random_uuid()));raise exception 'OVERDRAW_ACCEPTED';exception when raise_exception then if sqlerrm<>'INSUFFICIENT_COINS' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',b::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated','iat',iat)::text,true);
 s:=public.habitify_request('{"op":"snapshot","timezone":"Australia/Sydney"}');if (s->>'balance')::int<>0 or jsonb_array_length(s->'purchases')<>0 then raise exception 'ISOLATION_FAILED';end if;
end $$;
rollback;
select 'PASS: catalog, purchase, retry, trusted price, insufficient balance, own receipts, grants; rolled back' as verification;
