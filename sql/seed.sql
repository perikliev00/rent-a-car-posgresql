INSERT INTO categories (name)
VALUES 
  ('Economy'),
  ('SUV'),
  ('Luxury')
ON CONFLICT (name) DO NOTHING;

INSERT INTO cars (
  name,
  image,
  transmission,
  price,
  price_per_day,
  price_tier_1_3,
  price_tier_7_31,
  price_tier_31_plus,
  seats,
  fuel_type,
  availability,
  category_id
)
VALUES
(
  'Volkswagen Golf 7',
  '/images/golf7.jpg',
  'Manual',
  50.00,
  45.00,
  55.00,
  40.00,
  35.00,
  5,
  'Diesel',
  TRUE,
  (SELECT id FROM categories WHERE name = 'Economy')
),
(
  'BMW 320d',
  '/images/bmw320.jpg',
  'Automatic',
  90.00,
  85.00,
  95.00,
  80.00,
  70.00,
  5,
  'Diesel',
  TRUE,
  (SELECT id FROM categories WHERE name = 'Luxury')
),
(
  'Toyota RAV4',
  '/images/rav4.jpg',
  'Automatic',
  75.00,
  70.00,
  80.00,
  65.00,
  60.00,
  5,
  'Petrol',
  TRUE,
  (SELECT id FROM categories WHERE name = 'SUV')
);