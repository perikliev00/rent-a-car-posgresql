const pool = require('../../db/pool');
const { clientQuery, isCarDateBlockOverlapViolation } = require('../../db/transaction');
const { parseSofiaDate } = require('../../utils/timeZone');
const { toUtc } = require('../../utils/toUtc');

function normalizeCarId(carId) {
  const id = Number(carId);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
}

function overlapError() {
  const err = new Error('Booking overlaps with existing dates');
  err.code = 'OVERLAP';
  return err;
}

// Премахва изтекли date blocks за една кола или за всички коли.
async function purgeExpired(carId = null, client = null) {
  const now = new Date();
  const normalizedCarId = carId ? normalizeCarId(carId) : null;

  if (carId && normalizedCarId === null) {
    return;
  }

  if (normalizedCarId) {
    await clientQuery(
      client,
      `DELETE FROM car_date_blocks WHERE car_id = $1 AND end_date <= $2`,
      [normalizedCarId, now]
    );
    return;
  }

  await clientQuery(
    client,
    `DELETE FROM car_date_blocks WHERE end_date <= $1`,
    [now]
  );
}

// Хвърля OVERLAP ако новият интервал се застъпва със съществуващ block.
// Fast-path check; authoritative protection is no_overlapping_car_blocks (GiST EXCLUDE).
async function assertNoOverlap(carId, start, end, client = null) {
  const normalizedCarId = normalizeCarId(carId);
  if (!normalizedCarId) {
    throw new Error('Invalid car id');
  }

  const result = await clientQuery(
    client,
    `
    SELECT 1
    FROM car_date_blocks
    WHERE car_id = $1
      AND start_date < $3
      AND end_date > $2
    LIMIT 1
    `,
    [normalizedCarId, start, end]
  );

  if (result.rowCount > 0) {
    throw overlapError();
  }
}

async function insertDateBlock(carId, start, end, client = null) {
  try {
    await clientQuery(
      client,
      `
      INSERT INTO car_date_blocks (car_id, start_date, end_date)
      VALUES ($1, $2, $3)
      `,
      [carId, start, end]
    );
  } catch (err) {
    if (isCarDateBlockOverlapViolation(err)) {
      throw overlapError();
    }
    throw err;
  }
}

async function addRange(carId, start, end, client = null) {
  const normalizedCarId = normalizeCarId(carId);
  if (!normalizedCarId) {
    throw new Error('Invalid car id');
  }

  const s = toUtc(start);
  const e = toUtc(end);
  if (!(s < e)) {
    throw new Error('Invalid date range');
  }

  await purgeExpired(normalizedCarId, client);
  await assertNoOverlap(normalizedCarId, s, e, client);
  await insertDateBlock(normalizedCarId, s, e, client);
}

async function updateRange(carId, prevStart, prevEnd, newStart, newEnd, client = null) {
  const normalizedCarId = normalizeCarId(carId);
  if (!normalizedCarId) {
    throw new Error('Invalid car id');
  }

  const ps = toUtc(prevStart);
  const pe = toUtc(prevEnd);
  const ns = toUtc(newStart);
  const ne = toUtc(newEnd);
  if (!(ns < ne)) {
    throw new Error('Invalid date range');
  }

  await purgeExpired(normalizedCarId, client);
  await clientQuery(
    client,
    `
    DELETE FROM car_date_blocks
    WHERE car_id = $1 AND start_date = $2 AND end_date = $3
    `,
    [normalizedCarId, ps, pe]
  );
  await assertNoOverlap(normalizedCarId, ns, ne, client);
  await insertDateBlock(normalizedCarId, ns, ne, client);
}

async function moveRange(prevCarId, newCarId, prevStart, prevEnd, newStart, newEnd, client = null) {
  const prevId = normalizeCarId(prevCarId);
  const newId = normalizeCarId(newCarId);
  if (!prevId || !newId) {
    throw new Error('Invalid car id');
  }

  const ps = toUtc(prevStart);
  const pe = toUtc(prevEnd);
  const ns = toUtc(newStart);
  const ne = toUtc(newEnd);
  if (!(ns < ne)) {
    throw new Error('Invalid date range');
  }

  await purgeExpired(prevId, client);
  await purgeExpired(newId, client);
  await assertNoOverlap(newId, ns, ne, client);
  await clientQuery(
    client,
    `
    DELETE FROM car_date_blocks
    WHERE car_id = $1 AND start_date = $2 AND end_date = $3
    `,
    [prevId, ps, pe]
  );
  await insertDateBlock(newId, ns, ne, client);
}

