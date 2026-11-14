ALTER TABLE events DROP CONSTRAINT events_type_check;
ALTER TABLE events ADD CONSTRAINT events_type_check CHECK (type IN (
  'page_view','content_open','content_impression','playback_start','playback_progress','share','click','custom','scroll'
));
-- Each scope/threshold is observed at most once within a page-view instance,
-- even if a sender mistakenly regenerates an event ID when retrying it.
CREATE UNIQUE INDEX events_scroll_milestone ON events(project_id,session_id,(payload->>'viewId'),(payload->>'scopeId'),(payload->>'milestone')) WHERE type='scroll';
