begin;

create or replace function public.infra_health()
returns jsonb language sql stable security invoker set search_path = ''
as $$ select jsonb_build_object('ok', true, 'service', 'habitify-infra', 'server_time', now()); $$;
revoke all on function public.infra_health() from public;
grant execute on function public.infra_health() to anon, authenticated;

create or replace function public.infra_identity()
returns uuid language sql stable security invoker set search_path = ''
as $$ select auth.uid(); $$;
revoke all on function public.infra_identity() from public, anon;
grant execute on function public.infra_identity() to authenticated;

create table public.infra_probes (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.infra_probes enable row level security;
revoke all on public.infra_probes from public, anon, authenticated;
grant select, insert on public.infra_probes to authenticated;
create policy "read own probes" on public.infra_probes for select to authenticated
using ((select auth.uid()) = user_id);
create policy "write own probes" on public.infra_probes for insert to authenticated
with check ((select auth.uid()) = user_id);

commit;
