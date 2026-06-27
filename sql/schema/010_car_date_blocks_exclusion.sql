-- Prevent double booking at the database level (race-safe for confirmed blocks).
-- Requires btree_gist for GiST equality on car_id combined with range overlap.
CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'no_overlapping_car_blocks'
  ) THEN
    ALTER TABLE car_date_blocks
    ADD CONSTRAINT no_overlapping_car_blocks
    EXCLUDE USING gist (
      car_id WITH =,
      tstzrange(start_date, end_date, '[)') WITH &&
    );
  END IF;
END $$;
