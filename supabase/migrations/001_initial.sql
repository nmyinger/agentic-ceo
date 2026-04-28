create table sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  idea text,
  status text default 'active' check (status in ('active', 'completed', 'pivoted'))
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

create index messages_session_idx on messages(session_id, created_at);

create table artifacts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade not null,
  type text not null check (type in ('vision', 'parking_lot')),
  content text not null,
  updated_at timestamptz default now(),
  unique (session_id, type)
);

-- Enable realtime on artifacts so the client gets live updates
alter publication supabase_realtime add table artifacts;
