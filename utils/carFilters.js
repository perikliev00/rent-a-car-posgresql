// =============================================================================
// carFilters.js – обща нормализация и филтри за gallery (home) и search
// =============================================================================

function norm(v) {
  return String(v ?? '').trim().toLowerCase();
}

function toNumOrUndef(v) {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  if (!s) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Нормализира сурови полета (query или body) до ефективни критерии за кола.
 * Категорията (chips) се слива с изричните полета като в search flow.
 *
 * @param {Record<string, unknown>} raw
 * @returns {{
 *   category: string,
 *   transmission: string,
 *   fuelType: string,
 *   seatsMin?: number,
 *   seatsMax?: number,
 *   priceMin?: number,
 *   priceMax?: number
 * }}
 */
function parseCarFilterRaw(raw = {}) {
  const {
    category,
    transmission,
    fuelType,
    seatsMin,
    seatsMax,
    priceMin,
    priceMax,
  } = raw;

  const cat = norm(category);
  let effectiveTransmission = norm(transmission);
  let effectiveFuelType = norm(fuelType);
  let effectiveSeatsMin = toNumOrUndef(seatsMin);
  let effectiveSeatsMax = toNumOrUndef(seatsMax);

  if (!effectiveTransmission && (cat === 'automatic' || cat === 'manual')) {
    effectiveTransmission = cat;
  }
  if (
    !effectiveFuelType &&
    (cat === 'petrol' || cat === 'diesel' || cat === 'electric' || cat === 'hybrid')
  ) {
    effectiveFuelType = cat;
  }
  if (effectiveSeatsMin === undefined && effectiveSeatsMax === undefined) {
    if (cat === 'seats-2-3') {
      effectiveSeatsMin = 2;
      effectiveSeatsMax = 3;
    } else if (cat === 'seats-4-5') {
      effectiveSeatsMin = 4;
      effectiveSeatsMax = 5;
    } else if (cat === 'seats-6-9') {
      effectiveSeatsMin = 6;
      effectiveSeatsMax = 9;
    }
  }

  return {
    category: cat,
    transmission: effectiveTransmission,
    fuelType: effectiveFuelType,
    seatsMin: effectiveSeatsMin,
    seatsMax: effectiveSeatsMax,
    priceMin: toNumOrUndef(priceMin),
    priceMax: toNumOrUndef(priceMax),
  };
}

/**
 * Точен филтър по дневна/unit цена след computeBookingPrice.
 *
 * @param {Array<Record<string, unknown>>} cars
 * @param {ReturnType<typeof parseCarFilterRaw>} criteria
 */
function filterCarsByComputedUnitPrice(cars, criteria) {
  if (criteria.priceMin === undefined && criteria.priceMax === undefined) {
    return cars;
  }
  return cars.filter((car) => {
    const unit = Number(car.unitPrice ?? car.price);
    if (criteria.priceMin !== undefined && (!Number.isFinite(unit) || unit < criteria.priceMin)) {
      return false;
    }
    if (criteria.priceMax !== undefined && (!Number.isFinite(unit) || unit > criteria.priceMax)) {
      return false;
    }
    return true;
  });
}

/**
 * Стойности за EJS `filters` при gallery/search.
 *
 * @param {ReturnType<typeof parseCarFilterRaw>} criteria
 * @param {Record<string, unknown>} [raw] – оригинални низове при липсващи числа
 */
function filtersViewModel(criteria, raw = {}) {
  const r = raw || {};
  return {
    transmission: criteria.transmission || '',
    fuelType: criteria.fuelType || '',
    priceMin:
      criteria.priceMin !== undefined
        ? String(criteria.priceMin)
        : String(r.priceMin ?? '').trim(),
    priceMax:
      criteria.priceMax !== undefined
        ? String(criteria.priceMax)
        : String(r.priceMax ?? '').trim(),
    seatsMin:
      criteria.seatsMin !== undefined
        ? String(criteria.seatsMin)
        : String(r.seatsMin ?? '').trim(),
    seatsMax:
      criteria.seatsMax !== undefined
        ? String(criteria.seatsMax)
        : String(r.seatsMax ?? '').trim(),
  };
}

module.exports = {
  parseCarFilterRaw,
  filterCarsByComputedUnitPrice,
  filtersViewModel,
};
