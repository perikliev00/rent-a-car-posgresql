# Review26

Този документ е подробен технически review на новата error/payment архитектура.
Целта му е да обясни:

- кой файл каква роля има
- кой файл какво `import`-ва и какво `export`-ва
- коя функция за какво служи
- как данните и грешките минават между файловете
- какво правят основните редове и блокове код

Документът е фокусиран върху файловете, които бяха добавени или променени за новата архитектура:

- `utils/appError.js`
- `utils/asyncHandler.js`
- `middleware/requestContext.js`
- `middleware/errorHandler.js`
- `utils/runWithOptionalTransaction.js`
- `models/Order.js`
- `services/bookingFinalizationService.js`
- `controllers/payment.js`
- `server.js`

---

## 1. High-Level Idea

Новата архитектура разделя проблема на 5 слоя:

1. `utils/appError.js`
   Дава общ език за грешките: `ValidationError`, `NotFoundError`, `ConflictError` и т.н.

2. `middleware/requestContext.js`
   Дава `correlationId` на всяка заявка, за да могат логовете да се проследяват.

3. `middleware/errorHandler.js`
   Събира грешките на едно място, преобразува ги до един формат и връща HTML или JSON.

4. `services/bookingFinalizationService.js`
   Пази най-важната бизнес логика при Stripe финализацията и transaction-safe записа.

5. `server.js`
   Поставя глобалните middleware-и, регистрира process-level handlers и прави graceful shutdown.

---

## 2. Import / Export Map

### 2.1 `utils/appError.js`

### Imports

- Няма външни imports.

### Exports

- `AppError`
- `ValidationError`
- `AuthError`
- `ForbiddenError`
- `NotFoundError`
- `ConflictError`
- `ExternalServiceError`
- `isAppError`

### Used by

- `middleware/errorHandler.js`
- `services/bookingFinalizationService.js`
- `controllers/payment.js`

---

### 2.2 `utils/asyncHandler.js`

### Imports

- Няма външни imports.

### Exports

- `asyncHandler`

### Used by

- `controllers/payment.js`

---

### 2.3 `middleware/requestContext.js`

### Imports

- Node built-in: `crypto`

### Exports

- `requestContext`

### Used by

- `server.js`

---

### 2.4 `middleware/errorHandler.js`

### Imports

- `mongoose`
- от `utils/appError.js`:
  - `AppError`
  - `ConflictError`
  - `ForbiddenError`
  - `ValidationError`
  - `isAppError`

### Exports

- `wantsJson`
- `handleNotFound`
- `errorHandler`

### Used by

- `server.js`

---

### 2.5 `utils/runWithOptionalTransaction.js`

### Imports

- `mongoose`

### Exports

- `TXN_OPTIONS`
- `isTransactionUnsupportedError`
- `runWithOptionalTransaction`

### Used by

- `services/bookingFinalizationService.js`

---

### 2.6 `models/Order.js`

### Imports

- `mongoose`

### Exports

- Mongoose model: `Order`

### Used by

- `services/bookingFinalizationService.js`
- `services/admin/orderAdminService.js`
- други стари части на проекта, които вече работят с `Order`

---

### 2.7 `services/bookingFinalizationService.js`

### Imports

- `Reservation`
- `Order`
- `ProcessedStripeEvent`
- `addRange` от `utils/bookingSync`
- `ACTIVE_RESERVATION_STATUSES` от `utils/reservationHelpers`
- от `utils/appError.js`:
  - `AppError`
  - `ConflictError`
  - `NotFoundError`
- `runWithOptionalTransaction` от `utils/runWithOptionalTransaction`

### Exports

- `finalizeReservationByStripeSessionId`
- `processStripeWebhookEvent`

### Used by

- `controllers/payment.js`

---

### 2.8 `controllers/payment.js`

### Imports

- `stripe`
- `validationResult`
- `Car`
- `Reservation`
- `computeBookingPrice`
- от `utils/reservationHelpers`:
  - `getSessionId`
  - `buildExistingReservationSummary`
- `validateBookingDates`
- от `services/paymentService`:
  - `buildOrderPageViewModel`
  - `normalizeContactDetails`
- от `services/reservationService`:
  - `findActiveReservationBySession`
  - `releaseActiveReservationForSession`
  - `extendReservationHold`
  - `checkCarAvailabilityForRange`
  - `createPendingReservation`
