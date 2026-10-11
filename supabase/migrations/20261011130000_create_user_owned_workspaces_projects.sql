create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  location text not null default '',
  building_type text not null default '',
  floor_plate_m2 numeric(14, 3) check (floor_plate_m2 is null or floor_plate_m2 > 0),
  floors integer check (floors is null or floors between 1 and 10000),
  study_period_years integer check (study_period_years is null or study_period_years between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  constraint projects_workspace_owner_fk
    foreign key (workspace_id, owner_id)
    references public.workspaces (id, owner_id)
    on delete cascade
);

create table public.project_assessments (
  project_id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  schema_version text not null default '1',
  inputs jsonb not null default '{}'::jsonb check (jsonb_typeof(inputs) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_assessments_payload_size check (pg_column_size(inputs) <= 1048576),
  constraint project_assessments_project_owner_fk
    foreign key (project_id, owner_id)
    references public.projects (id, owner_id)
    on delete cascade
);

create index projects_owner_workspace_updated_idx
  on public.projects (owner_id, workspace_id, updated_at desc);
create index workspaces_owner_idx on public.workspaces (owner_id);
create index projects_workspace_owner_idx on public.projects (workspace_id, owner_id);
create index assessments_owner_idx on public.project_assessments (owner_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;
create trigger workspaces_set_updated_at before update on public.workspaces
  for each row execute function public.set_updated_at();
create trigger projects_set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();
create trigger assessments_set_updated_at before update on public.project_assessments
  for each row execute function public.set_updated_at();

alter table public.workspaces enable row level security;
alter table public.projects enable row level security;
alter table public.project_assessments enable row level security;
alter table public.workspaces force row level security;
alter table public.projects force row level security;
alter table public.project_assessments force row level security;

create policy workspaces_select_own on public.workspaces
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy workspaces_insert_own on public.workspaces
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy workspaces_update_own on public.workspaces
  for update to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy workspaces_delete_own on public.workspaces
  for delete to authenticated using ((select auth.uid()) = owner_id);

create policy projects_select_own on public.projects
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy projects_insert_own on public.projects
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy projects_update_own on public.projects
  for update to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy projects_delete_own on public.projects
  for delete to authenticated using ((select auth.uid()) = owner_id);

create policy assessments_select_own on public.project_assessments
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy assessments_insert_own on public.project_assessments
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy assessments_update_own on public.project_assessments
  for update to authenticated using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy assessments_delete_own on public.project_assessments
  for delete to authenticated using ((select auth.uid()) = owner_id);

revoke all on table public.workspaces, public.projects, public.project_assessments from anon, public;
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.workspaces, public.projects, public.project_assessments to authenticated;
