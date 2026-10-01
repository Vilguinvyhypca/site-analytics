CREATE TABLE workspace_metadata (
  key text PRIMARY KEY,
  value text NOT NULL
);
INSERT INTO workspace_metadata (key, value) VALUES ('schema_stage', 'day-two-workspace');
