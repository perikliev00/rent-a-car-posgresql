// Utilities за форматиране на дати и локации.
// Премахват тирета от date низове и ги форматират за показ.

/**
 * Форматира date низ – премахва тирета и показва в четим вид (напр. "14 Sep 2025")
 * @param {string} dateString - Date низ във формат YYYY-MM-DD
 * @returns {string} - Форматиран date низ
 */
function formatDateForDisplay(dateString) {
  // Празен вход → празен низ за показ.
  if (!dateString) return '';

  // Парсваме входящата стойност с вградения Date парсер.
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString; // При невалиден date връщаме оригинала

  // Английски съкращения за месеци – използвани в шаблоните.
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  // Извличаме четимите части от датата.
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  // Връщаме низ във формат `D Mon YYYY`.
  return `${day} ${month} ${year}`;
}

/**
 * Премахва тирета от date низ, запазвайки YYYYMMDD формат
 * @param {string} dateString - Date низ YYYY-MM-DD
 * @returns {string} - Date без тирета (напр. "20250914")
 */
function removeDashesFromDate(dateString) {
  if (!dateString) return '';
  // Премахваме всички тирета от ISO date низа.
  return dateString.replace(/-/g, '');
}

/**
 * Форматира date като DD/MM/YYYY
 * @param {string} dateString - Date низ YYYY-MM-DD
 * @returns {string} - Date във формат DD/MM/YYYY
 */
function formatDateWithSlashes(dateString) {
  if (!dateString) return '';

  // Парсваме date низа преди реформатиране.
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString; // При невалиден date връщаме оригинала

  // Подпълваме ден/месец до 2 цифри за формат DD/MM/YYYY.
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  // Връщаме формата с наклонени черти.
  return `${day}/${month}/${year}`;
}

/**
 * Форматира date като DD.MM.YYYY
 * @param {string} dateString - Date низ YYYY-MM-DD
 * @returns {string} - Date във формат DD.MM.YYYY
 */
function formatDateWithDots(dateString) {
  if (!dateString) return '';

  // Парсваме date низа преди реформатиране.
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString; // При невалиден date връщаме оригинала

  // Подпълваме ден/месец до 2 цифри за формат DD.MM.YYYY.
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  // Връщаме формата с точки.
  return `${day}.${month}.${year}`;
}

/**
 * Форматира име на локация – главна буква, премахва тирета
 * @param {string} locationString - Локация (напр. "sunny-beach", "burgas-airport")
 * @returns {string} - Форматирана локация (напр. "Sunny Beach", "Burgas Airport")
 */
function formatLocationName(locationString) {
  if (!locationString) return '';

  // Специални случаи – изричен мап за бизнес/локационни етикети.
  const specialCases = {
    'office': 'Office',
    'sunny-beach': 'Sunny Beach',
    'sveti-vlas': 'Sveti Vlas',
    'nesebar': 'Nesebar',
    'burgas': 'Burgas',
    'burgas-airport': 'Burgas Airport',
    'sofia': 'Sofia',
    'sofia-airport': 'Sofia Airport',
    'varna': 'Varna',
    'varna-airport': 'Varna Airport',
    'plovdiv': 'Plovdiv',
    'eleni': 'Eleni',
    'ravda': 'Ravda'
  };

  // Връщаме специалния случай ако съществува.
  if (specialCases[locationString]) {
    return specialCases[locationString];
  }

  // Общо форматиране: тирета → интервали, главна буква на всяка дума.
  return locationString
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Експорт на всички date/location helpers.
module.exports = {
  formatDateForDisplay,
  removeDashesFromDate,
  formatDateWithSlashes,
  formatDateWithDots,
  formatLocationName
};
