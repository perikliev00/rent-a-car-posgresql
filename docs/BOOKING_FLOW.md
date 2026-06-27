# Booking Flow

This document is the single source of truth for the customer booking and checkout flow.

---

## 1. Home

- **Route:** `GET /`
- **Controller:** `homeController.getHome`
- **Purpose:** Render landing page with cars, filters, and pagination.
- **Middleware:** CSRF protection, set CSRF token.

---

## 2. Search Cars

- **Route:** `POST /postSearchCars`
- **Controller:** `availableCarsController.postSearchCars`
- **Purpose:** Validate search criteria and return available cars for the selected date/location range.
- **Validation:** `pickup-time`, `return-time` required (express-validator on `carRoutes`).
- **Middleware:** CSRF protection, set CSRF token.

---

## 3. Order Form

- **Route:** `POST /orders`
- **Controller:** `bookingController.getOrderCar` (implemented via `orderCarController.getOrderCar`)
- **Purpose:** Build order view model and place or update a pending reservation hold for the current session. Renders the order page with car details, pricing, and contact form.
- **Middleware:** CSRF protection, set CSRF token.

---

## 4. Reservation Hold Management

### Release active hold

- **Route:** `POST /reservations/release`
- **Controller:** `bookingController.releaseActiveReservation`
- **Purpose:** Release the current session’s active reservation hold.
- **Internal services:** `reservationService.releaseActiveReservationForSession`
- **Middleware:** CSRF protection.

### Release and rehold

- **Route:** `POST /reservations/release-and-rehold`
- **Controller:** `bookingController.releaseAndReholdReservation`
- **Purpose:** Release active hold and create a new pending hold for updated order parameters (e.g. different dates or car).
- **Internal services:** `reservationService.releaseActiveReservationForSession`, `reservationService.checkCarAvailabilityForRange`, `reservationService.createPendingReservation`
- **Validation:** `carId` (MongoId), `pickupDate`, `returnDate`, `pickupTime` / `returnTime` (optional, HH:MM), `pickupLocation`, `returnLocation` (must be in allowed locations list).
- **Middleware:** CSRF protection.

---

## 5. Checkout Session

- **Route:** `POST /create-checkout-session`
- **Controller:** `checkoutController.createCheckoutSession` (implementation in `paymentController` / `controllers/payment.js`)
- **Purpose:** Validate order/contact data, ensure car availability and session hold, create Stripe Checkout session, set reservation to `processing` and `stripeSessionId`, then redirect to Stripe Checkout.
- **Validation:** `fullName`, `phoneNumber` (mobile), `email`, `address`, `hotelName` required.
- **Middleware:** CSRF protection, set CSRF token.

---

## 6. Checkout Success

- **Route:** `GET /success`
- **Controller:** `checkoutController.handleCheckoutSuccess` (implementation in `paymentController`)
- **Purpose:** Called when Stripe redirects after successful payment. Optionally runs sync finalization for the reservation (idempotent). Renders the success page. The **authoritative** finalization is done by the webhook; this path ensures the user sees a success state even if the webhook is delayed.
- **Query:** `session_id` (Stripe Checkout Session ID).
- **Internal services:** `bookingFinalizationService.finalizeReservationByStripeSessionId` (no-op if already confirmed).

---

## 7. Checkout Cancel

- **Route:** `GET /cancel`
- **Controller:** `checkoutController.handleCheckoutCancel` (implementation in `paymentController`)
- **Purpose:** Release the current session’s active reservation and return a cancel message.
- **Internal services:** `reservationService.releaseActiveReservationForSession`

---

## 8. Stripe Webhook

- **Route:** `POST /webhook/stripe`
- **Controller:** `checkoutController.handleStripeWebhook` (implementation in `paymentController`)
- **Mount:** In `server.js` with `express.raw({ type: 'application/json' })` so the raw body is available for signature verification.
- **Purpose:** Handle `checkout.session.completed` asynchronously and finalize the booking idempotently.
- **Flow:**
  1. Verify signature using `STRIPE_WEBHOOK_SECRET` and raw request body.
  2. For `checkout.session.completed`: insert `ProcessedStripeEvent` with `event.id` (unique). On duplicate key, return 200 and skip finalization.
  3. Call `bookingFinalizationService.finalizeReservationByStripeSessionId` with `requireActiveStatus: true` to update `Car.dates`, create `Order`, and set reservation to `confirmed`.
- **Idempotency:** Guaranteed by `ProcessedStripeEvent.eventId` uniqueness; duplicate events are acknowledged with 200 and not processed again.

---

## Route Summary

| Step | Method | Path | Controller action |
|------|--------|------|-------------------|
| 1 | GET | `/` | `homeController.getHome` |
| 2 | POST | `/postSearchCars` | `availableCarsController.postSearchCars` |
| 3 | POST | `/orders` | `bookingController.getOrderCar` |
| 4a | POST | `/reservations/release` | `bookingController.releaseActiveReservation` |
| 4b | POST | `/reservations/release-and-rehold` | `bookingController.releaseAndReholdReservation` |
| 5 | POST | `/create-checkout-session` | `checkoutController.createCheckoutSession` |
| 6 | GET | `/success` | `checkoutController.handleCheckoutSuccess` |
| 7 | GET | `/cancel` | `checkoutController.handleCheckoutCancel` |
| 8 | POST | `/webhook/stripe` | `checkoutController.handleStripeWebhook` |
