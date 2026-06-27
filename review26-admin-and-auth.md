# Review26 Admin And Auth

Този документ описва auth слоя, admin controller/service връзките и admin order/fleet логиката.

## 1. Auth Area

### Main files

- `routes/authRoutes.js`
- `controllers/authController.js`
- `middleware/auth.js`
- `models/User.js`

### Auth route flow

#### Login

- `GET /login`
- `POST /login`

Middleware stack:

- `requireGuest`
- `authLimiter`
- `csrfProtection`
- `setCsrfToken`
- validators
- `authController.postLogin`

Controller behavior:

1. read validation errors
2. load user by email
3. compare password using bcrypt
4. set:
   - `req.session.isLoggedIn`
   - `req.session.user`
5. redirect `/`

#### Signup

- `GET /signup`
- `POST /signup`

Controller behavior:

1. validate input
2. ensure email not already used
3. hash password
4. create `User`
5. log user in by session
6. redirect `/`

#### Logout

- `GET /logout`

Behavior:

1. clear session fields
2. destroy session
3. redirect `/`

## 2. Admin Route Area

### Main files

- `routes/adminRoutes.js`
- `controllers/adminController.js`
- `services/admin/dashboardService.js`
- `services/admin/orderAdminService.js`
- `services/admin/carAdminService.js`
- `services/admin/reservationAdminService.js`
- `services/admin/userAdminService.js`

### Middleware pattern

Most admin routes use:

- `requireAdmin`
- `csrfProtection`
- `setCsrfToken`
- validators when needed
- controller

Create/edit car routes also use:

- `upload.single('image')`
- custom multer error normalization middleware

## 3. `adminController.js`

`adminController` is intentionally thin.
Its job is to:

- read params/body/query
- call the correct admin service
- render or redirect
- convert service results into HTTP responses

Main groups:

### Dashboard

- `getAdminDashboard`

Uses:

- `dashboardService.getDashboardData()`

### Orders

- `getAllOrders`
- `getExpiredOrders`
- `getDeletedOrders`
- `postEmptyDeletedOrders`
- `getCreateOrder`
- `getCarAvailability`
- `postCreateOrder`
- `getOrderDetails`
- `getEditOrder`
- `postEditOrder`
- `postDeleteOrder`
- `postRestoreOrder`

Uses:

- `orderAdminService.*`

### Cars

- `listCars`
- `getCreateCar`
- `postCreateCar`
- `getEditCar`
- `postEditCar`
- `postDeleteCar`

Uses:

- `carAdminService.*`

## 4. `orderAdminService.js`

Това е най-сложният admin файл.

### Responsibilities

- order list/filtering
- create/edit/delete/restore order flows
- transaction handling
- `Car.dates` synchronization
- overlap protection
- contact normalization
- form re-render payload building

### Main error types

- `OrderFormError`
- `OrderRestoreError`

Те са domain errors, които позволяват service-ът да върне user-facing validation/business result, вместо да хвърля generic 500 навсякъде.

### Main helper areas

#### Transaction helpers

- `isTransactionUnsupportedError`
- `sessionOptions`
- `runWithOptionalTransaction`

#### Form/view helpers

- `buildInitialOrderDefaults`
- `buildOrderFormDefaultsFromPayload`
- `buildOrderNewErrorResult`
- `buildOrderEditErrorResult`
- `toISODate`
- `toHHMM`

#### Query/filter helpers

- `mapFilters`
- `getOrdersList`
- `getExpiredOrders`
- `getDeletedOrders`

#### CRUD entry points

- `createOrder`
- `updateOrder`
- `deleteOrder`
- `restoreOrder`

#### Transactional cores

- `createOrderCore`
- `updateOrderCore`

#### Range sync helper

- `extractStoredRange`

### Why It Is Important

This service is where admin-created bookings and `Car.dates` stay synchronized.
Without this service, the admin UI could create orders that do not actually block availability.

## 5. `carAdminService.js`

Responsibilities:

- normalize car pricing tiers
- preserve form state after validation failures
- create/update/delete cars
- derive legacy base price from tier pricing

Key helpers:

- `parsePriceTier`
- `deriveBasePrice`
- `buildImagePath`
- `buildCarFormState`

## 6. `dashboardService.js`

Responsibilities:

- expire finished orders first
- fetch visible orders
- compute:
  - total orders
  - total revenue
  - pending orders

## 7. `reservationAdminService.js`

Responsibility:

- detect whether an active online reservation hold conflicts with an admin-created/edit order

This prevents admin actions from ignoring live customer holds.

## 8. `userAdminService.js`

Current state:

- placeholder/stub service
- exposes `listUsers()` returning `[]`

Meaning:

- architecture is prepared for future admin user-management features
- routes/controllers can later depend on a service layer without large rewrites

## 9. Contact Moderation In Admin

Even though contact moderation is accessed through admin routes, the implementation lives in:

- `controllers/contactController.js`
- `models/Contact.js`

Admin-specific handlers:

- `getAdminContacts`
- `postUpdateContactStatus`
- `postDeleteContact`

## 10. Key Data Integrity Rules In Admin

1. Admin order create/edit should respect active reservation holds.
2. `Car.dates` must stay synchronized with confirmed/admin orders.
3. Delete removes the booked range and soft-deletes the order.
4. Restore re-adds the booked range only if no overlap exists.
5. When transactions are available, admin mutations run transactionally.
