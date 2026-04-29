-- Gate 2: Pattern Confirmation
-- Adds gate number and parent session linkage to sessions,
-- and extends the artifacts type constraint to include 'interviews'.

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS gate integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_session_id uuid REFERENCES sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS sessions_parent_idx ON sessions(parent_session_id);

-- Extend artifacts type constraint to include the new 'interviews' type
ALTER TABLE artifacts DROP CONSTRAINT IF EXISTS artifacts_type_check;
ALTER TABLE artifacts ADD CONSTRAINT artifacts_type_check
  CHECK (type IN ('vision', 'parking_lot', 'actions', 'interviews'));