- от `services/bookingFinalizationService`:
  - `finalizeReservationByStripeSessionId`
  - `processStripeWebhookEvent`
- `asyncHandler`
- от `utils/appError.js`:
  - `ExternalServiceError`
  - `NotFoundError`
  - `ValidationError`

### Exports

- `createCheckoutSession`
- `handleCheckoutSuccess`
- `handleCheckoutCancel`
- `handleStripeWebhook`

### Used by

- `controllers/checkoutController.js`
- `routes/paymentRoutes.js`
- `server.js` за webhook route-а

---

### 2.9 `server.js`

### Imports

- `dotenv`
- `express`
- `mongoose`
- `body-parser`
- `path`
- `express-session`
- `connect-mongodb-session`
- `crypto`
- `checkoutController`
- `adminLimiter`
- `applySecurity`
- `requestContext`
- `handleNotFound`
- `errorHandler`
- route файлове:
  - `paymentRoutes`
  - `reservationRoutes`
  - `carRoutes`
  - `adminRoutes`
  - `supportRoutes`
  - `footerRoutes`
  - `authRoutes`
- housekeeping services:
  - `cleanUpOutdatedDates`
  - `cleanUpAbandonedReservations`

### Exports

- Няма `module.exports`; това е bootstrap entry point.

### Used by

- `package.json` чрез `main` и `npm start`

---

## 3. Runtime Flow Map

### 3.1 Error flow

1. Controller/service хвърля грешка.
2. Ако е async controller в `payment.js`, `asyncHandler` я подава към `next(err)`.
3. Express стига до `errorHandler`.
4. `errorHandler`:
   - нормализира грешката
   - логва я с `correlationId`
   - връща HTML или JSON

### 3.2 Stripe finalization flow

1. Stripe удря `POST /webhook/stripe`.
2. `server.js` подава raw body към `checkoutController.handleStripeWebhook`.
3. `controllers/payment.js` валидира signature-а.
4. `processStripeWebhookEvent(...)`:
   - пази idempotency чрез `ProcessedStripeEvent`
   - отваря transaction, ако Mongo го поддържа
   - вика `finalizeReservationCore(...)`
5. `finalizeReservationCore(...)`:
   - намира `Reservation`
   - проверява дали вече има `Order`
   - добавя диапазон в `Car.dates`
   - създава `Order`
   - маркира `Reservation` като `confirmed`

### 3.3 Graceful shutdown flow

1. Процесът получава `SIGINT`, `SIGTERM`, `unhandledRejection` или `uncaughtException`.
2. `server.js` извиква `gracefulShutdown(...)`.
3. Спират се background jobs.
4. Спира се HTTP server-ът.
5. Затваря се Mongo connection.
6. Процесът излиза контролирано.

---

## 4. File-by-File Detailed Walkthrough

## 4.1 `utils/appError.js`

### Purpose

Този файл прави стандартен модел за operational грешките в приложението.
Вместо навсякъде да има `new Error(...)`, тук вече има типизирани грешки със:

- `code`
- `status`
- `message`
- `details`
- `isOperational`

### Line walkthrough

- `1`
  Дефинира базовия клас `AppError`, който наследява стандартния `Error`.

- `2`
  Конструкторът приема:
  - машинен код на грешката
  - HTTP статус
  - публично съобщение
  - допълнителни детайли
  - `options`

- `3`
  Подаваме `message` към базовия `Error`.

- `4`
  Задава името на класа според реалния subclass.

- `5`
  Ако няма подаден код, fallback-ът е `INTERNAL_ERROR`.

- `6`
  Ако няма подаден статус, fallback-ът е `500`.

- `7`
  Пази допълнителни детайли за логове или JSON response.

- `8`
  По подразбиране грешките са operational, освен ако изрично не кажем обратното.

- `10`
  Запазва чист stack trace, започващ от текущия клас.

- `14-18`
  `ValidationError` е специализация за невалидни входни данни и връща `422`.

- `20-24`
  `AuthError` е за липсваща автентикация и връща `401`.

- `26-30`
  `ForbiddenError` е за забранено действие и връща `403`.

- `32-36`
  `NotFoundError` е за липсващ ресурс и връща `404`.

