-- Express sessions (connect-pg-simple)
CREATE TABLE IF NOT EXISTS session (
  sid    VARCHAR     NOT NULL PRIMARY KEY,
  sess   JSON        NOT NULL,
  expire TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_expire ON session (expire);
