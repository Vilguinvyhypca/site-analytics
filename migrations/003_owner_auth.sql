-- One owner, provisioned outside the public API. No public signup.
CREATE TABLE owner_account (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  password_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE owner_sessions (
  token_hash text PRIMARY KEY CHECK (length(token_hash) = 64),
  owner_id boolean NOT NULL DEFAULT true REFERENCES owner_account(singleton) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX owner_sessions_expiry ON owner_sessions(expires_at);