- `38-42`
  `ConflictError` е за конфликтно състояние, примерно overlap или duplicate.

- `44-48`
  `ExternalServiceError` е за външна зависимост като Stripe и връща `502`.

- `50-52`
  `isAppError` проверява дали получената грешка вече е стандартизирана.

- `54-63`
  `module.exports` прави всички error класове достъпни за други файлове.

---

## 4.2 `utils/asyncHandler.js`

### Purpose

Това е тънък wrapper за async controllers, за да не повтаряме `try/catch + next(err)` навсякъде.

### Line walkthrough

- `1`
  Приема async handler функция.

- `2`
  Връща нова Express-compatible middleware функция.

- `3`
  Обвива handler-а в `Promise.resolve(...).catch(next)`, за да стигне грешката до central error handler-а.

- `5`
  Край на wrapper-а.

- `7`
  Export на функцията.

---

## 4.3 `middleware/requestContext.js`

### Purpose

Този middleware дава уникален `correlationId` на всяка заявка.
Това позволява логовете за една и съща заявка да се следят от началото до края.

### Line walkthrough

- `1`
  Импортира Node `crypto`, за да можем да генерираме UUID.

- `3`
  Дефинира middleware функцията `requestContext`.

- `4`
  Коментарът обяснява защо първо гледаме за incoming header.

- `5`
  Чете входящ `x-correlation-id`, ако идва от proxy, gateway или друга система.

- `6-9`
  Ако има валиден header, го ползваме; иначе генерираме нов UUID.

- `11`
  Поставя ID-то в `req`, за да е достъпно за контролери и услуги.

- `12`
  Поставя ID-то в `res.locals`, за да може EJS да го рендерира.

- `13`
  Поставя ID-то и като response header.

- `15`
  Продължава към следващ middleware.

- `18-20`
  Export на middleware-а.

---

## 4.4 `middleware/errorHandler.js`

### Purpose

Тук е централният error boundary на приложението.
Този файл решава:

- как да разпознаем типа грешка
- какъв HTTP статус да върнем
- дали отговорът да е JSON или HTML
- какво да се логне
- какво да види потребителят

### Function map

- `wantsJson(req)`
  Решава дали заявката очаква JSON.

- `normalizeError(err)`
  Превръща различни видове грешки в стандартизиран `AppError`.

- `logError(error, req)`
  Логва грешката с `correlationId`.

- `handleNotFound(req, res, next)`
  Генерира стандартизирана 404 грешка.

- `errorHandler(err, req, res, next)`
  Крайният middleware, който връща response.

### Line walkthrough

- `1`
  Импортира `mongoose`, за да разпознава Mongoose-specific грешки.

- `2-8`
  Импортира новите error класове и helper-а `isAppError`.

- `10-17`
  `wantsJson(req)` решава response формата.
  Логиката е:
  - webhook винаги иска JSON
  - XHR заявка иска JSON
  - `/api/*` иска JSON
  - `Accept: application/json` също води до JSON

- `19-77`
  `normalizeError(err)` е сърцето на файла.

- `20-22`
  Ако грешката вече е `AppError`, не я променяме.

- `24-26`
  Ако грешката е CSRF, превръщаме я във `ForbiddenError`.

- `28-33`
  Ако е Mongoose validation error, правим `ValidationError` и извличаме полета + съобщения.

- `35-40`
  Ако е Mongoose cast error, връщаме `ValidationError` за невалиден ID/формат.

- `42-44`
  Ако е duplicate key (`11000`), връщаме `ConflictError`.

- `46-48`
  Ако е domain overlap error, също връщаме `ConflictError`.

- `50-60`
  Това е compatibility блок за стария код, който ползва `err.publicMessage` или `err.status`.
  Така старите controllers не се чупят, докато минаваме към новия модел.

- `62-76`
  Ако нищо друго не е match-нато, правим fallback `AppError` със `500` и `isOperational: false`.
  Това е programming/fatal style error.

- `79-93`
  `logError(error, req)` логва:
  - severity
  - `correlationId`
  - method
  - path
  - code
  - status
  - message
  - stack
  - details

- `95-98`
  `handleNotFound` прави стандартизирана 404 грешка и я подава към central handler-а.

- `100-139`
  `errorHandler(...)` е крайният Express error middleware.

