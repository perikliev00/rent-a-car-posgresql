// Каноничен бизнес timezone за booking сравнения и парсване.
const SOFIA_TZ = 'Europe/Sofia';

// Изчислява timezone offset в минути за дадена timezone и дата.
function getOffsetMinutes(timeZone, date) {
  // Форматираме датата в части в целевата timezone.
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  // Разбиваме форматираната дата на addressable части (year, month, day, hour и др.).
  const parts = dtf.formatToParts(date);
  const data = {};

  // Преобразуваме частите от formatter в plain object за по-лесен достъп.
  for (const { type, value } of parts) {
    data[type] = value;
  }

  // Извличаме всички числови компоненти от форматираните данни.
  const year = Number(data.year);
  const month = Number(data.month);
  const day = Number(data.day);
  const hour = Number(data.hour);
  const minute = Number(data.minute);
  const second = Number(data.second);

  // При невъзможност за парсване на компонент – връщаме 0 offset като safe fallback.
  if ([year, month, day, hour, minute, second].some(Number.isNaN)) {
    return 0;
  }

  // Възсъздаваме wall-clock времето в target timezone като UTC.
  const asUTC = Date.UTC(year, month - 1, day, hour, minute, second);
  // Offset в минути = target-local-as-UTC минус реалния UTC timestamp.
  return (asUTC - date.getTime()) / 60000;
}

// Парсва YYYY-MM-DD + HH:MM като Date интерпретиран в Europe/Sofia.
function parseSofiaDate(dateString, timeString = '00:00') {
  // Липсващ date вход не може да се парсне.
  if (!dateString) return null;

  // Разбиваме date и time низовете на числови части.
  const [yearStr, monthStr, dayStr] = String(dateString).split('-');
  const [hourStr = '00', minuteStr = '00'] = String(timeString || '00:00').split(':');

  // Преобразуваме всички части в числа.
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const hour = Number(hourStr);
  const minute = Number(minuteStr);

  // Невалидна числова компонента прави парсването невалидно.
  if ([year, month, day, hour, minute].some(Number.isNaN)) {
    return null;
  }

  // Създаваме baseline UTC date от wall-clock стойностите.
  const baseline = new Date(Date.UTC(year, month - 1, day, hour, minute));
  // Изчисляваме колко е бил offset-ът на София в този момент.
  const offset = getOffsetMinutes(SOFIA_TZ, baseline);
  // Отместваме baseline назад с Sofia offset за да получим истинския UTC instant.
  return new Date(baseline.getTime() - offset * 60000);
}

// Експорт на timezone константата и parser-а.
module.exports = {
  SOFIA_TZ,
  parseSofiaDate,
};
