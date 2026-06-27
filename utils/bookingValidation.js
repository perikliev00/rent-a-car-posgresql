// Timezone-aware parser за booking dates/times в бизнес timezone.
const { parseSofiaDate } = require('./timeZone');

// Споделена константа за rental-day изчисления.
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Изчислява rental days между два Date обекта.
 * - Минимум 1 ден
 * - Използва ceil върху разликата в дни
 */
function computeRentalDays(startDate, endDate) {
  // И двата аргумента трябва да са валидни Date преди аритметика.
  if (
    !(startDate instanceof Date) ||
    Number.isNaN(startDate.getTime()) ||
    !(endDate instanceof Date) ||
    Number.isNaN(endDate.getTime())
  ) {
    throw new Error('Invalid dates passed to computeRentalDays');
  }

  // Изчисляваме суровата разлика в милисекунди.
  const diffMs = endDate.getTime() - startDate.getTime();
  // Закръгляме нагоре до пълни дни и поне 1 ден.
  const days = Math.ceil(diffMs / MS_PER_DAY);
  return Math.max(1, days);
}

function validateBookingDates({
  pickupDate,
  returnDate,
  pickupTime = '00:00',
  returnTime = '23:59',
  now = new Date(),
}) {
  // Събираме всички validation съобщения за callers да решат какво да покажат.
  const errors = [];

  // Парсваме датите с timezone helper-а – сравненията са в Sofia timezone.
  const start = parseSofiaDate(pickupDate, pickupTime);
  const end = parseSofiaDate(returnDate, returnTime);

  // При неуспешен parse – веднага връщаме format грешка.
  if (
    !start ||
    Number.isNaN(start.getTime()) ||
    !end ||
    Number.isNaN(end.getTime())
  ) {
    errors.push('Invalid date format.');
    return {
      isValid: false,
      errors,
      startDate: null,
      endDate: null,
      rentalDays: null,
    };
  }
  if (start <= now) {
    errors.push('Pick-up time must be later than the current time today');
  }

  // "днес" в Europe/Sofia – приближение чрез local date на "now".
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Отхвърляме pickup/return дати които са вече в миналото.
  if (start < today || end < today) {
    errors.push('Pick-up and return dates cannot be in the past.');
  }

  // Поддържаме същата логика: поне един пълен ден – end трябва да е строго след start.
  if (end <= start) {
    errors.push('Return date must be after pick-up date.');
  }

  // Връщаме нормализираните дати дори при грешка – callers могат да ги инспектират.
  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
      startDate: start,
      endDate: end,
      rentalDays: null,
    };
  }

  // При успех – изчисляваме rental days от нормализираните дати.
  const rentalDays = computeRentalDays(start, end);

  // Връщаме успешната форма използвана в controllers/services.
  return {
    isValid: true,
    errors: [],
    startDate: start,
    endDate: end,
    rentalDays,
  };
}

// Експорт на validation helpers.
module.exports = {
  MS_PER_DAY,
  computeRentalDays,
  validateBookingDates,
};