- `101`
  Нормализира грешката до `AppError`.

- `102`
  Проверява дали сме в production.

- `103-106`
  Ако грешката е operational, може да се покаже нейното съобщение.
  Ако е programming error в prod, показва generic message.

- `108`
  Логва грешката.

- `110-112`
  Ако headers вече са пратени, предава нататък към Express.

- `114-120`
  Създава стандартния JSON payload:
  `{ error: { code, message, correlationId } }`

- `122-124`
  Ако искаме JSON, връщаме JSON response.

- `126-132`
  Ако статусът е `404`, рендерираме `error/404`.

- `134-138`
  Всички останали грешки отиват към `error/500`.

- `141-145`
  Export-ва трите публични API функции на този файл.

---

## 4.5 `utils/runWithOptionalTransaction.js`

### Purpose

Този helper позволява кодът да използва Mongo transaction, ако инфраструктурата го поддържа, но да не се чупи в local/dev среди без replica set.

### Function map

- `isTransactionUnsupportedError(err)`
  Проверява дали текущата Mongo инсталация не поддържа transactions.

- `runWithOptionalTransaction(work)`
  Изпълнява `work(session)` в transaction; ако transactions не се поддържат, изпълнява `work(null)`.

### Line walkthrough

- `1`
  Импортира `mongoose`, за да можем да стартираме session.

- `3-7`
  `TXN_OPTIONS` задава transaction опции:
  - `primary`
  - `local`
  - `majority`

- `9-18`
  `isTransactionUnsupportedError(err)` търси типичните текстове от Mongo за липсващ replica set / unsupported transactions.

- `20-51`
  `runWithOptionalTransaction(work)` е главната функция.

- `21`
  Подготвя променлива за session.

- `23-27`
  Опитва да стартира session и transaction, после вика подадената `work(session)`.

- `28-35`
  При грешка първо опитва да abort-не transaction-а.

- `37-43`
  Ако проблемът е само, че transactions не се поддържат, вика същата логика без session.

- `45`
  Всички други грешки се хвърлят нагоре.

- `46-50`
  Винаги затваря session-а във `finally`.

- `53-57`
  Export на публичния API.

---

## 4.6 `models/Order.js`

### Purpose

Този модел описва confirmed booking документите.
Новите важни полета са:

- `reservationId`
  Връзка към резервацията, от която е създаден order-ът.

- `stripeSessionId`
  Връзка към Stripe checkout session-а.

### Line walkthrough

- `1`
  Импортира `mongoose`.

- `3`
  Създава `orderSchema`.

- `5-11`
  Ново поле `reservationId`.
  То е:
  - `ObjectId`
  - ref към `Reservation`
  - index-нато
  - `unique`
  - `sparse`

  Това е важна data-level защита: една резервация да може да създаде само един order.

- `12-17`
  `carId` сочи към `Car`.

- `18-32`
  Основните booking/contact полета на order-а.

- `33-37`
  `stripeSessionId` пази Stripe checkout session-а за проследяване.

- `38-43`
  Полето `status`.

- `44`
  `expiredAt` пази кога order-ът е изтекъл.

- `45-52`
  Soft-delete флагове.

- `53-56`
  `createdAt` по подразбиране е текущото време.

- `58`
  Mongoose timestamps също остават включени.

- `61`
  Коментар, че `Car.dates` синхронизацията се управлява отделно.

- `63`
  Export на Mongoose модела `Order`.

---

## 4.7 `services/bookingFinalizationService.js`

### Purpose

Това е най-критичният бизнес файл в новата архитектура.
Той пази истинската логика за финализиране на Stripe платена резервация.

### Public functions

- `finalizeReservationByStripeSessionId(stripeSessionId, options)`
  Ползва се от `/success`.

- `processStripeWebhookEvent({ eventId, stripeSessionId, logPrefix })`
  Ползва се от Stripe webhook-а и обработва idempotency + transaction.

### Private helpers

- `sessionOptions(session)`
- `findReservationByStripeSessionId(...)`
- `findFinalizedOrderByReservationId(...)`
- `createOrderFromReservation(...)`
- `finalizeReservationCore(...)`

### Line walkthrough

- `1-11`
  Импортва всички нужни модели, domain constants, error класове и transaction helper-а.

