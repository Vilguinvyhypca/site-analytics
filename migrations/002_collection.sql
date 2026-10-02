CREATE TABLE projects (
  id text PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 128),
  name text NOT NULL,
  collection_enabled boolean NOT NULL DEFAULT false,
  allowed_origins text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE events (
  project_id text NOT NULL REFERENCES projects(id),
  event_id uuid NOT NULL,
  session_id uuid NOT NULL,
  version integer NOT NULL CHECK (version = 1),
  type text NOT NULL CHECK (type IN ('page_view','content_open','content_impression','playback_start','playback_progress','share')),
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL,
  PRIMARY KEY (project_id, event_id)
);
CREATE INDEX events_project_time ON events(project_id, occurred_at);
CREATE INDEX events_project_session_time ON events(project_id, session_id, occurred_at);
