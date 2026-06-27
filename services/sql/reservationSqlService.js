const { clientQuery } = require('../../db/transaction');
const {
  ACTIVE_RESERVATION_STATUSES,
  HOLD_WINDOW_MS,
} = require('../../utils/reservationHelpers');

const ACTIVE_STATUS_SQL = ACTIVE_RESERVATION_STATUSES.map((s) => `'${s}'`).join(', ');

function normalizeCarId(carId) {
  const id = Number(carId);
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
}

function toNumberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function mapSqlReservation(row) {
  if (!row) {
    return null;
  }

  const carIdValue = row.car_id != null ? String(row.car_id) : undefined;
  const hasPopulatedCar = row.car_name != null && row.car_id != null;

  return {
    id: String(row.id),
    carId: hasPopulatedCar
      ? { id: String(row.car_id), name: row.car_name }
      : carIdValue,
    sessionId: row.session_id,
    pickupDate: row.pickup_date,
    pickupTime: row.pickup_time || undefined,
    returnDate: row.return_date,
    returnTime: row.return_time || undefined,
    pickupLocation: row.pickup_location,
    returnLocation: row.return_location,
    rentalDays: Number(row.rental_days),
    deliveryPrice: toNumberOrZero(row.delivery_price),
    returnPrice: toNumberOrZero(row.return_price),
    totalPrice: toNumberOrZero(row.total_price),
    fullName: row.full_name || undefined,
    phoneNumber: row.phone_number || undefined,
    email: row.email || undefined,
    address: row.address || undefined,
    hotelName: row.hotel_name || undefined,
    status: row.status,
    holdExpiresAt: row.hold_expires_at,
    stripeSessionId: row.stripe_session_id || undefined,
    stripePaymentIntentId: row.stripe_payment_intent_id || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const RESERVATION_SELECT = `
  r.id,
  r.car_id,
  r.session_id,
  r.pickup_date,
  r.pickup_time,
  r.return_date,
  r.return_time,
  r.pickup_location,
  r.return_location,
  r.rental_days,
  r.delivery_price,
  r.return_price,
  r.total_price,
  r.full_name,
  r.phone_number,
  r.email,
  r.address,
  r.hotel_name,
  r.status,
  r.hold_expires_at,
  r.stripe_session_id,
  r.stripe_payment_intent_id,
  r.created_at,
  r.updated_at
`;

async function findActiveBySessionId(sessionId, client = null) {
  if (!sessionId) {
    return null;
  }

  const result = await clientQuery(
    client,
    `
    SELECT
      ${RESERVATION_SELECT},
      c.name AS car_name
    FROM reservations r
    LEFT JOIN cars c ON c.id = r.car_id
    WHERE r.session_id = $1
      AND r.status = ANY($2::text[])
      AND r.hold_expires_at > $3
    ORDER BY r.created_at DESC
    LIMIT 1
    `,
    [sessionId, ACTIVE_RESERVATION_STATUSES, new Date()]
  );

  return mapSqlReservation(result.rows[0]) || null;
}

async function findOverlappingHold(
  { carId, startDate, endDate, now = new Date(), excludeSessionId = null },
  client = null
) {
  const normalizedCarId = normalizeCarId(carId);
  if (!normalizedCarId) {
    return null;
  }

  const params = [
    normalizedCarId,
    ACTIVE_RESERVATION_STATUSES,
    now,
    endDate,
    startDate,
  ];
  let excludeSql = '';

  if (excludeSessionId) {
    params.push(excludeSessionId);
    excludeSql = `AND r.session_id <> $${params.length}`;
  }

  const result = await clientQuery(
    client,
    `
    SELECT ${RESERVATION_SELECT}
    FROM reservations r
    WHERE r.car_id = $1
      AND r.status = ANY($2::text[])
      AND r.hold_expires_at > $3
      AND r.pickup_date < $4
      AND r.return_date > $5
      ${excludeSql}
    LIMIT 1
    `,
    params
  );

  return mapSqlReservation(result.rows[0]) || null;
}

async function findBookedDateOverlap(carId, startDate, endDate, client = null) {
  const normalizedCarId = normalizeCarId(carId);
  if (!normalizedCarId) {
    return null;
  }

  const result = await clientQuery(
    client,
    `
    SELECT 1
    FROM car_date_blocks b
    WHERE b.car_id = $1
      AND b.start_date < $3
      AND b.end_date > $2
    LIMIT 1
    `,
    [normalizedCarId, startDate, endDate]
  );

  if (!result.rowCount) {
    return null;
  }

  return { id: String(normalizedCarId) };
}

async function createPendingReservation(
  {
    carId,
    sessionId,
    startDate,
    endDate,
    pickupTime,
    returnTime,
    pickupLocation,
    returnLocation,
    pricing,
    contact = {},
  },
  client = null
) {
  const normalizedCarId = normalizeCarId(carId);
  if (!normalizedCarId) {
    throw new Error('Invalid car id');
  }

  const {
    fullName = '',
    phoneNumber = '',
    email = '',
    address = '',
    hotelName = '',
  } = contact;

  const holdExpiresAt = new Date(Date.now() + HOLD_WINDOW_MS);

  const result = await clientQuery(
    client,
    `
    INSERT INTO reservations (
      car_id,
      session_id,
      pickup_date,
      pickup_time,
      return_date,
      return_time,
      pickup_location,
      return_location,
      rental_days,
      delivery_price,
      return_price,
      total_price,
      full_name,
      phone_number,
      email,
      address,
      hotel_name,
      status,
      hold_expires_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12, $13, $14, $15, $16, $17,
      'pending', $18
    )
    RETURNING *
    `,
    [
      normalizedCarId,
      sessionId,
      startDate,
      pickupTime || null,
      endDate,
      returnTime || null,
      pickupLocation,
      returnLocation,
      pricing.rentalDays,
      pricing.deliveryPrice ?? 0,
      pricing.returnPrice ?? 0,
      pricing.totalPrice,
      fullName || null,
      phoneNumber || null,
      email || null,
      address || null,
      hotelName || null,
      holdExpiresAt,
    ]
  );

  return mapSqlReservation(result.rows[0]);
}

async function update(reservation, client = null) {
  const reservationId = Number(reservation.id);
  if (!Number.isInteger(reservationId) || reservationId <= 0) {
    throw new Error('Invalid reservation id');
  }

  const result = await clientQuery(
    client,
    `
    UPDATE reservations
    SET
      car_id = $2,
      session_id = $3,
      pickup_date = $4,
      pickup_time = $5,
      return_date = $6,
      return_time = $7,
      pickup_location = $8,
      return_location = $9,
      rental_days = $10,
      delivery_price = $11,
      return_price = $12,
      total_price = $13,
      full_name = $14,
      phone_number = $15,
      email = $16,
      address = $17,
      hotel_name = $18,
      status = $19,
      hold_expires_at = $20,
      stripe_session_id = $21,
      stripe_payment_intent_id = $22,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [
      reservationId,
      normalizeCarId(
        reservation.carId?.id || reservation.carId
      ),
      reservation.sessionId,
      reservation.pickupDate,
      reservation.pickupTime || null,
      reservation.returnDate,
      reservation.returnTime || null,
      reservation.pickupLocation,
      reservation.returnLocation,
      reservation.rentalDays,
      reservation.deliveryPrice ?? 0,
      reservation.returnPrice ?? 0,
      reservation.totalPrice,
      reservation.fullName || null,
      reservation.phoneNumber || null,
      reservation.email || null,
      reservation.address || null,
      reservation.hotelName || null,
      reservation.status,
      reservation.holdExpiresAt,
      reservation.stripeSessionId || null,
      reservation.stripePaymentIntentId || null,
    ]
  );

  return mapSqlReservation(result.rows[0]);
}

async function findByStripeSessionId(stripeSessionId, client = null) {
  if (!stripeSessionId) {
    return null;
  }

  const result = await clientQuery(
    client,
    `
    SELECT
      ${RESERVATION_SELECT},
      c.name AS car_name
    FROM reservations r
    LEFT JOIN cars c ON c.id = r.car_id
    WHERE r.stripe_session_id = $1
    LIMIT 1
    `,
    [stripeSessionId]
  );

  return mapSqlReservation(result.rows[0]) || null;
}

async function markAbandonedReservations(activeSessionIds, now = new Date(), client = null) {
  const params = [ACTIVE_RESERVATION_STATUSES, now];
  const conditions = ['r.hold_expires_at <= $2', 'r.session_id IS NULL'];

  if (activeSessionIds.length) {
    params.push(activeSessionIds);
    conditions.push(`r.session_id <> ALL($${params.length}::text[])`);
  }

  const result = await clientQuery(
    client,
    `
    UPDATE reservations r
    SET status = 'expired',
        hold_expires_at = $2,
        updated_at = $2
    WHERE r.status = ANY($1::text[])
      AND (${conditions.join(' OR ')})
    `,
    params
  );

  return result.rowCount || 0;
}

module.exports = {
  ACTIVE_STATUS_SQL,
  mapSqlReservation,
  findActiveBySessionId,
  findByStripeSessionId,
  findOverlappingHold,
  findBookedDateOverlap,
  createPendingReservation,
  update,
  markAbandonedReservations,
};