- `13-15`
  `sessionOptions(session)` връща `{ session }`, ако има transaction session.
  Ако няма, връща `undefined`.

- `17-25`
  `findReservationByStripeSessionId(...)` намира резервация по Stripe session ID и populate-ва `carId`.
  Ако има transaction session, query-то минава през нея.

- `27-35`
  `findFinalizedOrderByReservationId(...)` проверява дали за тази резервация вече има order.

- `37-65`
  `createOrderFromReservation(...)` създава `Order` payload от `Reservation`.
  Ако има transaction session, ползва `Order.create([payload], { session })`.

- `67-182`
  `finalizeReservationCore(...)` е същинската бизнес логика.

- `68`
  Извлича опции като `logPrefix` и `requireActiveStatus`.

- `70-72`
  Ако липсва Stripe session ID, хвърля `NotFoundError`.

- `74`
  Зарежда резервацията.

- `76-82`
  Ако няма резервация, връща безопасен резултат `not_found`.

- `84`
  Проверява дали вече има order за тази резервация.

- `86-99`
  Ако резервацията е `confirmed` и order-ът съществува, значи финализацията вече е направена.
  Това е нормален idempotent случай.

- `101-111`
  Ако резервацията е `confirmed`, но order няма, това е коруптирано състояние.
  Тук умишлено хвърляме non-operational `AppError`, защото това вече е bug / data corruption.

- `113-130`
  Ако webhook-ът изисква active status, а резервацията не е active, връща `status_not_active`.

- `132-146`
  Ако order съществува, но reservation не е `confirmed`, това също е inconsistency и fail-ваме шумно.

- `148`
  Извлича `carId`.

- `149-163`
  Опитва да добави диапазона в `Car.dates` чрез `addRange(...)`.
  Ако има overlap, конвертира domain error-а в `ConflictError`.

- `164`
  Създава `Order` от `Reservation`.

- `166-168`
  Маркира резервацията като `confirmed` и изключва hold-а.

- `170-174`
  Логва успешната финализация.

- `176-181`
  Връща success result.

- `184-196`
  Големият коментар обяснява idempotency стратегията.

- `197-205`
  `finalizeReservationByStripeSessionId(...)` просто изпълнява `finalizeReservationCore(...)` вътре в `runWithOptionalTransaction(...)`.

- `207-293`
  `processStripeWebhookEvent(...)` е webhook-specific orchestration функция.

- `208-210`
  Ако липсват event/session ID, хвърля `NotFoundError`.

- `212`
  Подготвя `result`.

- `214-276`
  Изпълнява всичко вътре в `runWithOptionalTransaction(...)`.

- `215-240`
  Ако transactions са налични:
  - записва `ProcessedStripeEvent`
  - ако е duplicate, връща `duplicate_event`
  - ако не е duplicate, прави истинската финализация вътре в transaction

- `243-252`
  Ако transactions не са налични:
  - първо проверява дали event вече е обработен
  - ако да, връща `duplicate_event`

- `254-258`
  После прави финализация без transaction.

- `260-275`
  Накрая записва `ProcessedStripeEvent` след успешна финализация.
  Коментарът обяснява защо това е fallback режимът.

- `278-280`
  Ако всичко е завършило с `finalized`, връща резултата.

- `282-290`
  Ако се върне неизвестно състояние, хвърля `ConflictError`.

- `295-298`
  Export-ва двете публични функции.

---

## 4.8 `controllers/payment.js`

### Purpose

Това е HTTP boundary слой за checkout, success, cancel и Stripe webhook.
Тук се прави:

- HTTP validation
- рендериране на view-та
- redirect към Stripe
- извикване на service слой за финализация

### Public functions

- `createCheckoutSession`
- `handleCheckoutSuccess`
- `handleCheckoutCancel`
- `handleStripeWebhook`

### Private helper

- `renderOrderPage(...)`

### Line walkthrough

- `1-29`
  Импортва всички зависимости:
  модели, helpers, service-и, новите error класове и `asyncHandler`.

- `31-40`
  `renderOrderPage(...)` строи view model и гарантира, че CSRF token-ът стига до template-а.

- `42-265`
  `createCheckoutSession`

- `43-45`
  Взима validation errors и form data.

- `47-50`
  Зарежда колата; ако липсва, хвърля `NotFoundError`.

