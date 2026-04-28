-- Layer 1: passive viewers see new messages without refresh
alter publication supabase_realtime add table messages;

-- Layer 2: in-progress assistant responses visible to passive viewers
create table live_streams (
  session_id uuid primary key references sessions(id) on delete cascade,
  content text not null default '',
  updated_at timestamptz default now()
);

alter publication supabase_realtime add table live_streams;
