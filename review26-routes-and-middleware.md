# Review26 Routes And Middleware

Този документ описва как requests влизат в backend-а и през кои middleware/controller слоеве минават.

## 1. Global Middleware Order In `server.js`

Важният ред е:

1. `requestContext`
2. static serving
3. raw Stripe webhook route
4. body parsers
5. CSP nonce middleware
6. `applySecurity`
7. shutdown-guard middleware
8. session middleware
9. session defaults
10. auth state in `res.locals`
11. default `csrfToken` local
12. route modules
13. `handleNotFound`
14. `errorHandler`

Това е важно, защото:

- `requestContext` трябва да е най-рано, за да има `correlationId` във всички логове
- Stripe webhook трябва да е преди `bodyParser.json()`
- CSP nonce трябва да е преди Helmet/CSP
- error handler трябва да е накрая

## 2. Middleware Files

### `middleware/requestContext.js`

Импортва:

- `crypto`

Експортва:

- `requestContext`

Роля:

- чете входящ `x-correlation-id` или генерира нов UUID
- записва ID-то в:
  - `req.correlationId`
  - `res.locals.correlationId`
  - `X-Correlation-Id` header

### `middleware/errorHandler.js`

Импортва:

- `mongoose`
- error класове от `utils/appError.js`

Експортва:

- `wantsJson`
- `handleNotFound`
- `errorHandler`

Роля:

- нормализира различни видове грешки
- логва ги в единен shape
- връща JSON или HTML

### `middleware/auth.js`

Експортва:

- `requireAuth`
- `requireGuest`
- `requireAdmin`

Роля:

- проверява login state в `req.session`
- проверява `req.session.user.role`

### `middleware/csrf.js`

Експортва:

- `csrfProtection`
- `setCsrfToken`

Роля:

- валидира CSRF token
- подава `csrfToken` към EJS templates

### `middleware/rateLimit.js`

Експортва:

- `authLimiter`
- `contactLimiter`
- `adminLimiter`

Роля:

- защитава public/admin endpoints от abuse

### `middleware/upload.js`

Експортва:

- `upload`

Роля:

- обработва admin car image uploads
- пази файловете в `public/images`
- ограничава format и size

## 3. Route Modules

### `routes/carRoutes.js`

Главни paths:

- `GET /`
- `POST /postSearchCars`
- `GET /about`
- `GET /contacts`
- `POST /contact`

Controller targets:

- `homeController.getHome`
- `availableCarsController.postSearchCars`
- `aboutController.getAbout`
- `contactController.getContacts`
- `contactController.postContact`

### `routes/reservationRoutes.js`

Главни paths:

- `POST /orders`
- `POST /reservations/release`
- `POST /reservations/release-and-rehold`

Controller targets:

- `bookingController.getOrderCar`
- `bookingController.releaseActiveReservation`
- `bookingController.releaseAndReholdReservation`

### `routes/paymentRoutes.js`

Главни paths:

- `POST /create-checkout-session`
- `GET /success`
- `GET /cancel`

Controller targets:

- `checkoutController.createCheckoutSession`
- `checkoutController.handleCheckoutSuccess`
- `checkoutController.handleCheckoutCancel`

Забележка:

- истинският Stripe webhook route е mount-нат в `server.js`, не тук

### `routes/authRoutes.js`

Главни paths:

- `GET /login`
- `POST /login`
- `GET /signup`
- `POST /signup`
- `GET /logout`

Controller targets:

- `authController.getLogin`
- `authController.postLogin`
- `authController.getSignup`
- `authController.postSignup`
- `authController.getLogout`

### `routes/supportRoutes.js`

Главни paths:

- `GET /support/phone`
- `GET /support/email`
- `GET /support/visit`
- `GET /support/chat`
- `POST /support/email`
- `GET /api/chat/cars-summary`
- `GET /api/chat/cars-by-filter`
- `GET /api/chat/pricing-info`
- `GET /api/chat/car-details/:carId`

Controller targets:

- `supportController.*`
- `contactController.getContacts`
- `contactController.postContact`

### `routes/footerRoutes.js`

Роля:

- map-ва статични informational pages към `footerController`

### `routes/adminRoutes.js`

Роля:

- admin dashboard
- admin order list/create/edit/delete/restore
- admin contacts moderation
- admin fleet CRUD

Controller targets:

- `adminController.*`
- `contactController.getAdminContacts`
- `contactController.postUpdateContactStatus`
- `contactController.postDeleteContact`

## 4. Middleware Ordering Patterns

### HTML form route

Типичен pattern:

- auth/guest guard
- rate limiter
- `csrfProtection`
- `setCsrfToken`
- validators
- controller

### JSON/API route

Типичен pattern:

- validators
- controller

### Admin file upload route

Типичен pattern:

- `requireAdmin`
- `upload.single('image')`
- multer error normalization middleware
- rejected-file normalization middleware
- `csrfProtection`
- `setCsrfToken`
- validators
- controller

## 5. Why This Layering Matters

Routes should stay thin because:

- they define entry points
- they define validation boundaries
- they define middleware order
- they should not contain business logic

When debugging an endpoint, read in this order:

1. route file
2. controller
3. service
4. model/utils