- `52-55`
  Ако `express-validator` е върнал грешка, re-render-ва order page-а.

- `57-67`
  Валидира booking date range.

- `69-73`
  При невалидни дати re-render-ва страницата с user-friendly message.

- `75-80`
  Подготвя нормализирани локални променливи.

- `81-97`
  Смята цената и проверява дали е валидна.

- `99`
  Нормализира contact полетата.

- `100-104`
  Проверява дали вече има active reservation за текущата сесия.

- `106`
  Маркер дали резервацията е създадена в този request.

- `107-146`
  Ако вече има active reservation:
  - проверява дали е за същата кола и същия период
  - ако не е, показва банер с existing reservation
  - ако е, обновява контактните данни, pricing-а и hold-а

- `147-199`
  Ако няма active reservation:
  - проверява overlap-и
  - ако няма конфликт, създава pending reservation

- `201-219`
  Създава Stripe checkout session.

- `220-250`
  Ако Stripe fail-не:
  - логва с `correlationId`
  - отменя текущата резервация
  - re-render-ва page-а с user message

- `251-253`
  Записва Stripe session ID в reservation-а и я маркира като `processing`.

- `254-263`
  Ако записът на reservation state fail-не, хвърля `ExternalServiceError`.
  Това е важно, защото платежният процес е вече подготвен, но локалното състояние не е сигурно.

- `264`
  Redirect към Stripe.

- `267-297`
  `handleCheckoutSuccess`

- `270-273`
  Чете `session_id`; ако липсва, хвърля `ValidationError`.

- `275-288`
  Опитва да финализира резервацията.
  Ако няма резервация, пак показва success, за да не стряска клиента.

- `288-296`
  Ако финализацията се счупи тук, страницата показва `Payment Processing`.
  Коментарът обяснява защо: webhook-ът е source of truth.

- `299-310`
  `handleCheckoutCancel`
  Освобождава active reservation-а и връща кратко текстово съобщение.

- `312-377`
  `handleStripeWebhook`

- `313-317`
  Логира входа на webhook-а.

- `319-332`
  Взима signature-а и валидира Stripe webhook-а с raw body.
  Ако signature-ът не е валиден, хвърля `ValidationError`.

- `334`
  Логва типа на събитието.

- `336-373`
  Ако event-ът е `checkout.session.completed`:
  - взима session object
  - ако липсва session ID, връща `200`
  - извиква `processStripeWebhookEvent(...)`
  - ако event-ът е duplicate, връща `200`
  - ако няма reservation, пак връща `200`
  - ако status-ът не е active, пак връща `200`

  Това поведение е нарочно, защото webhook-и често трябва да бъдат acknowledged коректно, когато състоянието е вече обработено или irrecoverable business case, но не и при истински processing failure.

- `375-376`
  По default webhook-ът връща `{ received: true }`.

---

## 4.9 `server.js`

### Purpose

Това е main entry point на приложението.
След промените вече управлява:

- request context
- global error handling
- service unavailable mode
- graceful shutdown
- process-level fatal errors

### Important global state

- `app`
- `SESSION_IDLE_MS`
- `isProd`
- `server`
- `isShuttingDown`
- `backgroundJobs`
- `MONGODB_URI`

### Line walkthrough

- `1`
  Зарежда `.env`.

- `6-17`
  Импортва основните framework и новите middleware-и.

- `20-26`
  Импортва route файловете.

- `29-30`
  Импортва housekeeping jobs.

- `34-39`
  Инициализира глобалното Express приложение и процесно състояние.

- `42`
  Чете Mongo URI.

- `46`
  Включва `requestContext` най-рано, за да има `correlationId` навсякъде.

- `47-50`
  Статични файлове и view engine.

- `53-57`
  Mount-ва Stripe webhook route-а преди body parser-ите, за да има raw body за signature verification.

- `58-59`
  Обичайните body parser-и за другите routes.

- `62-65`
  Генерира CSP nonce за templates.

- `66`
  Прилага security конфигурацията.

- `68-89`
  Middleware за graceful shutdown mode.
  Ако сървърът е в процес на спиране:
  - HTML заявки получават `503` view
  - JSON заявки получават `503` JSON

- `93-97`
  Създава Mongo session store.

