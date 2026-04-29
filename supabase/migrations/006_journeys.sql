-- Journey is the top-level entity. Gates (sessions) are levels within a journey.

CREATE TABLE journeys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  title       TEXT,
  status      TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'completed', 'abandoned')),
  current_gate INTEGER NOT NULL DEFAULT 1,
  listed      BOOLEAN NOT NULL DEFAULT false,
  view_count  INTEGER NOT NULL DEFAULT 0
);

-- Add journey linkage to sessions
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS journey_id UUID REFERENCES journeys(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS sessions_journey_idx ON sessions(journey_id);

-- Data migration: create a journey for each root session (no parent)
INSERT INTO journeys (id, created_at, title, status, current_gate, listed, view_count)
SELECT
  s.id,
  s.created_at,
  s.idea,
  CASE WHEN s.status = 'completed' THEN 'completed' ELSE 'active' END,
  COALESCE(
    (SELECT MAX(gate) FROM sessions c WHERE c.parent_session_id = s.id),
    s.gate
  ),
  COALESCE(s.listed, false),
  COALESCE(s.view_count, 0)
FROM sessions s
WHERE s.parent_session_id IS NULL;

-- Link root sessions to their own journey (ids match after migration)
UPDATE sessions
SET journey_id = id
WHERE parent_session_id IS NULL;

-- Link child sessions to their root's journey
UPDATE sessions
SET journey_id = parent_session_id
WHERE parent_session_id IS NOT NULL
  AND parent_session_id IN (SELECT id FROM journeys);

-- RPC to safely increment journey view count
CREATE OR REPLACE FUNCTION increment_journey_view_count(journey_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE journeys SET view_count = view_count + 1 WHERE id = journey_id;
$$;
