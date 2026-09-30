CREATE TABLE analytics.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  allowed_origins text[] NOT NULL DEFAULT '{}',
  collection_enabled boolean NOT NULL DEFAULT false,
  retention_days integer NOT NULL DEFAULT 90 CHECK (retention_days BETWEEN 1 AND 365),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE analytics.projects IS 'Website projects. Collection is disabled until explicitly configured.';
