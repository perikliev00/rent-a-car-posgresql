# System Architecture

This document is the **single source of truth** for how the LuxRide rent-a-car application works end-to-end. It describes each controller and function, module responsibilities, the full request lifecycle, and sequential execution flows with clear trigger order.

---

## Table of Contents

1. [High-Level Overview](#1-high-level-overview)
2. [Request Lifecycle (Entry Point to Response)](#2-request-lifecycle-entry-point-to-response)
3. [Module Responsibilities](#3-module-responsibilities)
4. [Controllers and Functions](#4-controllers-and-functions)
5. [Services and Functions](#5-services-and-functions)
6. [Models](#6-models)
7. [Middleware](#7-middleware)
8. [Utils and Config](#8-utils-and-config)
9. [Full Execution Flows](#9-full-execution-flows)
10. [Trigger Order Summary](#10-trigger-order-summary)

---

## 1. High-Level Overview

The application is an **Express.js** server that:

- Serves **EJS** views and static assets.
- Uses **MongoDB** (via Mongoose) for persistence: cars, reservations, orders, users, contacts, sessions, and processed Stripe events.
- Implements **session-bound reservation holds** to prevent double-booking: each hold is tied to a server-side session and expires after idle timeout (default 20 minutes).
- Runs **background housekeeping** every 3 minutes: clean outdated `Car.dates` and mark abandoned reservations as expired.
- Handles **Stripe Checkout** for payment; the **webhook** is the primary path for finalizing bookings (idempotent via `ProcessedStripeEvent`).

**Entry point:** `server.js` — creates the Express app, connects MongoDB, mounts middleware and routes, starts HTTP server and housekeeping intervals.

---

## 2. Request Lifecycle (Entry Point to Response)

Every HTTP request passes through the following steps **in this order**. The first matching route or error handler wins.

| Step | Component | What happens |
|------|-----------|--------------|
| 1 | **Static / webhook** | `express.static('public')` serves files; **only** `POST /webhook/stripe` is handled here with `express.raw({ type: 'application/json' })` and goes directly to `checkoutController.handleStripeWebhook` (no session/body-parser for this route). |
| 2 | **Body parsers** | `bodyParser.urlencoded`, `bodyParser.json()` parse body for all other routes. |
| 3 | **CSP nonce** | Middleware sets `res.locals.cspNonce` (random) for script nonces. |
| 4 | **Security (Helmet)** | `applySecurity(app)` — Helmet with CSP, HSTS (prod), etc. |
| 5 | **Session** | Load or create session from MongoDB store; `rolling: true` refreshes expiry on each request. |
| 6 | **Session defaults** | Set `req.session.isPaid`, mirror `req.session._sid = req.sessionID`. |
| 7 | **Auth in templates** | Set `res.locals.isLoggedIn`, `res.locals.user`. |
| 8 | **CSRF default** | Ensure `res.locals.csrfToken` is defined (e.g. `null` if not set by route). |
| 9 | **Routes** | `carRoutes` → `reservationRoutes` → `paymentRoutes` → `authRoutes` → `adminLimiter` + `adminRoutes` → `supportRoutes` → `footerRoutes`. First matching route runs its middleware chain (e.g. CSRF, validation) then the controller. |
| 10 | **404** | If no route matched, render `error/404`. |
| 11 | **CSRF error** | If `err.code === 'EBADCSRFTOKEN'`, render 403 or JSON. |
| 12 | **Central error** | Log error; render `error/500` with status and message (or 404 if `err.status === 404`). |

**Important:** The Stripe webhook **does not** go through body-parser or session; it uses the raw body for signature verification and is mounted before `bodyParser` in `server.js`.

---

## 3. Module Responsibilities

| Module | Responsibility |
|--------|----------------|
| **server.js** | Bootstrap: static, body parsers, CSP, security, session store, session middleware, route mounting, 404, CSRF error handler, central error handler; connect MongoDB and start housekeeping intervals. |
| **routes/** | Define HTTP method + path, attach middleware (CSRF, validation, rate limit, auth) and controller handlers. No business logic. |
| **controllers/** | Handle HTTP: parse request, call services/utils, set status/headers, render view or send JSON/redirect. Thin layer; business rules live in services. |
| **services/** | Core business logic: reservation hold/release, availability checks, booking finalization, order view model, payment page view model, contact trimming; admin dashboard, orders, cars. |
| **models/** | Mongoose schemas and models (Car, Reservation, Order, User, Contact, ProcessedStripeEvent). |
| **utils/** | Pure helpers: date formatting, timezone (Sofia), pricing, booking date validation, reservation helpers (active statuses, session ID, hold window), Car.dates sync (addRange, purgeExpired, etc.). |
| **middleware/** | Auth (requireAuth, requireGuest, requireAdmin), CSRF (csrfProtection, setCsrfToken), rate limiting (auth, contact, admin), file upload (multer). |
| **config/** | Security (Helmet/CSP), Stripe client. |

---

## 4. Controllers and Functions

### 4.1 homeController

- **getHome(req, res, next)**  
  Renders the landing page (`index`). Optionally runs `purgeExpired()` from `utils/bookingSync`. Builds pagination and filters from query (page, category, transmission, fuelType, seats, price). Queries `Car` with filter, sorts by name, paginates (3 per page). Computes default rental range (today–tomorrow) and attaches `totalPrice` per car. Renders with cars, dates, pagination, and filter state.

### 4.2 availableCarsController / availableCars

- **postSearchCars(req, res, next)**  
  Handles search form submission. Runs express-validator results and `validateBookingDates`; if pickup is today, ensures pickup time is in the future. On validation errors, re-renders `index` with message and form state. On success: gets `sessionId` for current session; finds active reservations (other sessions) overlapping the date range to get `blockedCarIds`; builds MongoDB match (availability, exclude blocked, no overlapping `Car.dates`, optional transmission/fuel/seats/price filters); paginates; computes pricing per car via `computeBookingPrice`; renders `searchResults` with cars, dates, locations, pagination, filters.

### 4.3 orderCarController / orderCar

- **getOrderCar(req, res, next)**  
  Builds the order page for a selected car. Validates `carId`, loads Car, validates booking dates and computes pricing. Builds base payload via `orderViewModelService.buildBaseOrderPayload`. If the session already has an active reservation: if it’s the same car and same dates/times/locations, renders order page without banner and without creating a new reservation; otherwise renders with “complete or release” banner and existing reservation summary. If no conflict: calls `checkCarAvailabilityForRange` (overlapping active reservation or booked `Car.dates`); on overlap returns error message in view. Otherwise calls `createPendingReservation` and renders order page.

### 4.4 bookingController

- **getOrderCar**  
  Delegates to `orderCarController.getOrderCar`.

- **releaseActiveReservation(req, res)**  
  Calls `reservationService.releaseActiveReservationForSession(req)`. If no reservation was cancelled, responds 404 JSON or redirect; otherwise 200 JSON or redirect to `redirect` / referer / `/`.

- **releaseAndReholdReservation(req, res)**  
  Validates body (carId, dates, times, locations). Loads car; validates booking dates; releases current session’s active reservation; checks availability for the new range; creates a new pending reservation. Responds with JSON (success or error).

### 4.5 checkoutController

- **createCheckoutSession**  
  Implemented by `paymentController` (see `controllers/payment.js`).

- **handleCheckoutSuccess**  
  Implemented by `paymentController`.

- **handleCheckoutCancel**  
  Implemented by `paymentController`.

- **handleStripeWebhook**  
  Implemented by `paymentController`.

### 4.6 paymentController / payment.js

- **createCheckoutSession(req, res, next)**  
  Validates form (express-validator). Loads car; validates booking dates and pricing. Gets or updates reservation: if session has active reservation for same car/dates, updates contact and extends hold; else checks availability and creates new pending reservation. Creates Stripe Checkout session; on success sets reservation `stripeSessionId` and `status = 'processing'`, redirects 303 to Stripe URL. On Stripe API error, marks reservation cancelled and re-renders order page with error.

- **handleCheckoutSuccess(req, res, next)**  
  Reads `session_id` from query. Calls `bookingFinalizationService.finalizeReservationByStripeSessionId` (idempotent). Renders `success` view regardless (friendly UX); if reservation already confirmed, still shows success.

- **handleCheckoutCancel(req, res)**  
  Calls `reservationService.releaseActiveReservationForSession(req)` then sends plain text message that payment was cancelled.

- **handleStripeWebhook(req, res)**  
  Verifies Stripe signature with `STRIPE_WEBHOOK_SECRET` and raw body. On `checkout.session.completed`: tries to insert `ProcessedStripeEvent` with `event.id`; on duplicate key (already processed) returns 200 and skips. Otherwise calls `finalizeReservationByStripeSessionId` with `requireActiveStatus: true`. Always responds 200 for the event type to avoid Stripe retries.

### 4.7 contactController

- **getContacts(req, res, next)**  
  Renders `contacts` view.

- **postContact(req, res, next)**  
  Validates form; creates `Contact` document (name, email, phone, subject, message, status: 'new'); re-renders contacts with success message.

- **getAdminContacts(req, res, next)**  
  Admin only. Fetches all contacts sorted by createdAt; renders `admin/contacts`.

- **postUpdateContactStatus(req, res, next)**  
  Admin only. Updates contact status by id; redirects to `/admin/contacts`.

- **postDeleteContact(req, res, next)**  
  Admin only. Deletes contact by id; redirects to `/admin/contacts`.

### 4.8 authController

- **getLogin(req, res)**  
  Renders login page.

- **postLogin(req, res, next)**  
  Validates email/password; finds User by email; compares password with bcrypt; sets `req.session.isLoggedIn`, `req.session.user`; redirects to `/`.

- **getSignup(req, res)**  
  Renders signup page.

- **postSignup(req, res, next)**  
  Validates input; checks email not in use; hashes password, creates User; sets session and redirects to `/`.

- **getLogout(req, res)**  
  Clears session and destroys it; redirects to `/`.

### 4.9 Admin controllers (`controllers/admin/`)

Admin HTTP handlers are split by domain. `routes/adminRoutes.js` wires each route to the matching file below (not a monolithic `adminController`).

#### dashboardController

- **getAdminDashboard**  
  Uses `dashboardService.getDashboardData()`; renders `admin/dashboard` with orders and stats.

#### orderController

- **getAllOrders**  
  Uses `orderAdminService.getOrdersList(req.query)`; renders `admin/orders`.

- **getExpiredOrders**  
  Uses `orderAdminService.getExpiredOrders()`; renders `admin/orders-expired`.

- **getDeletedOrders**  
  Uses `orderAdminService.getDeletedOrders()`; renders `admin/orders-deleted`.

- **postEmptyDeletedOrders**  
  Calls `orderAdminService.emptyDeletedOrders()`; redirects to `/admin/orders/deleted`.

- **getCreateOrder**  
  Uses `orderAdminService.getCreateOrderForm()`; renders `admin/order-new`.

- **getCarAvailability(req, res)**  
  JSON. Calls `orderAdminService.getCarAvailability(req.params.id, req.query)`; returns status and body.

- **postCreateOrder**  
  Calls `orderAdminService.createOrder(req.body)`; on success redirects to `/admin/orders`; else re-renders form with errors.

- **getOrderDetails**  
  Fetches order by id; renders `admin/order-view` or 404.

- **getEditOrder**  
  Uses `orderAdminService.getOrderEditData(req.params.id)`; renders `admin/order-edit` or 404.

- **postEditOrder**  
  Calls `orderAdminService.updateOrder(id, req.body)`; redirect or re-render with errors.

- **postDeleteOrder**  
  Calls `orderAdminService.deleteOrder(id)`; redirects to `/admin/orders`.

- **postRestoreOrder**  
  Calls `orderAdminService.restoreOrder(id)`; redirects to `/admin/orders` or on error to deleted list with query err.

#### carController

- **listCars**  
  Uses `carAdminService.listCars()`; renders `admin/cars`.

- **getCreateCar**  
  Renders `admin/car-form` with empty car.

- **postCreateCar**  
  Handles multer/validation errors; calls `carAdminService.createCar(req.body, req.file)`; redirects or re-renders form.

- **getEditCar**  
  Loads car by id; renders `admin/car-form` or 404.

- **postEditCar**  
  Handles file/validation; calls `carAdminService.updateCar(id, req.body, req.file)`; redirect or re-render.

- **postDeleteCar**  
  Calls `carAdminService.deleteCar(id)`; redirects to `/admin/cars`.

### 4.10 supportController

- **getPhoneSupport**  
  Renders phone-support page.

- **getVisitLocation**  
  Renders visit-location page.

- **getLiveChat**  
  Renders live-chat page.

- **getCarsSummary**  
  API. Fetches available cars; returns JSON with fuel types, transmissions, seats, price ranges and tiers.

- **getCarsByFilter**  
  API. Validates query (fuelType, transmission, seatsMin, seatsMax); finds cars matching filters; returns JSON.

- **getPricingInfo**  
  API. Returns pricing info (e.g. from FEES and fleet).

- **getCarDetails**  
  API. Validates carId; returns car details JSON or 404.

### 4.11 footerController

Renders static/info pages: careers, blog, faq, roadside, terms, privacy, cookies, accessibility, code-of-conduct, responsible-disclosure, how-to-book, payment-methods, delivery-returns, roadside-coverage, roadside-what-to-do, roadside-insurance. Each export is a single function that renders the corresponding view with a title.

### 4.12 aboutController

- **getAbout(req, res, next)**  
  Renders about page.

---

## 5. Services and Functions

### 5.1 reservationService

- **findActiveReservationBySession(req)**  
  Returns the current session’s active reservation (status in `pending`/`processing`, `holdExpiresAt > now`), or null.

- **releaseActiveReservationForSession(req)**  
  Finds active reservation for session; if found sets `status = 'cancelled'`, `holdExpiresAt = now`, saves; returns `{ cancelled: true/false, reservation }`.

- **extendReservationHold(reservation)**  
  Sets `reservation.holdExpiresAt = now + HOLD_WINDOW_MS`; returns reservation (in-memory).

- **checkCarAvailabilityForRange({ carId, startDate, endDate, now })**  
  Returns `{ overlappingReservation, bookedOverlap }`: first is an active reservation (other sessions) overlapping the range; second is a Car document if `Car.dates` has an overlapping range.

- **createPendingReservation({ carId, sessionId, startDate, endDate, pickupTime, returnTime, pickupLocation, returnLocation, pricing, contact })**
  Creates a `Reservation` with status `pending`, `holdExpiresAt = now + HOLD_WINDOW_MS`, and the given booking/contact fields.

- **cleanUpAbandonedReservations()**  
  Finds active reservations where hold expired, or sessionId missing/null, or sessionId not in current sessions collection; updates them to `status: 'expired'`. Called by server.js on interval.

### 5.2 carService

- **cleanUpOutdatedDates()**  
  Updates all cars: normalizes `Car.dates` start/end to dates and removes entries whose end is in the past (Europe/Sofia). Called by server.js on interval.

### 5.3 bookingFinalizationService

- **finalizeReservationByStripeSessionId(stripeSessionId, options)**  
  Finds reservation by `stripeSessionId`. If `requireActiveStatus`, skips when status is not pending/processing. If already `confirmed`, returns without change (idempotent). Otherwise: calls `addRange(carId, pickupDate, returnDate)` to block dates; creates `Order` from reservation fields; sets reservation `status = 'confirmed'`, `holdExpiresAt = now`, saves. Returns `{ found, finalized, reservation, reason }`.

### 5.4 paymentService

- **buildOrderPageViewModel(car, formData, message, options)**  
  Builds view model for order/checkout page: dates, locations, pricing, contact, existingReservation, message, using `orderViewModelService` and `contactService.trimContactDetails`.

- **normalizeContactDetails(formData)**  
  Returns trimmed contact fields via `contactService.trimContactDetails`.

### 5.5 orderViewModelService

- **buildBaseOrderPayload({ pickupDateISO, returnDateISO, pickupTime, returnTime, pickupLocation, returnLocation, … display fields, pricing, releaseRedirect })**  
  Returns object with dates, times, locations, rentalDays, deliveryPrice, returnPrice, totalPrice, releaseRedirect.

- **buildOrderViewModel(car, basePayload, options)**  
  Merges car, basePayload, and optional contact, existingReservation, message, title into the full order view model.

### 5.6 contactService

- **trimContactDetails(payload)**  
  Returns trimmed fullName, phoneNumber, email, address, hotelName.

- **contactFieldsIncomplete(contact)**  
  Returns true if any of fullName, phoneNumber, email, address is missing.

### 5.7 Admin services

- **dashboardService**  
  Provides dashboard data (orders, stats).

- **orderAdminService**  
  Order list, expired, deleted, create form, create order, get/edit/update/delete/restore order, empty deleted bin, car availability check.

- **carAdminService**  
  List cars, get by id, build form state, create/update/delete car (with image upload).

- **userAdminService**  
  (If present) user management helpers.

- **reservationAdminService**  
  (If present) reservation admin helpers.

---

## 6. Models

| Model | Purpose |
|-------|---------|
| **Car** | Fleet: name, transmission, seats, fuelType, price tiers, availability, `dates[]` (booked ranges: startDate, endDate). |
| **Reservation** | Session-bound hold: carId, sessionId, dates/locations/pricing, status (pending|processing|confirmed|cancelled|expired), holdExpiresAt, stripeSessionId, contact fields. |
| **Order** | Confirmed booking record: carId, dates, locations, pricing, contact, status, isDeleted, etc. |
| **User** | Admin/auth: email, hashed password, role. |
| **Contact** | Contact form submissions: name, email, phone, subject, message, status. |
| **ProcessedStripeEvent** | Idempotency: eventId (unique), stripeSessionId, processedAt. |

---

## 7. Middleware

| Middleware | Role |
|------------|------|
| **csrfProtection** | Validates CSRF token on POST; used on forms. |
| **setCsrfToken** | Sets `res.locals.csrfToken = req.csrfToken()` for views. |
| **requireAuth** | Redirects to `/login` if not logged in. |
| **requireGuest** | Redirects to `/` if logged in (login/signup). |
| **requireAdmin** | Redirects to `/login` or `/` if not admin. |
| **authLimiter** | 10 requests per 15 minutes (login/signup). |
| **contactLimiter** | 20 requests per hour (contact/support email). |
| **adminLimiter** | 100 requests per 15 minutes (admin routes). |
| **upload (multer)** | Single file upload for car image; file size/type validated. |

---

## 8. Utils and Config

- **dateFormatter** — formatDateForDisplay, formatLocationName.
- **timeZone** — parseSofiaDate (Europe/Sofia).
- **pricing** — computeBookingPrice (tiers, delivery/return fees).
- **bookingValidation** — validateBookingDates (valid range, not in past).
- **reservationHelpers** — ACTIVE_RESERVATION_STATUSES, HOLD_WINDOW_MS, getSessionId(req), buildExistingReservationSummary.
- **bookingSync** — purgeExpired, purgeOrphaned, addRange, updateRange, moveRange, removeRange, assertNoOverlap, expireFinishedOrders (Car.dates and Order consistency).
- **fees** — FEES constants for delivery/return.
- **config/security** — applySecurity(app, { isProd }) — Helmet + CSP.
- **config/stripe** — Stripe client instance.

---

## 9. Full Execution Flows

### 9.1 Generic HTTP request (non-webhook)

1. Request hits Express.
2. Static middleware: if path is a file in `public/`, serve it and stop.
3. If `POST /webhook/stripe`, skip to step 10 (webhook flow).
4. Body parsers run (urlencoded, json).
5. CSP nonce middleware runs.
6. Helmet/security runs.
7. Session middleware loads/creates session.
8. Session defaults and res.locals (isLoggedIn, user, csrfToken) run.
9. Route matching: first match in carRoutes → reservationRoutes → paymentRoutes → authRoutes → adminRoutes → supportRoutes → footerRoutes.
10. Route-specific middleware runs (e.g. csrfProtection, setCsrfToken, validation, requireAdmin).
11. Controller runs: may call services, render view, or send JSON/redirect.
12. If no route matched → 404 handler.
13. If error passed to next() → CSRF handler (if EBADCSRFTOKEN) or central error handler → render 500/404.

### 9.2 Customer booking flow (search → order → checkout → success)

1. **GET /**  
   homeController.getHome → (optional purgeExpired) → Car.find with filters/pagination → res.render('index', …).

2. **POST /postSearchCars**  
   availableCarsController.postSearchCars → validation + validateBookingDates → getSessionId → Reservation.find (other sessions’ active holds) → blockedCarIds → Car.find (availability, no overlap in dates, filters) → paginate → computeBookingPrice per car → res.render('searchResults', …).

3. **POST /orders**  
   bookingController.getOrderCar → orderCarController.getOrderCar → load Car, validate dates, pricing → findActiveReservationBySession → if same params render without banner; else if different reservation show banner; else checkCarAvailabilityForRange → if overlap render with message; else createPendingReservation → res.render('orderMain', …).

4. **POST /create-checkout-session**  
   checkoutController.createCheckoutSession (payment.js) → validate form → load Car, validate dates, pricing → findActiveReservationBySession → if same car/dates update contact and extend hold, else check availability and createPendingReservation → Stripe checkout.sessions.create → save reservation stripeSessionId + status 'processing' → res.redirect(303, stripeSession.url).

5. User completes payment on Stripe; Stripe redirects to **GET /success?session_id=…**.

6. **GET /success**  
   handleCheckoutSuccess → finalizeReservationByStripeSessionId(session_id) (idempotent) → res.render('success', …).

7. **POST /webhook/stripe** (async, may happen before or after step 6)  
   handleStripeWebhook → verify signature → ProcessedStripeEvent.create({ eventId }) → on duplicate key return 200 → finalizeReservationByStripeSessionId(requireActiveStatus: true) → return 200.

8. **GET /cancel** (if user cancels on Stripe)  
   handleCheckoutCancel → releaseActiveReservationForSession → res.send('Payment cancelled…').

### 9.3 Release / release-and-rehold

1. **POST /reservations/release**  
   bookingController.releaseActiveReservation → releaseActiveReservationForSession → redirect or JSON.

2. **POST /reservations/release-and-rehold**  
   bookingController.releaseAndReholdReservation → validate body → releaseActiveReservationForSession → checkCarAvailabilityForRange → createPendingReservation → JSON success/error.

### 9.4 Housekeeping (server startup and every 3 minutes)

1. cleanUpOutdatedDates() → Car.updateMany: normalize and remove past dates in Car.dates (Europe/Sofia).
2. cleanUpAbandonedReservations() → Reservation.updateMany: set status 'expired' where hold expired or session invalid.

---

## 10. Trigger Order Summary

```
Server start
  → mongoose.connect
  → cleanUpOutdatedDates()
  → cleanUpAbandonedReservations()
  → setInterval(cleanUpOutdatedDates, 3 min)
  → setInterval(cleanUpAbandonedReservations, 3 min)
  → app.listen(PORT)

Request (typical)
  → static (or skip)
  → bodyParser
  → cspNonce → security → session → session defaults → res.locals
  → route match → route middleware → controller
    → services / utils
    → res.render | res.redirect | res.json | res.send
  → or 404 → or error handler

Booking flow trigger chain
  GET /                    → getHome → Car.find → render index
  POST /postSearchCars     → postSearchCars → Reservation.find (blocks) → Car.find → render searchResults
  POST /orders             → getOrderCar → findActiveReservationBySession / checkCarAvailabilityForRange / createPendingReservation → render orderMain
  POST /create-checkout-session → createCheckoutSession → find/create reservation → Stripe API → redirect to Stripe
  (Stripe)                  → User pays or cancels
  GET /success             → handleCheckoutSuccess → finalizeReservationByStripeSessionId (idempotent) → render success
  GET /cancel              → handleCheckoutCancel → releaseActiveReservationForSession → send text
  POST /webhook/stripe      → handleStripeWebhook → verify → ProcessedStripeEvent insert → finalizeReservationByStripeSessionId → 200
```

**Finalization:** Either the **webhook** or the **success page** can run `finalizeReservationByStripeSessionId`. Both are idempotent: webhook via `ProcessedStripeEvent.eventId`, finalization via reservation status already `confirmed`. The webhook is the authoritative path; the success page ensures the user sees a success state even if the webhook is delayed.

---

*This document reflects the codebase as of the last update. For route-to-controller mapping and validation details, see also `docs/BOOKING_FLOW.md` and `README.md`.*
