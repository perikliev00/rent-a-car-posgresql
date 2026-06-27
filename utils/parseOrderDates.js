// Обект за търсене на месеци – английски съкращения.
const MONTHS_EN = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};
// Обект за търсене на месеци – български съкращения.
const MONTHS_BG = {
  'ян': 0, 'фев': 1, 'мар': 2, 'апр': 3, 'май': 4, 'юни': 5, 'юли': 6, 'авг': 7, 'сеп': 8, 'окт': 9, 'ное': 10, 'дек': 11,
};

// Безопасно парсва date-подобен низ в Date; при грешка връща null вместо invalid Date.
function toDateSafe(s) {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Парсва низове като "7 Dec 2025" или "7 дек 2025", опционално с време, в Date.
function parseD_MMM_YYYY(str, time) {
  if (!str) return null;
  // Нормализираме whitespace и разбиваме на токени за дата.
  const m = String(str).trim();
  const parts = m.split(/\s+/);
  if (parts.length < 3) return null;
  // Извличаме числови ден/година и ключа на месеца.
  const day = parseInt(parts[0], 10);
  const monKey = parts[1].toLowerCase().slice(0, 3);
  const year = parseInt(parts[2], 10);
  // Първо опитваме английските имена на месеци.
  let mon = MONTHS_EN[monKey];
  if (typeof mon === 'undefined') {
    // Fallback към български имена ако английското търсене е неуспешно.
    const monKeyBg = parts[1].toLowerCase().slice(0, 3);
    mon = MONTHS_BG[monKeyBg];
  }
  // Прекратяваме при невалидна или неподдържана date компонента.
  if (!(year > 1900) || !(day >= 1 && day <= 31) || typeof mon === 'undefined') return null;
  // Време по подразбиране – полунощ, освен ако не е подадено time.
  let h = 0; let mi = 0;
  if (time) {
    // Парсваме първия fragment от типа HH:MM.
    const mt = String(time).trim().match(/^(\d{1,2}):(\d{2})/);
    if (mt) { h = parseInt(mt[1], 10); mi = parseInt(mt[2], 10); }
  }
  // Създаваме Date в локално време.
  const d = new Date(year, mon, day, h, mi, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Парсва order dates от req.body по робастен начин.
 * Приоритет: ISO полета (pickupDateISO/returnDateISO) + pickupTime/returnTime.
 * Fallback: display низове като "7 Dec 2025" (+ time).
 * Връща { pickupAt, returnAt, pickupISO, returnISO, rentalDays }
 */
function parseOrderDatesFromReq(req) {
  // Работим само с подаденото body.
  const b = req.body || {};
  const {
    pickupDateISO, returnDateISO,
    pickupDate, returnDate,
    pickupTime, returnTime,
  } = b;

  // Helper: комбинира YYYY-MM-DD + time в ISO-подобна стойност и парсва безопасно.
  const isoWithTime = (dateISO, time) => {
    if (!dateISO) return null;
    let s = String(dateISO).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s) && time) s = `${s}T${String(time).trim()}:00`;
    return toDateSafe(s);
  };

  // Приоритет към ISO полетата когато са налични.
  let pickupAt = isoWithTime(pickupDateISO, pickupTime) || toDateSafe(pickupDateISO);
  let returnAt = isoWithTime(returnDateISO, returnTime) || toDateSafe(returnDateISO);

  // Fallback към display-string парсване при липсващи ISO стойности.
  if (!pickupAt) pickupAt = parseD_MMM_YYYY(pickupDate, pickupTime) || toDateSafe(pickupDate);
  if (!returnAt) returnAt = parseD_MMM_YYYY(returnDate, returnTime) || toDateSafe(returnDate);

  // Ако едната страна не се парсна – връщаме null за невалиден вход.
  if (!pickupAt || !returnAt) return null;
  // return трябва да е строго след pickup.
  if (returnAt.getTime() <= pickupAt.getTime()) return null;

  // Изчисляваме приблизителния брой дни наема от парснатите времена.
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const rentalDays = Math.max(1, Math.round((returnAt - pickupAt) / MS_PER_DAY));
  // Връщаме нормализирана форма за callers.
  return {
    pickupAt,
    returnAt,
    pickupISO: pickupAt.toISOString(),
    returnISO: returnAt.toISOString(),
    rentalDays,
  };
}

// Експорт на робастния request date parser.
module.exports = { parseOrderDatesFromReq };
