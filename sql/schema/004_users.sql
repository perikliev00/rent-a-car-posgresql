-- Users (auth)
CREATE TABLE IF NOT EXISTS users (
  id         BIGSERIAL PRIMARY KEY,
  email      VARCHAR(255) NOT NULL UNIQUE,
  password   TEXT         NOT NULL,
  role       VARCHAR(20)  NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT users_valid_role CHECK (role IN ('user', 'admin'))
);
