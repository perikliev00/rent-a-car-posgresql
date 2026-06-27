// Helper за доставка/връщане такси според избраните локации.
const { feeFor } = require('./fees');

// Милисекунди в един ден – за изчисление на rental days.
const MS_PER_DAY = 86_400_000;

// Изчислява платимите дни на наем между два Date обекта.
function computeRentalDays(start, end) {
  // Невалидни или липсващи дати връщат 0 – helper е safe за различни callers.
  if (!start || !end || !(start instanceof Date) || !(end instanceof Date)) return 0;
  // Изчисляваме суровата продължителност.
  const diff = end.getTime() - start.getTime();
  // Отрицателни/невалидни продължителности също стават 0.
  if (!Number.isFinite(diff) || diff <= 0) return 0;
  // Закръгляме нагоре частичните дни и минимално 1 ден.
  return Math.max(1, Math.ceil(diff / MS_PER_DAY));
}

// Избира дневна цена за кола според продължителността и наличните pricing tiers.
function computeDayPrice(car, rentalDays) {
  if (!car) return 0;

  // Четем всички tier полета от car документа.
  const t1 = car.priceTier_1_3;
  const t7 = car.priceTier_7_31;
  const t31 = car.priceTier_31_plus;

  // Използваме tier цени ако са налични.
  if (t1 || t7 || t31) {
    // Short-rental tier за 1–3 дни когато е наличен.
    if (rentalDays <= 3 && t1) return t1;
    // Medium tier за до 31 дни когато е наличен.
    if (rentalDays <= 31 && t7) return t7;
    // Long tier за наеми над 31 дни когато е наличен.
    if (rentalDays > 31 && t31) return t31;
    // Fallback към legacy base price при липсващ точен tier.
    return car.price || 0;
  }

  // Иначе base price + отстъпки

  // Текущият fallback е просто legacy дневна цена.
  return car.price || 0;
}

// Изчислява пълния booking price payload за search, order, checkout и admin flows.
function computeBookingPrice(car, start, end, pickupLocation, returnLocation) {
  // rental days определят и tier избора, и общата сума.
  const rentalDays = computeRentalDays(start, end);
  // Определяме приложимата дневна цена за колата.
  const dayPrice = computeDayPrice(car, rentalDays);

  // Такси за доставка/връщане от конфигурирания location fee map.
  const deliveryPrice = feeFor(pickupLocation);
  const returnPrice   = feeFor(returnLocation);

  // Обща сума = (дневна цена × дни) + двете location такси.
  const total = Number(((dayPrice * rentalDays) + deliveryPrice + returnPrice).toFixed(2));

  // Връщаме всички компоненти – различни екрани използват различни части от резултата.
  return {
    rentalDays,
    deliveryPrice,
    returnPrice,
    totalPrice: total,
    dayPrice,
    unitPrice: dayPrice,
  };
}

// Експорт на pricing helper-а за целия booking flow.
module.exports = { computeBookingPrice };
