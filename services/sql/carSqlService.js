const pool = require('../../db/pool');
const { parseSofiaDate } = require('../../utils/timeZone');
const { clientQuery } = require('../../db/transaction');
const { fetchDateBlocksByCarIds } = require('./bookingSyncSqlService');

const DEFAULT_PER_PAGE = 3;

const CAR_SELECT = `
  c.id,
  c.name,
  c.image,
  c.transmission,
  c.price,
  c.price_per_day,
  c.price_tier_1_3,
  c.price_tier_7_31,
  c.price_tier_31_plus,
  c.seats,
  c.fuel_type,
  c.availability,
  c.category_id,
  cat.name AS category_name,
  c.created_at,
  c.updated_at
`;

function normalizeCarId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
}
function parsePage(raw, { min = 1, max = 999999 } = {}) {
  const n = parseInt(String(raw ?? ''), 10);
  const page = Number.isFinite(n) ? n : 1;
  return Math.min(max, Math.max(min, page));
}

function toNumberOrUndefined(value) {
  if (value === null || value === undefined) return undefined;

  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

// Превръща PostgreSQL row към application object за views и services.
function mapSqlCar(row, dates = []) {
  if (!row) return null;

  return {
    id: String(row.id),

    name: row.name,
    image: row.image,
    transmission: row.transmission,

    price: toNumberOrUndefined(row.price),
    pricePerDay: toNumberOrUndefined(row.price_per_day),

    priceTier_1_3: toNumberOrUndefined(row.price_tier_1_3),
    priceTier_7_31: toNumberOrUndefined(row.price_tier_7_31),
    priceTier_31_plus: toNumberOrUndefined(row.price_tier_31_plus),

    seats: Number(row.seats),
    fuelType: row.fuel_type,
    availability: row.availability,

    category: row.category_id ? String(row.category_id) : undefined,
    categoryName: row.category_name || '',

    createdAt: row.created_at,
    updatedAt: row.updated_at,

    dates: Array.isArray(dates) ? dates : [],
  };
}

function resolveSearchDateRange(options = {}) {
  const {
    startDate,
    endDate,
    pickupDate,
    returnDate,
    pickupTime = '10:00',
    returnTime = '10:00',
  } = options;

  if (startDate instanceof Date && endDate instanceof Date) {
    return { startDate, endDate };
  }

  if (pickupDate && returnDate) {
    const start = parseSofiaDate(pickupDate, pickupTime);
    const end = parseSofiaDate(returnDate, returnTime);
    if (
      start &&
      end &&
      !Number.isNaN(start.getTime()) &&
      !Number.isNaN(end.getTime())
    ) {
      return { startDate: start, endDate: end };
    }
  }

  return null;
}

function addParam(params, value) {
  params.push(value);
  return `$${params.length}`;
}

function getPriceExpression(rentalDays) {
  const rd = Math.max(1, Number(rentalDays) || 1);

  if (rd <= 3) {
    return 'COALESCE(c.price_tier_1_3, c.price)';
  }

  if (rd <= 31) {
    return 'COALESCE(c.price_tier_7_31, c.price)';
  }

  return 'COALESCE(c.price_tier_31_plus, c.price)';
}

function buildCarWhere(criteria = {}, rentalDays = 1, options = {}) {
  const params = [];
  const where = [];

  if (options.onlyAvailable) {
    where.push('c.availability = TRUE');
  }

  const searchRange = resolveSearchDateRange(options);
  if (searchRange) {
    const startParam = addParam(params, searchRange.startDate);
    const endParam = addParam(params, searchRange.endDate);
    where.push(`NOT EXISTS (
      SELECT 1
      FROM car_date_blocks b
      WHERE b.car_id = c.id
        AND b.start_date < ${endParam}
        AND b.end_date > ${startParam}
    )`);
    where.push(`NOT EXISTS (
      SELECT 1
      FROM reservations r
      WHERE r.car_id = c.id
        AND r.status IN ('pending', 'processing')
        AND r.hold_expires_at > NOW()
        AND r.pickup_date < ${endParam}
        AND r.return_date > ${startParam}
    )`);
  }

  if (criteria.transmission) {
    where.push(`LOWER(c.transmission) = LOWER(${addParam(params, criteria.transmission)})`);
  }

  if (criteria.fuelType) {
    where.push(`LOWER(c.fuel_type) = LOWER(${addParam(params, criteria.fuelType)})`);
  }

  if (criteria.seatsMin !== undefined) {
    where.push(`c.seats >= ${addParam(params, criteria.seatsMin)}`);
  }

  if (criteria.seatsMax !== undefined) {
    where.push(`c.seats <= ${addParam(params, criteria.seatsMax)}`);
  }

  if (criteria.priceMin !== undefined || criteria.priceMax !== undefined) {
    const priceExpr = getPriceExpression(rentalDays);

    if (criteria.priceMin !== undefined) {
      where.push(`${priceExpr} >= ${addParam(params, criteria.priceMin)}`);
    }

    if (criteria.priceMax !== undefined) {
      where.push(`${priceExpr} <= ${addParam(params, criteria.priceMax)}`);
    }
  }

  return {
    whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
    params,
  };
}

async function paginateSqlCars(criteria = {}, options = {}) {
  const {
    page: requestedPage = 1,
    perPage = DEFAULT_PER_PAGE,
    rentalDays = 1,
    onlyAvailable = false,
    pickupTime = '10:00',
    returnTime = '10:00',
    pickupDate,
    returnDate,
    startDate,
    endDate,
  } = options;

  const currentPage = parsePage(requestedPage);
  const skip = (currentPage - 1) * perPage;

  const { whereSql, params } = buildCarWhere(criteria, rentalDays, {
    onlyAvailable,
    pickupDate,
    returnDate,
    pickupTime,
    returnTime,
    startDate,
    endDate,
  });

  const limitParam = `$${params.length + 1}`;
  const offsetParam = `$${params.length + 2}`;

  const dataQuery = `
    SELECT
      ${CAR_SELECT}
    FROM cars c
    LEFT JOIN categories cat ON c.category_id = cat.id
    ${whereSql}
    ORDER BY c.name ASC
    LIMIT ${limitParam}
    OFFSET ${offsetParam};
  `;

  const countQuery = `
    SELECT COUNT(*)::int AS total_count
    FROM cars c
    LEFT JOIN categories cat ON c.category_id = cat.id
    ${whereSql};
  `;

  const [carsResult, countResult] = await Promise.all([
    pool.query(dataQuery, [...params, perPage, skip]),
    pool.query(countQuery, params),
  ]);

  const totalCount = countResult.rows[0]?.total_count || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / perPage));

  const carIds = carsResult.rows.map((row) => Number(row.id));
  const dateBlocksByCarId = await fetchDateBlocksByCarIds(carIds);

  return {
    cars: carsResult.rows.map((row) =>
      mapSqlCar(row, dateBlocksByCarId.get(Number(row.id)) || [])
    ),
    currentPage,
    totalPages,
    totalCount,
    perPage,
    skip,
  };
}

