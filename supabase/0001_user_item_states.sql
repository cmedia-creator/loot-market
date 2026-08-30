-- LOOT MARKET / Supabase Auth collection schema
-- Product / dungeon content remains in Cloudflare D1.
-- Supabase stores only per-user collection state.

create table if not exists public.user_item_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,
  discovered_at timestamptz,
  wanted boolean not null default false,
  owned boolean not null default false,
  saved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id),
  constraint user_item_states_item_id_length check (char_length(item_id) between 1 and 120)
);

create index if not exists user_item_states_wanted_idx
  on public.user_item_states (user_id)
  where wanted = true;

create index if not exists user_item_states_saved_idx
  on public.user_item_states (user_id)
  where saved = true;

alter table public.user_item_states enable row level security;

revoke all on table public.user_item_states from anon;
grant select, insert, update, delete on table public.user_item_states to authenticated;

drop policy if exists "users_select_own_item_states" on public.user_item_states;
create policy "users_select_own_item_states"
on public.user_item_states
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "users_insert_own_item_states" on public.user_item_states;
create policy "users_insert_own_item_states"
on public.user_item_states
for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "users_update_own_item_states" on public.user_item_states;
create policy "users_update_own_item_states"
on public.user_item_states
for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "users_delete_own_item_states" on public.user_item_states;
create policy "users_delete_own_item_states"
on public.user_item_states
for delete
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