async function removeRange(carId, startDate, endDate, client = null) {
  if (!carId || !startDate || !endDate) {
    return;
  }

  const normalizedCarId = normalizeCarId(carId);
  if (!normalizedCarId) {
    return;
  }

  await clientQuery(
    client,
    `
    DELETE FROM car_date_blocks
    WHERE car_id = $1 AND start_date = $2 AND end_date = $3
    `,
    [normalizedCarId, startDate, endDate]
  );
}

// Премахва blocks без съответстващ активен order – repair helper за drift.
async function purgeOrphaned(carId, client = null) {
  const normalizedCarId = normalizeCarId(carId);
  if (!normalizedCarId) {
    return;
  }

  const blocksResult = await clientQuery(
    client,
    `
    SELECT id, start_date, end_date
    FROM car_date_blocks
    WHERE car_id = $1
    `,
    [normalizedCarId]
  );

  if (!blocksResult.rows.length) {
    return;
  }

  const ordersResult = await clientQuery(
    client,
    `
    SELECT pickup_date, pickup_time, return_date, return_time
    FROM orders
    WHERE car_id = $1 AND is_deleted = FALSE
    `,
    [normalizedCarId]
  );

  const hasOverlapWithAnyOrder = (range) => {
    const rs = new Date(range.start_date);
    const re = new Date(range.end_date);

    return ordersResult.rows.some((order) => {
      const os = parseSofiaDate(order.pickup_date, order.pickup_time || '00:00');
      const oe = parseSofiaDate(order.return_date, order.return_time || '23:59');
      if (!os || !oe || Number.isNaN(os.getTime()) || Number.isNaN(oe.getTime())) {
        return false;
      }
      return os < re && oe > rs;
    });
  };

  const orphanIds = blocksResult.rows
    .filter((block) => !hasOverlapWithAnyOrder(block))
    .map((block) => block.id);

  if (!orphanIds.length) {
    return;
  }

  await clientQuery(
    client,
    `DELETE FROM car_date_blocks WHERE id = ANY($1::bigint[])`,
    [orphanIds]
  );
}

async function expireFinishedOrders(client = null) {
  const now = new Date();

  await clientQuery(
    client,
    `
    UPDATE orders
    SET status = 'expired',
        expired_at = $1,
        updated_at = $1
    WHERE return_date <= $1
      AND status NOT IN ('expired', 'cancelled')
      AND is_deleted = FALSE
    `,
    [now]
  );
}

async function fetchDateBlocksByCarIds(carIds, client = null) {
  const normalizedIds = [...new Set(
    carIds
      .map(normalizeCarId)
      .filter((id) => id !== null)
  )];

  const map = new Map();
  if (!normalizedIds.length) {
    return map;
  }

  const result = await clientQuery(
    client,
    `
    SELECT car_id, start_date, end_date
    FROM car_date_blocks
    WHERE car_id = ANY($1::bigint[])
    ORDER BY start_date ASC
    `,
    [normalizedIds]
  );

  for (const row of result.rows) {
    const carId = Number(row.car_id);
    if (!map.has(carId)) {
      map.set(carId, []);
    }
    map.get(carId).push({
      startDate: row.start_date,
      endDate: row.end_date,
    });
  }

  return map;
}

async function fetchDateBlocksForCar(carId, client = null) {
  const map = await fetchDateBlocksByCarIds([carId], client);
  const normalizedCarId = normalizeCarId(carId);
  return map.get(normalizedCarId) || [];
}

module.exports = {
  purgeExpired,
  purgeOrphaned,
  addRange,
  updateRange,
  moveRange,
  removeRange,
  expireFinishedOrders,
  fetchDateBlocksByCarIds,
  fetchDateBlocksForCar,
};