- `99-101`
  Логва store грешки.

- `104-106`
  В production включва `trust proxy`.

- `109-122`
  Конфигурира session middleware.

- `130-135`
  Гарантира session defaults.

- `138-142`
  Подава auth state към EJS templates.

- `144-149`
  Гарантира, че `csrfToken` винаги съществува в `res.locals`.

- `153-159`
  Mount-ва route файловете.

- `160`
  Ако никой route не match-не, влиза `handleNotFound`.

- `161`
  След него влиза central `errorHandler`.

- `163-166`
  `registerBackgroundJob(job)` пази interval/job за по-късно спиране.

- `168-173`
  `stopBackgroundJobs()` спира всички регистрирани интервали.

- `175-214`
  `gracefulShutdown(trigger, error = null)` е критична функция.

- `176-178`
  Не позволява shutdown да тръгне два пъти.

- `180-184`
  Маркира приложението като shutting down и логва причината.

- `186`
  Спира background jobs.

- `188-192`
  Пуска fail-safe timer, ако shutdown-ът увисне.

- `194-205`
  Спира HTTP server-а, за да не приема нови заявки.

- `207`
  Затваря Mongo connection-а.

- `208-213`
  Логва shutdown грешки и накрая излиза с правилния код.

- `218-257`
  Async bootstrap block.

- `220`
  Свързва се с Mongo.

- `223-225`
  Пуска housekeeping jobs веднага веднъж.

- `227-228`
  Регистрира ги и като интервали.

- `230-234`
  Пуска HTTP server-а и пази reference към него.

- `236-242`
  Връзва `SIGINT` и `SIGTERM` към `gracefulShutdown`.

- `244-247`
  Връзва `unhandledRejection` към `gracefulShutdown`.

- `249-252`
  Връзва `uncaughtException` към `gracefulShutdown`.

- `253-256`
  Ако Mongo connect fail-не при boot, процесът излиза веднага.

---

## 5. Relationship Summary by File

### `server.js`

- Входна точка на приложението
- Импортва:
  - middleware-и
  - route-ове
  - housekeeping jobs
- Не export-ва нищо

### `controllers/payment.js`

- Импортва бизнес логика от service слой
- Export-ва controller handlers
- Използва се през `checkoutController` и routes

### `services/bookingFinalizationService.js`

- Импортва модели + transaction helper + domain errors
- Export-ва service функции
- Използва се само от `controllers/payment.js`

### `middleware/errorHandler.js`

- Импортва error classes
- Export-ва final error middleware
- Използва се от `server.js`

### `middleware/requestContext.js`

- Генерира `correlationId`
- Използва се от `server.js`

### `utils/appError.js`

- Дефинира error taxonomy
- Използва се в controller, service и middleware слоя

### `utils/runWithOptionalTransaction.js`

- Изолира Mongo transaction логиката
- Използва се в `services/bookingFinalizationService.js`

### `models/Order.js`

- Дефинира persistence слоя за confirmed bookings
- Пази data-level idempotency чрез `reservationId`

---

## 6. Why This Architecture Is Better

- Грешките вече не са ad-hoc; имат стандартизиран shape.
- Request-ите вече имат `correlationId`, което прави логовете проследими.
- Webhook финализацията вече не е серия от несвързани writes, а атомична операция, когато Mongo го позволява.
- Има ясна граница между:
  - HTTP слой
  - error слой
  - transaction/business слой
  - process lifecycle слой
- Системата вече не "умира тихо":
  - има logging
  - има graceful shutdown
  - има обработка на fatal process events

---

## 7. Practical Reading Order

Ако искаш да разбереш новата система най-бързо, чети в този ред:

1. `utils/appError.js`
2. `middleware/requestContext.js`
3. `middleware/errorHandler.js`
4. `services/bookingFinalizationService.js`
5. `controllers/payment.js`
6. `server.js`

---

## 8. Notes

- Не добавих inline коментар на буквално всеки ред вътре в source файловете, защото това би направило кода много труден за четене и поддръжка.
- Вместо това направих този документ като подробно обяснение файл-по-файл и блок-по-блок.
- Ако искаш, следващата стъпка мога да направя и `review26-part2.md` за останалата стара архитектура на проекта: routes, auth, reservation, admin, support и booking flow end-to-end.
