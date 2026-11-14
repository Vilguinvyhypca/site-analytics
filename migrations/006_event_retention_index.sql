-- Retention deletes the oldest received events in bounded batches.
CREATE INDEX events_received_at ON events(received_at);
