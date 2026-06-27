# Review26 Backend Overview

Този документ е обща карта на backend-а в проекта.
Той не замества подробния `review26.md`, а го допълва с по-широк поглед върху целия server-side код.

## 1. Backend Scope

Покритите backend зони са:

- `server.js`
- `config/`
- `middleware/`
- `routes/`
- `controllers/`
- `services/`
- `models/`
- `utils/`

## 2. Layer Responsibilities

### `server.js`

- bootstrap-ва приложението
- връзва MongoDB
- конфигурира sessions, security headers и middleware order
- mount-ва route файловете
- пази global error pipeline
- управлява graceful shutdown и process-level fatal events

### `config/`

- `config/security.js`
  Централизира Helmet/CSP и други security headers.

- `config/stripe.js`
  Инициализира споделения Stripe SDK клиент.

### `middleware/`

- request-scoped логика като `requestContext`
- security middleware като CSRF
- auth guards
- rate limiting
- upload handling
- central error normalization/response logic

### `routes/`

- map-ват URL path + HTTP method към controller handler
- слагат middleware-и в правилния ред
- валидират входните данни на route boundary-то

### `controllers/`

- HTTP boundary слой
- четат `req`
- извикват service/helper логика
- решават дали да:
  - `render`
  - `redirect`
  - `json`
  - `send`

### `services/`

- държат бизнес логиката
- encapsulate-ват state transitions
- пазят transaction-safe операции
- намаляват дублиране между controllers

### `models/`

- описват MongoDB документите
- пазят индекси, required полета и enum-и

### `utils/`

- чисти helper-и
- pricing/date/timezone/booking helpers
- booking sync helpers
- error and async wrappers
- transaction helper-и

## 3. Main Backend Flows

### Public booking flow

1. `GET /` -> `homeController.getHome`
2. `POST /postSearchCars` -> `availableCarsController.postSearchCars`
3. `POST /orders` -> `bookingController.getOrderCar` -> `orderCar.getOrderCar`
4. `POST /create-checkout-session` -> `payment.createCheckoutSession`
5. `GET /success` -> `payment.handleCheckoutSuccess`
6. `POST /webhook/stripe` -> `payment.handleStripeWebhook`

### Reservation hold flow

1. `POST /reservations/release`
2. `POST /reservations/release-and-rehold`

### Admin flow

1. admin routes -> `adminController`
2. `adminController` delegates to:
   - `dashboardService`
   - `orderAdminService`
   - `carAdminService`

### Contact/support flow

1. public/support forms -> `contactController.postContact`
2. support chat APIs -> `supportController`
3. admin contact moderation -> `contactController.getAdminContacts` and related handlers

## 4. Core Dependency Direction

Preferred direction in the codebase:

- `server.js` -> `routes`
- `routes` -> `middleware` + `controllers`
- `controllers` -> `services` + `models` + `utils`
- `services` -> `models` + `utils`
- `models` -> Mongoose only

The most important architectural improvement in the recent pass is that `payment.js` no longer carries all critical booking correctness alone:

- `controllers/payment.js` is now an HTTP orchestration layer
- `services/bookingFinalizationService.js` is the authoritative booking finalization layer
- `middleware/errorHandler.js` is the global error boundary
- `server.js` is the process/lifecycle boundary

## 5. Important Safety Boundaries

### Error boundary

- custom app errors live in `utils/appError.js`
- normalized in `middleware/errorHandler.js`
- correlated per request via `middleware/requestContext.js`

### Transaction boundary

- Stripe finalization uses `services/bookingFinalizationService.js`
- optional transaction execution lives in `utils/runWithOptionalTransaction.js`

### Availability boundary

- temporary holds live in `Reservation`
- confirmed booking windows live in `Car.dates`
- confirmed/admin bookings live in `Order`

### Process boundary

- `server.js` handles:
  - `SIGINT`
  - `SIGTERM`
  - `unhandledRejection`
  - `uncaughtException`

## 6. Key Files To Read First

If you want to understand the backend in the best order:

1. `server.js`
2. `middleware/requestContext.js`
3. `middleware/errorHandler.js`
4. `routes/paymentRoutes.js`
5. `controllers/payment.js`
6. `services/bookingFinalizationService.js`
7. `services/reservationService.js`
8. `services/admin/orderAdminService.js`
9. `models/Reservation.js`
10. `models/Order.js`
11. `utils/bookingSync.js`
