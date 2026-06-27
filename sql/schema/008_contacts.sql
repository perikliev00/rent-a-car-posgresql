-- Contact form messages
CREATE TABLE IF NOT EXISTS contacts (
  id         BIGSERIAL PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  email      VARCHAR(255) NOT NULL,
  phone      VARCHAR(50),
  subject    VARCHAR(255) NOT NULL,
  message    TEXT         NOT NULL,
  status     VARCHAR(20)  NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT contacts_valid_status CHECK (status IN ('new', 'ready', 'done'))
);

CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
