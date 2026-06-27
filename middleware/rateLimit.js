// express-rate-limit – защита от brute-force/abuse чрез броене на заявки на прозорец.
const rateLimit = require('express-rate-limit');

// Общ handler – HTML и JSON клиенти получават подходящ формат при 429.
function defaultHandler(req, res /*, next */) {
  // Проверяваме дали req.accepts е налична функция.
  const preferred = typeof req.accepts === 'function'
    ? req.accepts(['html', 'json'])  // Връща предпочитания тип.
    : null;                          // При липса – null.

  // Browser заявки (предпочита html) – rendered error страница.
  if (preferred === 'html') {
    return res.status(429).render('error/500', {
      title: 'Too Many Requests',
      message: 'Too many requests. Please wait a bit and try again.',
    });
  }

  // API/AJAX – JSON payload с кратко съобщение.
  return res
    .status(429)
    .json({ error: 'Too many requests, please slow down.' });
}

// Factory – създава limiter с shared defaults и optional override.
function createLimiter(options) {
  return rateLimit({
    standardHeaders: true,    // X-RateLimit-* headers за клиентите.
    legacyHeaders: false,     // Без X-RateLimit-Limit (legacy).
    handler: defaultHandler,  // Нашият custom handler вместо default.
    ...options,               // windowMs, max и др. от caller.
  });
}

// authLimiter – 10 заявки на 15 минути (login/signup).
const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,  // 15 минути в милисекунди.
  max: 10,                    // Максимум 10 опита.
});

// contactLimiter – 20 заявки на час (contact форма).
const contactLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,  // 1 час.
  max: 20,
});

// adminLimiter – 100 заявки на 15 минути (admin панел).
const adminLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

// adminUploadLimiter – по-стриктен лимит за multipart car image uploads.
const adminUploadLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
});

// Експорт – routes избират подходящия limiter.
module.exports = {
  authLimiter,
  contactLimiter,
  adminLimiter,
  adminUploadLimiter,
};
