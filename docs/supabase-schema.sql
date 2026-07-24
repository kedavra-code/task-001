create table if not exists public.tasks (
  id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  task_code text not null,
  handlungsdruck text,
  risiko text,
  impact text,
  wann text,
  prio text,
  task text not null,
  beschreibung text,
  comments jsonb not null default '[]'::jsonb,
  subtasks text[] not null default '{}',
  tags text[] not null default '{}',
  google_status text,
  startdatum date,
  faellig date,
  created_at timestamptz not null default now(),
  completed_at date,
  deleted_at date,
  updated_at timestamptz not null default now()
);

alter table public.tasks
add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.tasks
add column if not exists subtasks text[] not null default '{}';

alter table public.tasks
add column if not exists comments jsonb not null default '[]'::jsonb;

alter table public.tasks
add column if not exists tags text[] not null default '{}';

alter table public.tasks
add column if not exists completed_at date;

alter table public.tasks
add column if not exists deleted_at date;

alter table public.tasks
add column if not exists created_at timestamptz not null default now();

alter table public.tasks enable row level security;

create index if not exists tasks_user_id_idx on public.tasks (user_id);
create index if not exists tasks_task_code_idx on public.tasks (task_code);
create index if not exists tasks_wann_idx on public.tasks (wann);
create index if not exists tasks_google_status_idx on public.tasks (google_status);
create index if not exists tasks_completed_at_idx on public.tasks (completed_at);
create index if not exists tasks_created_at_idx on public.tasks (created_at);
create index if not exists tasks_tags_idx on public.tasks using gin (tags);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  selected_tag_tabs text[] not null default '{}',
  available_tags text[] not null default '{}',
  tooltips_enabled boolean default true,
  dark_mode boolean default false,
  dark_mode_browser boolean default false,
  dark_mode_mobile boolean default false,
  edit_section_defaults jsonb not null default '{"version":5,"browser":{"parameters":true,"description":true,"comments":true,"subtasks":true},"mobile":{"parameters":true,"description":true,"comments":true,"subtasks":true}}'::jsonb,
  tab_layout jsonb not null default '[]'::jsonb,
  card_badge_columns jsonb not null default '{"overview":"default","edit":"default","kanban":"default"}'::jsonb,
  default_view_mode text not null default 'kanban',
  default_view_mode_mobile text not null default 'kanban',
  default_start_tab text not null default 'active',
  default_start_tab_mobile text not null default 'active',
  kanban_columns jsonb not null default '["open","started","done"]'::jsonb,
  upcoming_badge_defaults jsonb not null default '{"version":2,"browser":false,"mobile":false,"dependenciesBrowser":false,"dependenciesMobile":false}'::jsonb,
  deleted_retention_days integer not null default 30,
  updated_at timestamptz not null default now()
);

alter table public.user_settings
add column if not exists selected_tag_tabs text[] not null default '{}';

alter table public.user_settings
add column if not exists available_tags text[] not null default '{}';

alter table public.user_settings
add column if not exists updated_at timestamptz not null default now();

alter table public.user_settings
add column if not exists tooltips_enabled boolean default true;

alter table public.user_settings
add column if not exists dark_mode boolean default false;

alter table public.user_settings
add column if not exists dark_mode_browser boolean default false;

alter table public.user_settings
add column if not exists dark_mode_mobile boolean default false;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_settings'
      and column_name = 'dark_mode'
  ) then
    update public.user_settings
    set dark_mode_browser = true,
        dark_mode_mobile = true
    where dark_mode is true
      and dark_mode_browser is false
      and dark_mode_mobile is false;
  end if;
end $$;

alter table public.user_settings
add column if not exists edit_section_defaults jsonb not null default '{"version":5,"browser":{"parameters":true,"description":true,"comments":true,"subtasks":true},"mobile":{"parameters":true,"description":true,"comments":true,"subtasks":true}}'::jsonb;

alter table public.user_settings
add column if not exists tab_layout jsonb not null default '[]'::jsonb;

alter table public.user_settings
add column if not exists card_badge_columns jsonb not null default '{"overview":"default","edit":"default","kanban":"default"}'::jsonb;

alter table public.user_settings
alter column card_badge_columns set default '{"overview":"default","edit":"default","kanban":"default"}'::jsonb;

alter table public.user_settings
add column if not exists default_view_mode text not null default 'kanban';

alter table public.user_settings
alter column default_view_mode set default 'kanban';

