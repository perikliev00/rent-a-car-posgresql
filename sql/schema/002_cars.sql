-- Cars
CREATE TABLE IF NOT EXISTS cars (
  id               BIGSERIAL PRIMARY KEY,
  name             VARCHAR(255)  NOT NULL,
  image            TEXT          NOT NULL,
  transmission     VARCHAR(50)   NOT NULL,
  price            NUMERIC(10,2) NOT NULL,
  price_per_day    NUMERIC(10,2),
  price_tier_1_3   NUMERIC(10,2),
  price_tier_7_31  NUMERIC(10,2),
  price_tier_31_plus NUMERIC(10,2),
  seats            INTEGER       NOT NULL,
  fuel_type        VARCHAR(50)   NOT NULL,
  availability     BOOLEAN       NOT NULL DEFAULT TRUE,
  category_id      BIGINT        REFERENCES categories(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT cars_price_positive          CHECK (price >= 0),
  CONSTRAINT cars_price_per_day_positive    CHECK (price_per_day IS NULL OR price_per_day >= 0),
  CONSTRAINT cars_price_tier_1_3_positive   CHECK (price_tier_1_3 IS NULL OR price_tier_1_3 >= 0),
  CONSTRAINT cars_price_tier_7_31_positive  CHECK (price_tier_7_31 IS NULL OR price_tier_7_31 >= 0),
  CONSTRAINT cars_price_tier_31_plus_positive CHECK (price_tier_31_plus IS NULL OR price_tier_31_plus >= 0),
  CONSTRAINT cars_seats_positive            CHECK (seats > 0)
);

CREATE INDEX IF NOT EXISTS idx_cars_category_id   ON cars(category_id);
CREATE INDEX IF NOT EXISTS idx_cars_availability  ON cars(availability);
CREATE INDEX IF NOT EXISTS idx_cars_transmission  ON cars(transmission);
CREATE INDEX IF NOT EXISTS idx_cars_fuel_type     ON cars(fuel_type);
