-- ============================================================
-- LuxRide PostgreSQL Schema (orchestrator)
-- ============================================================
--
-- Схемата е разделена в отделни файлове: sql/schema/
--
-- Прилагане:
--   node sql/applySchema.js
--
-- Или с psql (от папка sql/):
--   cd sql
--   psql "%DATABASE_URL%" -f schema.sql
--
-- Ред на зависимости:
--   000 drop legacy bookings
--   001 categories
--   002 cars
--   003 car_date_blocks
--   004 users
--   005 session
--   006 reservations
--   007 orders
--   008 contacts
--   009 processed_stripe_events
--   010 car_date_blocks exclusion constraint

\ir schema/000_drop_legacy_bookings.sql
\ir schema/001_categories.sql
\ir schema/002_cars.sql
\ir schema/003_car_date_blocks.sql
\ir schema/004_users.sql
\ir schema/005_session.sql
\ir schema/006_reservations.sql
\ir schema/007_orders.sql
\ir schema/008_contacts.sql
\ir schema/009_processed_stripe_events.sql
\ir schema/010_car_date_blocks_exclusion.sql