alter table public.user_settings
add column if not exists default_view_mode_mobile text not null default 'kanban';

-- 'active' is the only valid value since the Upcoming tab was removed; kept as a column for compatibility.
alter table public.user_settings
add column if not exists default_start_tab text not null default 'active';

alter table public.user_settings
add column if not exists default_start_tab_mobile text not null default 'active';

alter table public.user_settings
add column if not exists kanban_columns jsonb not null default '["open","started","done"]'::jsonb;

alter table public.user_settings
add column if not exists upcoming_badge_defaults jsonb not null default '{"version":2,"browser":false,"mobile":false,"dependenciesBrowser":false,"dependenciesMobile":false}'::jsonb;

alter table public.user_settings
add column if not exists deleted_retention_days integer not null default 30;


alter table public.user_settings enable row level security;

-- Retired columns, kept unused for a while after each feature was removed; dropped 2026-07-24.
-- Safe to run repeatedly and on fresh installs (no-op there since the columns are never created above).
alter table public.tasks drop column if exists bearbeitbarkeit;
alter table public.tasks drop column if exists bearbeiter;
alter table public.tasks drop column if exists dispatch_status;
alter table public.tasks drop column if exists follow_up_date;
alter table public.tasks drop column if exists depends_on_task_id;
alter table public.tasks drop column if exists depends_on_task_ids;
alter table public.user_settings drop column if exists browser_compact_view;
alter table public.user_settings drop column if exists master_dispatcher_name;
alter table public.user_settings drop column if exists due_reminder_order;

create table if not exists public.task_subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id text not null references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position integer not null default 0,
  title text not null,
  is_done boolean not null default false,
  startdatum date,
  faellig date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_subtasks_due_after_start check (
    startdatum is null
    or faellig is null
    or faellig >= startdatum
  )
);

alter table public.task_subtasks enable row level security;

create table if not exists public.allowed_users (
  email text primary key,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.allowed_users enable row level security;

insert into public.allowed_users (email)
values ('miro@pixelina.me')
on conflict (email) do nothing;

create index if not exists user_settings_selected_tag_tabs_idx
on public.user_settings using gin (selected_tag_tabs);

create index if not exists user_settings_available_tags_idx
on public.user_settings using gin (available_tags);

create index if not exists task_subtasks_task_id_idx
on public.task_subtasks (task_id);

create index if not exists task_subtasks_user_id_idx
on public.task_subtasks (user_id);

with ranked_task_subtasks_by_content as (
  select
    id,
    row_number() over (
      partition by
        user_id,
        task_id,
        lower(btrim(title)),
        is_done,
        coalesce(startdatum, date '0001-01-01'),
        coalesce(faellig, date '0001-01-01')
      order by position asc, updated_at desc, created_at desc, id desc
    ) as duplicate_rank
  from public.task_subtasks
)
delete from public.task_subtasks
using ranked_task_subtasks_by_content
where public.task_subtasks.id = ranked_task_subtasks_by_content.id
  and ranked_task_subtasks_by_content.duplicate_rank > 1;

with ranked_task_subtasks as (
  select
    id,
    row_number() over (
      partition by user_id, task_id, position
      order by updated_at desc, created_at desc, id desc
    ) as duplicate_rank
  from public.task_subtasks
)
delete from public.task_subtasks
using ranked_task_subtasks
where public.task_subtasks.id = ranked_task_subtasks.id
  and ranked_task_subtasks.duplicate_rank > 1;

create unique index if not exists task_subtasks_user_task_position_key
on public.task_subtasks (user_id, task_id, position);

create or replace function public.is_allowed_user()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'miro@pixelina.me'
    or exists (
      select 1
      from public.allowed_users
      where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
$$;

create or replace function public.is_allowed_email(candidate_email text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    lower(coalesce(candidate_email, '')) = 'miro@pixelina.me'
    or exists (
      select 1
      from public.allowed_users
      where lower(email) = lower(coalesce(candidate_email, ''))
    );
$$;

create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate_email text;
begin
  candidate_email := lower(coalesce(event -> 'user' ->> 'email', ''));

  if public.is_allowed_email(candidate_email) then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'Dieser Account ist fuer task-001 nicht freigegeben.'
    )
  );
end;
$$;

create or replace function public.hook_custom_access_token(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate_email text;
begin
  candidate_email := lower(coalesce(event -> 'claims' ->> 'email', event -> 'user' ->> 'email', ''));

  if public.is_allowed_email(candidate_email) then
    return jsonb_build_object('claims', event -> 'claims');
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'Dieser Account ist fuer task-001 nicht freigegeben.'
    )
  );
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
grant execute on function public.hook_custom_access_token(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_before_user_created(jsonb) from authenticated, anon, public;
revoke execute on function public.hook_custom_access_token(jsonb) from authenticated, anon, public;

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'tasks_set_updated_at'
  ) then
    create trigger tasks_set_updated_at
    before update on public.tasks
    for each row
    execute function public.set_updated_at();
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'user_settings_set_updated_at'
  ) then
    create trigger user_settings_set_updated_at
    before update on public.user_settings
    for each row
    execute function public.set_updated_at();
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'task_subtasks_set_updated_at'
  ) then
    create trigger task_subtasks_set_updated_at
    before update on public.task_subtasks
    for each row
    execute function public.set_updated_at();
  end if;