async function getSqlCarById(id) {
  const carId = Number(id);

  if (!Number.isInteger(carId) || carId <= 0) {
    return null;
  }

  const result = await pool.query(
    `
    SELECT
      ${CAR_SELECT}
    FROM cars c
    LEFT JOIN categories cat ON c.category_id = cat.id
    WHERE c.id = $1
    LIMIT 1;
    `,
    [carId]
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  const dateBlocksByCarId = await fetchDateBlocksByCarIds([Number(row.id)]);
  return mapSqlCar(row, dateBlocksByCarId.get(Number(row.id)) || []);
}

async function listAllCars(client = null) {
  const result = await clientQuery(
    client,
    `
    SELECT
      ${CAR_SELECT}
    FROM cars c
    LEFT JOIN categories cat ON c.category_id = cat.id
    ORDER BY c.name ASC
    `
  );

  return result.rows.map((row) => mapSqlCar(row));
}

async function listAvailableCars(client = null) {
  const result = await clientQuery(
    client,
    `
    SELECT
      ${CAR_SELECT}
    FROM cars c
    LEFT JOIN categories cat ON c.category_id = cat.id
    WHERE c.availability = TRUE
    ORDER BY c.name ASC
    `
  );

  return result.rows.map((row) => mapSqlCar(row));
}

async function listCarsByFilter({
  fuelType,
  transmission,
  seatsMin,
  seatsMax,
  onlyAvailable = true,
  limit = 10,
} = {}, client = null) {
  const params = [];
  const where = [];

  if (onlyAvailable) {
    where.push('c.availability = TRUE');
  }

  if (fuelType) {
    params.push(fuelType);
    where.push(`LOWER(c.fuel_type) = LOWER($${params.length})`);
  }

  if (transmission) {
    params.push(transmission);
    where.push(`LOWER(c.transmission) = LOWER($${params.length})`);
  }

  if (seatsMin !== undefined && seatsMin !== null && seatsMin !== '') {
    params.push(Number(seatsMin));
    where.push(`c.seats >= $${params.length}`);
  }

  if (seatsMax !== undefined && seatsMax !== null && seatsMax !== '') {
    params.push(Number(seatsMax));
    where.push(`c.seats <= $${params.length}`);
  }

  params.push(limit);
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const result = await clientQuery(
    client,
    `
    SELECT
      ${CAR_SELECT}
    FROM cars c
    LEFT JOIN categories cat ON c.category_id = cat.id
    ${whereSql}
    ORDER BY c.name ASC
    LIMIT $${params.length}
    `,
    params
  );

  return result.rows.map((row) => mapSqlCar(row));
}

async function createAdminCar(payload, client = null) {
  const result = await clientQuery(
    client,
    `
    INSERT INTO cars (
      name,
      image,
      transmission,
      price,
      price_tier_1_3,
      price_tier_7_31,
      price_tier_31_plus,
      seats,
      fuel_type,
      availability
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *
    `,
    [
      payload.name,
      payload.image,
      payload.transmission,
      payload.price,
      payload.priceTier_1_3 ?? null,
      payload.priceTier_7_31 ?? null,
      payload.priceTier_31_plus ?? null,
      payload.seats,
      payload.fuelType,
      payload.availability !== false,
    ]
  );

  return mapSqlCar(result.rows[0]);
}

async function updateAdminCar(id, payload, client = null) {
  const carId = normalizeCarId(id);
  if (!carId) {
    throw new Error('Invalid car id');
  }

  const result = await clientQuery(
    client,
    `
    UPDATE cars
    SET
      name = $2,
      transmission = $3,
      price = $4,
      price_tier_1_3 = $5,
      price_tier_7_31 = $6,
      price_tier_31_plus = $7,
      seats = $8,
      fuel_type = $9,
      availability = $10,
      image = COALESCE($11, image),
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [
      carId,
      payload.name,
      payload.transmission,
      payload.price,
      payload.priceTier_1_3 ?? null,
      payload.priceTier_7_31 ?? null,
      payload.priceTier_31_plus ?? null,
      payload.seats,
      payload.fuelType,
      Boolean(payload.availability),
      payload.image || null,
    ]
  );

  if (!result.rowCount) {
    return null;
  }

  return mapSqlCar(result.rows[0]);
}

async function deleteCarById(id, client = null) {
  const carId = normalizeCarId(id);
  if (!carId) {
    throw new Error('Invalid car id');
  }

  const orderCheck = await clientQuery(
    client,
    `SELECT 1 FROM orders WHERE car_id = $1 LIMIT 1`,
    [carId]
  );
  if (orderCheck.rowCount) {
    const err = new Error('Cannot delete car: it has associated orders.');
    err.code = 'CAR_HAS_ORDERS';
    throw err;
  }

  const reservationCheck = await clientQuery(
    client,
    `SELECT 1 FROM reservations WHERE car_id = $1 LIMIT 1`,
    [carId]
  );
  if (reservationCheck.rowCount) {
    const err = new Error('Cannot delete car: it has associated reservations.');
    err.code = 'CAR_HAS_RESERVATIONS';
    throw err;
  }

  const result = await clientQuery(
    client,
    `DELETE FROM cars WHERE id = $1 RETURNING id`,
    [carId]
  );

  return result.rowCount > 0;
}

module.exports = {
  mapSqlCar,
  paginateSqlCars,
  getSqlCarById,
  listAllCars,
  listAvailableCars,
  listCarsByFilter,
  createAdminCar,
  updateAdminCar,
  deleteCarById,
  parsePage,
};