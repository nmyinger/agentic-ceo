alter table sessions add column if not exists listed boolean not null default false;

create table if not exists reactions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade not null,
  type text not null check (type in ('user', 'investor', 'builder')),
  created_at timestamptz default now()
);

create index if not exists reactions_session_id_type on reactions(session_id, type);

alter publication supabase_realtime add table reactions;
