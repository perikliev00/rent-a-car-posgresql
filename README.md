# LuxRide – Session-Bound Reservations & Anti Double-Booking

A full-stack **rent-a-car booking demo** built with **Node.js / Express**, **PostgreSQL**, **EJS**, and **Stripe Checkout**.

The project focuses on **real-world booking safety**: preventing double-booking through **session-bound reservation holds**, **automatic expiration**, and **background cleanup jobs**.

> **Migration note:** This codebase was migrated from **MongoDB / Mongoose** to **PostgreSQL (`pg`)**. Persistence now lives in SQL tables and `services/sql/` query modules — there is no `models/` layer or Mongoose schemas.

---

## Key Features

### Booking & Availability

- Search cars by **date/time** and **pickup/return locations**
- Availability is validated against:
  - **Confirmed bookings** stored in `car_date_blocks` (booked date ranges per car)
  - **Active reservation holds** stored in `reservations` (`pending` / `processing`)

### Anti Double-Booking

- A car becomes **temporarily blocked** when another session holds it  
  (`pending` / `processing` + `hold_expires_at` not expired)
- The **holding session is excluded** from the blocked list, allowing the same user session to continue checkout

---

## Session-Bound Reservation Holds (Core)

- Every reservation is tied **1:1 to a server-side session** (`reservations.session_id`)
- Hold window is aligned with session idle timeout  
  (**default: 20 minutes**)

### Reservation Lifecycle

```
pending → processing (Stripe session created) → confirmed (payment completed)
   ↓
expired / cancelled
```

- Holds automatically expire if the session ends or becomes inactive

---

## Automated Cleanup (Housekeeping)

Background jobs run every **3 minutes**:

- Remove outdated entries from `car_date_blocks`
- Mark reservations as `expired` when:
  - `hold_expires_at` has passed
  - `session_id` is missing
  - the referenced session no longer exists or is expired

This ensures abandoned sessions never permanently block availability.

---

## Payments (Stripe Checkout)

- Stripe Checkout session is created **server-side**
- Reservation status transitions to `processing` and is linked to `stripe_session_id`
- **Webhook** (`checkout.session.completed`) is the primary path for finalizing the booking:
  - Verifies request signature using `STRIPE_WEBHOOK_SECRET` and **raw request body**
  - Uses **`processed_stripe_events`** (by `event_id`) for idempotency — duplicate deliveries return 200 without re-running finalization
  - Inserts booked date range into `car_date_blocks`
  - Creates an `orders` record
  - Marks the reservation as `confirmed`
- **Success page** (`GET /success`) verifies payment via Stripe (`payment_status === 'paid'`) and shows booking status; `car_date_blocks` and `orders` creation happen **only** in the webhook

> ⚠️ **Production:** Ensure `STRIPE_WEBHOOK_SECRET` is set and that the webhook route is mounted with `express.raw({ type: 'application/json' })` so signature verification receives the raw body.

---

## Security & Hardening (Demo Level)

