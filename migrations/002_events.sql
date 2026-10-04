CREATE TABLE analytics.events (
  project_id uuid NOT NULL REFERENCES analytics.projects(id) ON DELETE CASCADE,
  id uuid NOT NULL,
  session_id uuid NOT NULL,
  schema_version smallint NOT NULL CHECK (schema_version = 1),
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 64),
  path text NOT NULL CHECK (char_length(path) BETWEEN 1 AND 512),
  properties jsonb NOT NULL CHECK (jsonb_typeof(properties) = 'object'),
  PRIMARY KEY (project_id, id)
);
CREATE INDEX events_project_time ON analytics.events(project_id, occurred_at);
CREATE INDEX events_project_session_time ON analytics.events(project_id, session_id, occurred_at);
