-- Reservations
CREATE TABLE IF NOT EXISTS reservations (
  id                      BIGSERIAL PRIMARY KEY,
  car_id                  BIGINT        NOT NULL REFERENCES cars(id) ON DELETE RESTRICT,
  session_id              VARCHAR(255)  NOT NULL,
  pickup_date             TIMESTAMPTZ   NOT NULL,
  pickup_time             VARCHAR(10),
  return_date             TIMESTAMPTZ   NOT NULL,
  return_time             VARCHAR(10),
  pickup_location         VARCHAR(255)  NOT NULL,
  return_location         VARCHAR(255)  NOT NULL,
  rental_days             INTEGER       NOT NULL,
  delivery_price          NUMERIC(10,2) NOT NULL DEFAULT 0,
  return_price            NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_price             NUMERIC(10,2) NOT NULL,
  full_name               VARCHAR(255),
  phone_number            VARCHAR(50),
  email                   VARCHAR(255),
  address                 TEXT,
  hotel_name              VARCHAR(255),
  status                  VARCHAR(20)   NOT NULL DEFAULT 'pending',
  hold_expires_at         TIMESTAMPTZ   NOT NULL,
  stripe_session_id       VARCHAR(255),
  stripe_payment_intent_id VARCHAR(255),
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT reservations_rental_days_positive CHECK (rental_days >= 1),
  CONSTRAINT reservations_total_price_positive CHECK (total_price >= 0),
  CONSTRAINT reservations_valid_status CHECK (
    status IN ('pending', 'processing', 'confirmed', 'cancelled', 'expired')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_stripe_session_unique
  ON reservations (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reservations_car_id        ON reservations(car_id);
CREATE INDEX IF NOT EXISTS idx_reservations_session_id    ON reservations(session_id);
CREATE INDEX IF NOT EXISTS idx_reservations_status        ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_reservations_hold_expires  ON reservations(hold_expires_at);
CREATE INDEX IF NOT EXISTS idx_reservations_car_status_hold
  ON reservations(car_id, status, hold_expires_at);
CREATE INDEX IF NOT EXISTS idx_reservations_session_status_hold
  ON reservations(session_id, status, hold_expires_at);
