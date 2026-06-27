// Връща true само за реални Date инстанции с валиден timestamp (не NaN).
function isValidDate(d) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

/** Безопасно парсва ISO низ (Z или offset); връща Date или null при грешка. */
function parseISOorNull(v) {
  // Само низове се парсват в тази функция.
  if (!v || typeof v !== 'string') return null;
  // Използваме вградения Date парсер и проверяваме резултата.
  const d = new Date(v);
  return isValidDate(d) ? d : null;
}

/** Сглобява date низ + опционален time низ (naive local) → Date или null */
function fromPartsOrNull(dateStr, timeStr) {
  // Нормализираме входните части до trim-нати низове.
  const d = (dateStr || '').trim();
  const t = (timeStr || '').trim();
  // Липсваща дата означава, че няма какво да парсваме.
  if (!d) return null;
  // Сглобяваме локален datetime низ при наличие на време.
  const combined = t ? `${d}T${t}` : d;
  const dt = new Date(combined);
  // Връщаме валиден Date или null.
  return isValidDate(dt) ? dt : null;
}

/** Best-effort парсване: ISO полета → fallback → date/time части */
function bestEffortRange(body) {
  // Извличаме всички поддържани варианти на date полета от payload.
  const {
    pickupDateISO, returnDateISO,
    pickupDate, returnDate,
    pickupTime,  returnTime,
  } = body || {};

  // Приоритет: ISO полета, после по-свободен формат.
  const start = parseISOorNull(pickupDateISO)
             || parseISOorNull(pickupDate)
             || fromPartsOrNull(pickupDate, pickupTime);

  const end   = parseISOorNull(returnDateISO)
             || parseISOorNull(returnDate)
             || fromPartsOrNull(returnDate, returnTime);

  // Връщаме двата края – дори при null – за да решават callers колко стриктни да са.
  return { start, end };
}

// Експорт на помощните функции за парсване на дати.
module.exports = {
  isValidDate,
  parseISOorNull,
  fromPartsOrNull,
  bestEffortRange,
};
