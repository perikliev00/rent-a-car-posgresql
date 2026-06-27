# Review26 Review Index

Това е индексът на всички review документи, добавени за backend-а.

## Existing detailed review

- `review26.md`
  Фокусиран преглед на error architecture, payment flow и Stripe finalization слоя.

## Companion backend reviews

- `review26-backend-overview.md`
  Общата карта на backend слоевете и главните потоци.

- `review26-routes-and-middleware.md`
  Request pipeline, middleware order и route-to-controller mapping.

- `review26-customer-flow.md`
  Search -> order -> hold -> checkout -> success -> webhook flow.

- `review26-admin-and-auth.md`
  Admin order/fleet area, auth layer и contact moderation.

- `review26-models-and-utils.md`
  Model schemas, utility responsibilities и data integrity boundaries.

## Suggested reading order

1. `review26-backend-overview.md`
2. `review26-routes-and-middleware.md`
3. `review26-customer-flow.md`
4. `review26-admin-and-auth.md`
5. `review26-models-and-utils.md`
6. `review26.md`
