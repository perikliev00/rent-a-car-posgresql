# Review26 Customer Flow

Този документ описва customer-facing booking flow от landing page до confirmed order.

## 1. Main Files

### Routes

- `routes/carRoutes.js`
- `routes/reservationRoutes.js`
- `routes/paymentRoutes.js`

### Controllers

- `controllers/homeController.js`
- `controllers/availableCars.js`
- `controllers/orderCar.js`
- `controllers/bookingController.js`
- `controllers/payment.js`
- `controllers/checkoutController.js`

### Services

- `services/reservationService.js`
- `services/paymentService.js`
- `services/orderViewModelService.js`
- `services/bookingFinalizationService.js`
- `services/carService.js`

### Models

- `models/Car.js`
- `models/Reservation.js`
- `models/Order.js`
- `models/ProcessedStripeEvent.js`

### Utils

- `utils/pricing.js`
- `utils/bookingValidation.js`
- `utils/reservationHelpers.js`
- `utils/bookingSync.js`
- `utils/dateFormatter.js`
- `utils/timeZone.js`

## 2. Search Flow

### Entry

- `POST /postSearchCars`

### Route target

- `availableCarsController.postSearchCars`

### Main logic

1. route validator checks `pickup-time` and `return-time`
2. controller validates dates again using `validateBookingDates`
3. controller excludes active reservations belonging to other sessions
4. controller excludes overlapping `Car.dates`
5. controller applies transmission/fuel/seats/price filters
6. controller paginates the result
7. controller computes per-car pricing for the selected range
8. controller renders `searchResults`

## 3. Order Page Flow

### Entry

- `POST /orders`

### Route target

- `bookingController.getOrderCar`
- delegated to `orderCarController.getOrderCar`
- actual implementation lives in `controllers/orderCar.js`

### Main logic

1. validate `carId`
2. load `Car`
3. validate booking dates
4. compute price
5. build base order view-model payload
6. check whether current session already has an active reservation
7. if it is exactly the same reservation:
   - render page without creating a new hold
8. if current session has a different active reservation:
   - render warning banner
9. if there is no session reservation:
   - check for overlap against:
     - active reservations
     - `Car.dates`
10. if free:
   - create pending reservation
11. render `orderMain`

## 4. Hold Release Flow

### Release only

- `POST /reservations/release`
- controller: `bookingController.releaseActiveReservation`

Behavior:

- finds active session reservation
- sets status to `cancelled`
- expires hold immediately
- returns JSON or redirect

### Release and re-hold

- `POST /reservations/release-and-rehold`
- controller: `bookingController.releaseAndReholdReservation`

Behavior:

1. validate body
2. load car
3. validate new date range
4. recompute pricing
5. release current hold
6. re-check availability
7. create new pending hold
8. return JSON result

## 5. Checkout Session Flow

### Entry

- `POST /create-checkout-session`

### Controller

- `controllers/payment.js` -> `createCheckoutSession`

### Main logic

1. validate contact payload
2. load car
3. validate booking dates
4. compute authoritative server-side price
5. normalize contact details
6. reuse or create pending reservation
7. create Stripe Checkout session
8. save:
   - `reservation.stripeSessionId`
   - `reservation.status = processing`
9. redirect user to Stripe

### Important safety behavior

- if Stripe session creation fails:
  - reservation is cancelled
  - order page is re-rendered
- if reservation save after Stripe setup fails:
  - controller throws `ExternalServiceError`

## 6. Success Flow

### Entry

- `GET /success?session_id=...`

### Controller

- `payment.handleCheckoutSuccess`

### Behavior

1. read `session_id`
2. call `finalizeReservationByStripeSessionId`
3. if finalization works:
   - render success page
4. if finalization fails in this path:
   - render `Payment Processing`

Important:

- `/success` is a UX-friendly fallback path
- webhook remains the authoritative source of truth

## 7. Stripe Webhook Flow

### Entry

- `POST /webhook/stripe`

### Mounted in

- `server.js`

### Controller

- `payment.handleStripeWebhook`

### Service boundary

- `bookingFinalizationService.processStripeWebhookEvent`

### Behavior

1. verify Stripe signature using raw body
2. read `event.id` and `session.id`
3. process event idempotently
4. inside transaction when supported:
   - insert `ProcessedStripeEvent`
   - finalize reservation
5. return 200 when:
   - duplicate event
   - already confirmed
   - status not active
   - reservation not found
6. throw on true processing failure

## 8. Reservation Finalization Logic

### Authoritative service

- `services/bookingFinalizationService.js`

### Core steps

1. find `Reservation` by `stripeSessionId`
2. find `Order` by `reservationId`
3. if reservation confirmed and order exists:
   - idempotent no-op
4. if reservation is corrupted:
   - throw `AppError`
5. add range to `Car.dates`
6. create `Order`
7. mark `Reservation` as `confirmed`

### Data-level protections

- `Reservation.stripeSessionId` unique sparse
- `Order.reservationId` unique sparse
- `ProcessedStripeEvent.eventId` unique

## 9. Availability Model

The backend uses two layers of availability:

### Temporary availability

- `Reservation`
- status in `pending` / `processing`
- expires via `holdExpiresAt`

### Confirmed availability

- `Car.dates`
- written during finalization or admin order actions

This split is why both `Reservation` and `Car.dates` must be understood together.

## 10. Related Cleanup Jobs

### `services/carService.js`

- removes outdated `Car.dates`

### `services/reservationService.js`

- expires abandoned reservations

Both are started in `server.js` on boot and then repeated on intervals.
