-- Car date blocks (замества legacy Car.dates[])
CREATE TABLE IF NOT EXISTS car_date_blocks (
  id         BIGSERIAL PRIMARY KEY,
  car_id     BIGINT      NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  start_date TIMESTAMPTZ NOT NULL,
  end_date   TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT car_date_blocks_valid_range CHECK (end_date > start_date)
);

CREATE INDEX IF NOT EXISTS idx_car_date_blocks_car_id     ON car_date_blocks(car_id);
CREATE INDEX IF NOT EXISTS idx_car_date_blocks_start_date ON car_date_blocks(start_date);
CREATE INDEX IF NOT EXISTS idx_car_date_blocks_end_date   ON car_date_blocks(end_date);
