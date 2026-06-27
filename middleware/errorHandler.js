const {
  AppError,
  ConflictError,
  ForbiddenError,
  ValidationError,
  isAppError,
} = require('../utils/appError');
const { isUniqueViolation, isCarDateBlockOverlapViolation } = require('../db/transaction');

// Решава дали текущата заявка очаква JSON отговор или rendered HTML страница.
function wantsJson(req) {
  // Stripe webhooks винаги получават JSON-подобни отговори – machine-to-machine.
  if (req.path === '/webhook/stripe') return true;
  // Classic XHR заявки също очакват non-HTML payload.
  if (req.xhr) return true;
  // API routes са JSON-first по конвенция.
  if (req.path.startsWith('/api/')) return true;

  // Fallback към Accept header когато route-ът сам не определя формата.
  const accept = req.get('accept') || '';
  // Ако клиентът явно предпочита JSON а не HTML – отговаряме като JSON.
  return accept.includes('application/json') && !accept.includes('text/html');
}

// Преобразува всяка хвърлена грешка в нормализирана AppError, на която handler-ът може да разчита.
function normalizeError(err) {
  // Ако кодът вече е хвърлил един от нашите error класове – използваме го както е.
  if (isAppError(err)) {
    return err;
  }

  // CSRF token грешки → контролирана 403 грешка.
  if (err && err.code === 'EBADCSRFTOKEN') {
    return new ForbiddenError('Invalid or missing CSRF token.');
  }

  // PostgreSQL unique violation → conflict.
  if (isUniqueViolation(err)) {
    return new ConflictError('A record with the same unique value already exists.', err.detail || null);
  }

  // PostgreSQL exclusion violation (overlapping car_date_blocks) → conflict.
  if (isCarDateBlockOverlapViolation(err)) {
    return new ConflictError('The requested booking overlaps with an existing reservation.');
  }

  // Legacy Mongo duplicate-key code (ако остане от външен код).
  if (err && err.code === 11000) {
    return new ConflictError('A record with the same unique value already exists.', err.keyValue || null);
  }

  // Overlap detection – conflict, защото заявката се сблъсква със съществуващ booking state.
  if (err && err.code === 'OVERLAP') {
    return new ConflictError('The requested booking overlaps with an existing reservation.');
  }

  // Временна съвместимост: по-стари части хвърлят plain errors с publicMessage/status.
  if (err && (err.publicMessage || err.status)) {
    const legacyError = new AppError(
      err.code || 'REQUEST_ERROR',
      err.status || 500,
      err.publicMessage || err.message || 'Request failed.',
      err.details || null
    );
    legacyError.stack = err.stack || legacyError.stack;
    legacyError.cause = err;
    return legacyError;
  }

  // Финален fallback: обвиваме напълно неизвестни грешки като internal, non-operational.
  const fallback = new AppError(
    'INTERNAL_ERROR',
    500,
    'An unexpected error occurred. Please try again later.',
    null,
    { isOperational: false }
  );

  // Запазваме оригиналния stack – programming bugs да остават debuggable.
  fallback.cause = err;
  if (err && err.stack) {
    fallback.stack = err.stack;
  }

  return fallback;
}

// Централизирано логване – всеки error record в еднакъв structure.
function logError(error, req) {
  // Operational грешки са очаквани; non-operational – потенциални bugs – по-голям severity.
  const severity = error.isOperational ? 'ERROR' : 'FATAL';
  // При наличие – предпочитаме оригиналния cause, за реалния stack trace в логовете.
  const original = error.cause || error;

  console.error(`[${severity}]`, {
    // Correlation ID свързва всички log lines за една заявка.
    correlationId: req.correlationId,
    // HTTP method и URL – кой endpoint е произвел грешката.
    method: req.method,
    path: req.originalUrl,
    // code/status/message описват нормализираната app-level грешка.
    code: error.code,
    status: error.status,
    message: error.message,
    // Stack само в логове – не се праща на потребителите в production отговорите.
    stack: original && original.stack ? original.stack : undefined,
    // details – validation field данни или conflict metadata.
    details: error.details || undefined,
  });
}

// Този middleware създава правилна app-level 404, която минава през същия central handler.
function handleNotFound(req, res, next) {
  const error = new AppError('NOT_FOUND', 404, 'The page you are looking for does not exist.');
  next(error);
}

// Финален Express error middleware: нормализира, логва и избира формата на отговора.
function errorHandler(err, req, res, next) {
  // Преобразуваме хвърленото в един стандартизиран error обект.
  const error = normalizeError(err);
  // Production mode скрива internal детайли при non-operational грешки.
  const isProd = process.env.NODE_ENV === 'production';
  const publicMessage =
    error.isOperational || !isProd
      ? error.message
      : 'An unexpected error occurred. Please try again later.';

  // Логваме преди изпращане – да не загубим failure context.
  logError(error, req);

  // Ако Express вече е започнал да изпраща response – делегираме за да завърши коректно.
  if (res.headersSent) {
    return next(err);
  }

  // Стандартна JSON payload форма за API-подобни отговори.
  const payload = {
    error: {
      code: error.code,
      message: publicMessage,
      correlationId: req.correlationId,
    },
  };

  // JSON отговор когато request pattern сочи програмъм клиент.
  if (wantsJson(req)) {
    return res.status(error.status).json(payload);
  }

  // 404 страница за not-found отговори.
  if (error.status === 404) {
    return res.status(404).render('error/404', {
      title: 'Page Not Found',
      message: publicMessage,
      correlationId: req.correlationId,
    });
  }

  // Всичко останало – през общия error page шаблон.
  return res.status(error.status).render('error/500', {
    title: error.status >= 500 ? 'Server Error' : 'Error',
    message: publicMessage,
    correlationId: req.correlationId,
  });
}

// Експорт – server.js да композира глобалния error pipeline.
module.exports = {
  wantsJson,
  handleNotFound,
  errorHandler,
};
