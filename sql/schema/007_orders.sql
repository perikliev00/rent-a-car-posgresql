-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id                BIGSERIAL PRIMARY KEY,
  reservation_id    BIGINT        REFERENCES reservations(id) ON DELETE SET NULL,
  car_id            BIGINT        NOT NULL REFERENCES cars(id) ON DELETE RESTRICT,
  pickup_date       TIMESTAMPTZ   NOT NULL,
  pickup_time       VARCHAR(10),
  return_date       TIMESTAMPTZ   NOT NULL,
  return_time       VARCHAR(10),
  pickup_location   VARCHAR(255)  NOT NULL,
  return_location   VARCHAR(255)  NOT NULL,
  rental_days       INTEGER       NOT NULL,
  delivery_price    NUMERIC(10,2) NOT NULL DEFAULT 0,
  return_price      NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_price       NUMERIC(10,2) NOT NULL,
  full_name         VARCHAR(255)  NOT NULL,
  phone_number      VARCHAR(50)   NOT NULL,
  email             VARCHAR(255)  NOT NULL,
  address           TEXT          NOT NULL,
  hotel_name        VARCHAR(255),
  stripe_session_id VARCHAR(255),
  status            VARCHAR(20)   NOT NULL DEFAULT 'active',
  expired_at        TIMESTAMPTZ,
  is_deleted        BOOLEAN       NOT NULL DEFAULT FALSE,
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT orders_rental_days_positive CHECK (rental_days >= 1),
  CONSTRAINT orders_total_price_positive CHECK (total_price >= 0),
  CONSTRAINT orders_valid_status CHECK (
    status IN ('pending', 'active', 'expired', 'cancelled')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_reservation_unique
  ON orders (reservation_id)
  WHERE reservation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_car_id         ON orders(car_id);
CREATE INDEX IF NOT EXISTS idx_orders_reservation_id ON orders(reservation_id);
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session ON orders(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_status         ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_is_deleted     ON orders(is_deleted);