- Helmet security headers (CSP with nonce for scripts, Stripe frames allowed)
- Rate limiting (auth, contact, admin routes)
- CSRF protection (`csurf`) on form submissions
- Session storage in PostgreSQL (`connect-pg-simple`) with rolling idle expiration

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | Node.js, Express 5 |
| **Database** | PostgreSQL + [`pg`](https://node-postgres.com/) |
| **Sessions** | `express-session` + [`connect-pg-simple`](https://github.com/voxpelli/node-connect-pg-simple) |
| **Payments** | Stripe Checkout |
| **Views** | EJS |
| **Styling** | Tailwind CSS |

---

## Database Schema (PostgreSQL)

Schema files live in `sql/schema/` and are applied in dependency order via `node sql/applySchema.js`.

| Table | Purpose |
|-------|---------|
| `categories` | Car categories (Economy, SUV, Luxury, …) |
| `cars` | Fleet inventory and pricing tiers |
| `car_date_blocks` | Confirmed booked date ranges (replaces legacy `Car.dates[]`) |
| `users` | Admin / customer accounts (bcrypt passwords) |
| `session` | Express session store for `connect-pg-simple` |
| `reservations` | Session-bound holds and checkout state |
| `orders` | Confirmed bookings after payment |
| `contacts` | Contact form submissions |
| `processed_stripe_events` | Stripe webhook idempotency (`event_id` unique) |

### Reservations (important fields)

| Column | Notes |
|--------|-------|
| `car_id` | `BIGINT` FK → `cars.id` |
| `session_id` | Tied to Express session |
| `status` | `pending` · `processing` · `confirmed` · `cancelled` · `expired` |
| `hold_expires_at` | Hold expiry timestamp |
| `stripe_session_id` | Unique when set |
| `stripe_payment_intent_id` | Optional |

**Active hold statuses:** `pending`, `processing`  
(See `utils/reservationHelpers.js`.)

---

## Getting Started

### Prerequisites

- **Node.js** 18+
- **PostgreSQL** 14+

### Installation

```bash
npm install
```

### Database Setup

Create a PostgreSQL database, then apply the schema:

```bash
node sql/applySchema.js
```

Optional — load sample categories and cars:

```bash
psql "$DATABASE_URL" -f sql/seed.sql
```

### Environment Variables

Create a `.env` file in the project root:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/luxride
SESSION_SECRET=change-me
STRIPE_SECRET=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NODE_ENV=development
PORT=3000
```

### Run

```bash
npm start
```

Server runs at **http://localhost:3000** (uses nodemon in development).

### Tailwind (optional)

```bash
npm run dev:css
# or
npm run build:css
```

---

## How Anti Double-Booking Works (Short)

1. **Availability check (application)**  
   Reject if dates overlap with confirmed blocks in `car_date_blocks` or if another session holds the same car (active, not expired).

2. **Database exclusion constraint (confirmed bookings)**  
   `car_date_blocks` has a GiST `EXCLUDE` constraint (`no_overlapping_car_blocks`) so two concurrent inserts for the same car and overlapping range cannot both succeed — even if the app-level check passes for both requests.

3. **Create or refresh reservation hold**  
   Bound to current session; hold expiration extended on activity. Holds are still checked in application code (optional hardening: `pg_advisory_xact_lock(car_id)` or Redis around the hold flow).

4. **Cleanup**  
   Expired sessions or holds automatically release the car.

This prevents multiple users from holding or paying for the same car simultaneously; confirmed blocks are race-safe at the database level.

---

## Project Structure

| Path | Description |
|------|-------------|
| `server.js` | App setup, PostgreSQL pool, session store, housekeeping jobs, webhook mount |
| `db/` | `pg` connection pool and transaction helpers |
| `sql/` | Schema orchestrator, per-table migrations, seed data |
| `services/` | Business logic (booking, reservation, payment, admin) |
| `services/sql/` | Parameterized SQL query modules (data access layer) |
| `controllers/` | Request handlers (booking, checkout, payment, admin, auth, etc.) |
| `utils/` | Date, pricing, reservation helpers, booking validation |
| `routes/` | Express route definitions |
| `middleware/` | Auth, CSRF, rate limit, upload |
| `config/` | Security (Helmet/CSP), Stripe |
| `views/` | EJS templates |
| `public/` | Static assets (CSS, JS, images) |

---

## Production Hardening (Required for Production Use)

This repository is a **demo implementation**. For production:

1. **Optional: close the hold race window**  
   Confirmed bookings are protected by the `no_overlapping_car_blocks` PostgreSQL exclusion constraint. For active holds, consider Redis locking or `pg_advisory_xact_lock(car_id)` around check/create (e.g. `SET key value NX PX <ttl>` per car/date range).

2. **Stripe webhook security**  
   Signature verification is already implemented; ensure `STRIPE_WEBHOOK_SECRET` is set and the webhook receives the raw body.

3. **Idempotent webhook finalization**  
   Already implemented via `processed_stripe_events` (unique `event_id`). Enforce uniqueness on `stripe_session_id` where applicable and ignore already-processed events.

4. **Database transactions**  
   Use PostgreSQL transactions (see `db/transaction.js`) for: reservation → confirmed, inserting `car_date_blocks`, and creating `orders` — all in one atomic unit.

5. **Logging & observability**  
   Add structured logs for reservation creation/refresh, expiration, payment confirmation, and booking finalization.

---

## License

MIT
