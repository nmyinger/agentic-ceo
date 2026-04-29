-- Add gate number and parent session link to sessions
alter table sessions add column gate integer not null default 1;
alter table sessions add column parent_session_id uuid references sessions(id);

-- Add Gate 2 artifact types
alter table artifacts drop constraint artifacts_type_check;
alter table artifacts add constraint artifacts_type_check
  check (type in ('vision', 'parking_lot', 'actions', 'icp', 'interview_script', 'outreach_list'));
