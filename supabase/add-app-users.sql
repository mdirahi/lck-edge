-- Private invite-only auth.
--
-- Two tables:
--   app_invites : pending invites keyed by email (role pre-assigned).
--   app_users   : materialized users keyed by auth.users.id.
--
-- Flow: admin inserts into app_invites. Person signs in via magic link, which
-- creates an auth.users row. A trigger then reads app_invites for their email
-- and, if found, inserts a matching app_users row with the invited role.
-- No invite = no app_users row = callback signs them back out.

create extension if not exists citext;

create table if not exists app_invites (
  email citext primary key,
  role text not null default 'viewer' check (role in ('admin', 'viewer')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext unique not null,
  role text not null default 'viewer' check (role in ('admin', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Bootstrap rahi as an admin invite. First magic link redeems it.
insert into app_invites (email, role)
values ('rahi216326181@gmail.com', 'admin')
on conflict (email) do update set role = excluded.role;

-- On auth.users insert, look up the invite and materialize app_users.
create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invited_role text;
begin
  select role into invited_role from app_invites where email = new.email;
  if invited_role is not null then
    insert into app_users (id, email, role)
    values (new.id, new.email, invited_role)
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_auth_user_created();

-- RLS
alter table app_users enable row level security;
alter table app_invites enable row level security;

drop policy if exists "app_users read authenticated" on app_users;
create policy "app_users read authenticated" on app_users
  for select using (auth.role() = 'authenticated');

drop policy if exists "app_users admin write" on app_users;
create policy "app_users admin write" on app_users
  for all using (
    exists (select 1 from app_users a where a.id = auth.uid() and a.role = 'admin')
  );

drop policy if exists "app_invites admin all" on app_invites;
create policy "app_invites admin all" on app_invites
  for all using (
    exists (select 1 from app_users a where a.id = auth.uid() and a.role = 'admin')
  );

create index if not exists app_users_email_idx on app_users(email);
