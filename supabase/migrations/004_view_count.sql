alter table sessions add column if not exists view_count integer not null default 0;

create or replace function increment_view_count(session_id uuid)
returns void
language sql
as $$
  update sessions set view_count = view_count + 1 where id = session_id;
$$;
