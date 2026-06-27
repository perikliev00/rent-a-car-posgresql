# Review26 Models And Utils

Този документ описва persistence слоя и backend helper слоевете.

## 1. Models

### `models/Car.js`

Purpose:

- fleet inventory
- pricing tiers
- public display fields
- confirmed booking windows in `dates`

Important fields:

- `name`
- `image`
- `transmission`
- `price`
- `priceTier_1_3`
- `priceTier_7_31`
- `priceTier_31_plus`
- `seats`
- `fuelType`
- `availability`
- `dates[]`

Important indexes:

- `dates.startDate`
- `dates.endDate`

### `models/Reservation.js`

Purpose:

- temporary session-bound hold
- checkout-in-progress state
- confirmed reservation metadata before final order materialization

Important fields:

- `carId`
- `sessionId`
- `pickupDate`
- `returnDate`
- `pickupLocation`
- `returnLocation`
- `totalPrice`
- contact fields
- `status`
- `holdExpiresAt`
- `stripeSessionId`

Important lifecycle statuses:

- `pending`
- `processing`
- `confirmed`
- `cancelled`
- `expired`

Important indexes:

- `(carId, status, holdExpiresAt)`
- `(sessionId, status, holdExpiresAt)`
- unique sparse `stripeSessionId`

### `models/Order.js`

Purpose:

- confirmed booking record
- admin-created booking record
- persistent business record for bookings

Important fields:

- `reservationId`
- `stripeSessionId`
- `carId`
- booking range
- pricing snapshot
- contact fields
- `status`
- `isDeleted`
- `deletedAt`

Important integrity rule:

- `reservationId` is unique sparse

### `models/ProcessedStripeEvent.js`

Purpose:

- webhook idempotency

Important field:

- unique `eventId`

### `models/User.js`

Purpose:

- login identity
- role-based authorization

Important fields:

- `email`
- `password`
- `role`

### `models/Contact.js`

Purpose:

- public/support contact messages

Important fields:

- `name`
- `email`
- `phone`
- `subject`
- `message`
- `status`

## 2. Utility Groups

### Error / async / transaction helpers

- `utils/appError.js`
- `utils/asyncHandler.js`
- `utils/runWithOptionalTransaction.js`

Roles:

- standard error taxonomy
- async Express wrapper
- optional Mongo transaction support

### Booking helpers

- `utils/bookingValidation.js`
- `utils/bookingSync.js`
- `utils/reservationHelpers.js`
- `utils/parseOrderDates.js`

Roles:

- validate date ranges
- synchronize `Car.dates`
- define active reservation statuses and hold duration
- parse mixed date input formats

### Pricing and fees

- `utils/pricing.js`
- `utils/fees.js`

Roles:

- compute booking totals
- map delivery/return fees by location

### Date/time helpers

- `utils/timeZone.js`
- `utils/dateFormatter.js`
- `utils/date.js`

Roles:

- parse Sofia-local booking dates
- convert dates/locations into UI-friendly strings
- low-level safe date parsing helpers

## 3. Important Utility Relationships

### Pricing chain

- `fees.js` -> consumed by `pricing.js`
- `pricing.js` -> consumed by:
  - search controller
  - order controller
  - payment controller
  - admin order service

### Reservation chain

- `reservationHelpers.js` -> consumed by:
  - booking flow controllers
  - payment controller
  - reservation service
  - booking finalization service
  - admin reservation helper

### Booking sync chain

- `bookingSync.js` -> consumed by:
  - `services/bookingFinalizationService.js`
  - `services/admin/orderAdminService.js`
  - `services/carService.js`
  - `controllers/homeController.js`

### Timezone chain

- `timeZone.js` -> consumed by:
  - booking validation
  - booking sync
  - admin order service

## 4. Why `Car.dates` Exists Beside `Order`

`Order` and `Car.dates` do not duplicate each other accidentally.
They serve different roles:

### `Order`

- full booking record
- customer/admin/business data
- soft delete and status lifecycle

### `Car.dates`

- fast availability blocking structure
- smaller and easier to query for overlap checks

This means synchronization is critical.
That is why:

- admin order service updates `Car.dates`
- booking finalization updates `Car.dates`
- cleanup helpers repair/remove stale windows

## 5. Safety And Integrity Rules

### Reservation hold rule

- active holds are defined by:
  - status in `pending` or `processing`
  - `holdExpiresAt > now`

### Confirmation rule

- confirmed bookings should result in:
  - `Order`
  - `Car.dates` range
  - `Reservation.status = confirmed`

### Webhook idempotency rule

- `ProcessedStripeEvent.eventId` prevents duplicate event handling

### Restore/delete rule

- deleting/restoring admin orders must update both:
  - `Order`
  - `Car.dates`

## 6. Best Reading Order For This Layer

1. `models/Reservation.js`
2. `models/Order.js`
3. `models/Car.js`
4. `utils/reservationHelpers.js`
5. `utils/bookingValidation.js`
6. `utils/pricing.js`
7. `utils/timeZone.js`
8. `utils/bookingSync.js`
9. `utils/appError.js`
10. `utils/runWithOptionalTransaction.js`