end $$;

drop policy if exists "Allow authenticated users to read tasks" on public.tasks;

create policy "Allow authenticated users to read tasks"
on public.tasks
for select
to authenticated
using (user_id = auth.uid() and public.is_allowed_user());

drop policy if exists "Allow authenticated users to manage own settings" on public.user_settings;

create policy "Allow authenticated users to manage own settings"
on public.user_settings
for all
to authenticated
using (user_id = auth.uid() and public.is_allowed_user())
with check (user_id = auth.uid() and public.is_allowed_user());

drop policy if exists "Allow authenticated users to read own subtasks" on public.task_subtasks;

create policy "Allow authenticated users to read own subtasks"
on public.task_subtasks
for select
to authenticated
using (user_id = auth.uid() and public.is_allowed_user());

drop policy if exists "Allow authenticated users to insert own subtasks" on public.task_subtasks;

create policy "Allow authenticated users to insert own subtasks"
on public.task_subtasks
for insert
to authenticated
with check (user_id = auth.uid() and public.is_allowed_user());

drop policy if exists "Allow authenticated users to update own subtasks" on public.task_subtasks;

create policy "Allow authenticated users to update own subtasks"
on public.task_subtasks
for update
to authenticated
using (user_id = auth.uid() and public.is_allowed_user())
with check (user_id = auth.uid() and public.is_allowed_user());

drop policy if exists "Allow authenticated users to delete own subtasks" on public.task_subtasks;

create policy "Allow authenticated users to delete own subtasks"
on public.task_subtasks
for delete
to authenticated
using (user_id = auth.uid() and public.is_allowed_user());

drop policy if exists "Allow authenticated users to insert tasks" on public.tasks;

create policy "Allow authenticated users to insert tasks"
on public.tasks
for insert
to authenticated
with check (user_id = auth.uid() and public.is_allowed_user());

drop policy if exists "Allow authenticated users to update tasks" on public.tasks;

create policy "Allow authenticated users to update tasks"
on public.tasks
for update
to authenticated
using (user_id = auth.uid() and public.is_allowed_user())
with check (user_id = auth.uid() and public.is_allowed_user());

drop policy if exists "Allow authenticated users to delete tasks" on public.tasks;

create policy "Allow authenticated users to delete tasks"
on public.tasks
for delete
to authenticated
using (user_id = auth.uid() and public.is_allowed_user());

drop policy if exists "Allow users to read own access row and admin all access rows" on public.allowed_users;

create policy "Allow users to read own access row and admin all access rows"
on public.allowed_users
for select
to authenticated
using (
  lower(email) = lower(auth.jwt() ->> 'email')
  or lower(auth.jwt() ->> 'email') = 'miro@pixelina.me'
);

drop policy if exists "Allow admin to insert access rows" on public.allowed_users;

create policy "Allow admin to insert access rows"
on public.allowed_users
for insert
to authenticated
with check (lower(auth.jwt() ->> 'email') = 'miro@pixelina.me');

drop policy if exists "Allow admin to update access rows" on public.allowed_users;

create policy "Allow admin to update access rows"
on public.allowed_users
for update
to authenticated
using (lower(auth.jwt() ->> 'email') = 'miro@pixelina.me')
with check (lower(auth.jwt() ->> 'email') = 'miro@pixelina.me');

drop policy if exists "Allow admin to delete access rows" on public.allowed_users;

create policy "Allow admin to delete access rows"
on public.allowed_users
for delete
to authenticated
using (
  lower(auth.jwt() ->> 'email') = 'miro@pixelina.me'
  and lower(email) <> 'miro@pixelina.me'
);
