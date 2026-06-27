-- Processed Stripe webhook events (idempotency)
CREATE TABLE IF NOT EXISTS processed_stripe_events (
  id                BIGSERIAL PRIMARY KEY,
  event_id          VARCHAR(255) NOT NULL UNIQUE,
  stripe_session_id VARCHAR(255),
  processed_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processed_stripe_events_session
  ON processed_stripe_events(stripe_session_id);
