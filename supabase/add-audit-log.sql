-- Simple write-audit log. Every meaningful mutation (odds save, draft save,
-- invite add/remove) gets a row here so we can see who did what when.

create table if not exists audit_log (
  id bigserial primary key,
  actor_id uuid references auth.users(id) on delete set null,
  actor_email citext,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  ok boolean not null default true,
  error_msg text,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_at_idx on audit_log(created_at desc);
create index if not exists audit_log_actor_idx on audit_log(actor_id);
create index if not exists audit_log_action_idx on audit_log(action);

alter table audit_log enable row level security;

-- Admins can read their team's log. Service role (server actions) writes.
drop policy if exists "audit_log admin read" on audit_log;
create policy "audit_log admin read" on audit_log
  for select using (
    exists (select 1 from app_users a where a.id = auth.uid() and a.role = 'admin')
  );
