// crypto се използва само за генериране на fallback request ID когато клиентът не предоставя такъв.
const crypto = require('crypto');

// Този middleware прикрепя correlation ID към всяка request/response двойка.
function requestContext(req, res, next) {
  // Предпочитаме upstream ID когато съществува – за correlation на логове между услуги.
  const incomingCorrelationId = req.get('x-correlation-id');
  // Преизползваме валиден incoming ID, иначе създаваме нов UUID за тази заявка.
  const correlationId =
    incomingCorrelationId && incomingCorrelationId.trim()
      ? incomingCorrelationId.trim()
      : crypto.randomUUID();

  // Пазим ID на request – controllers, services и loggers могат да го референцират.
  req.correlationId = correlationId;
  // Излагаме го и към view layer – за HTML error страници с support reference ID.
  res.locals.correlationId = correlationId;
  // Връщаме същия ID на клиента – външни инструменти да съпоставят request/response логове.
  res.setHeader('X-Correlation-Id', correlationId);

  // Продължаваме към останалите middleware-и от стека.
  next();
}

// Експорт – server.js да може да mount-не middleware-а в началото на request pipeline-а.
module.exports = {
  requestContext,
};
