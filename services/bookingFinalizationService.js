const reservationRepository = require('../repositories/reservationRepository');
const orderSql = require('./sql/orderSqlService');
const stripeEventSql = require('./sql/processedStripeEventSqlService');
const { addRange } = require('./sql/bookingSyncSqlService');
const { ACTIVE_RESERVATION_STATUSES } = require('../utils/reservationHelpers');
const {
  AppError,
  ConflictError,
  NotFoundError,
} = require('../utils/appError');
const { runWithTransaction } = require('../db/transaction');

async function finalizeReservationCore(stripeSessionId, options = {}, client = null) {
  const { logPrefix, requireActiveStatus = false } = options;

  if (!stripeSessionId) {
    throw new NotFoundError('Stripe checkout session was not provided.');
  }

  const reservation = await reservationRepository.findByStripeSessionId(stripeSessionId, client);

  if (!reservation) {
    if (logPrefix) {
      console.warn(`${logPrefix} ⚠️ No reservation for stripeSessionId ${stripeSessionId}`);
    }

    return { found: false, finalized: false, reservation: null, reason: 'not_found' };
  }

  const existingOrder = await orderSql.findOrderByReservationId(reservation.id, client);

  if (reservation.status === 'confirmed' && existingOrder) {
    if (logPrefix) {
      console.log(`${logPrefix} ℹ️ Reservation already confirmed`, reservation.id.toString());
    }

    return {
      found: true,
      finalized: false,
      reservation,
      order: existingOrder,
      reason: 'already_confirmed',
    };
  }

  if (reservation.status === 'confirmed' && !existingOrder) {
    throw new AppError(
      'FINALIZATION_STATE_CORRUPTED',
      500,
      'Reservation is marked as confirmed but has no matching order.',
      {
        reservationId: reservation.id.toString(),
      },
      { isOperational: false }
    );
  }

  if (requireActiveStatus && !ACTIVE_RESERVATION_STATUSES.includes(reservation.status)) {
    if (logPrefix) {
      console.warn(
        `${logPrefix} ⚠️ Reservation status is not active`,
        reservation.id.toString(),
        'status=',
        reservation.status
      );
    }

    return {
      found: true,
      finalized: false,
      reservation,
      order: existingOrder || null,
      reason: 'status_not_active',
    };
  }

  if (existingOrder && reservation.status !== 'confirmed') {
    throw new AppError(
      'FINALIZATION_STATE_CORRUPTED',
      500,
      'Reservation finalization is in an inconsistent state.',
      {
        reservationId: reservation.id.toString(),
        status: reservation.status,
      },
      { isOperational: false }
    );
  }

  const carId = reservation.carId?.id || reservation.carId;

  try {
    await addRange(carId, reservation.pickupDate, reservation.returnDate, client);
  } catch (err) {
    if (err && err.code === 'OVERLAP') {
      throw new ConflictError(
        'Reservation overlaps with an existing booked period.',
        {
          reservationId: reservation.id.toString(),
          carId: String(carId),
        }
      );
    }

    throw err;
  }

  const order = await orderSql.createOrderFromReservation(reservation, carId, client);

  reservation.status = 'confirmed';
  reservation.holdExpiresAt = new Date();
  const updatedReservation = await reservationRepository.update(reservation, client);

  if (logPrefix) {
    console.log(`${logPrefix} ✅ Car availability updated for car ${carId}`);
    console.log(`${logPrefix} ✅ Order document created`);
    console.log(`${logPrefix} ✅ Reservation ${reservation.id.toString()} marked as confirmed`);
  }

  return {
    found: true,
    finalized: true,
    reservation: updatedReservation,
    order,
    reason: 'finalized',
  };
}

async function finalizeReservationByStripeSessionId(stripeSessionId, options = {}) {
  let result;

  await runWithTransaction(async (client) => {
    result = await finalizeReservationCore(stripeSessionId, options, client);
  });

  return result;
}

async function processStripeWebhookEvent({ eventId, stripeSessionId, logPrefix }) {
  if (!eventId || !stripeSessionId) {
    throw new NotFoundError('Stripe webhook event payload is incomplete.');
  }

  let result;

  await runWithTransaction(async (client) => {
    const inserted = await stripeEventSql.insertProcessedEvent(
      { eventId, stripeSessionId },
      client
    );

    if (!inserted) {
      result = {
        found: true,
        finalized: false,
        reservation: null,
        reason: 'duplicate_event',
      };
      return;
    }

    result = await finalizeReservationCore(
      stripeSessionId,
      { logPrefix, requireActiveStatus: true },
      client
    );
  });

  if (result && result.reason === 'finalized') {
    return result;
  }

  if (
    result &&
    result.reason !== 'duplicate_event' &&
    result.reason !== 'already_confirmed' &&
    result.reason !== 'status_not_active' &&
    result.reason !== 'not_found'
  ) {
    throw new ConflictError('Stripe webhook finalization completed with an unknown state.');
  }

  return result;
}

module.exports = {
  finalizeReservationByStripeSessionId,
  processStripeWebhookEvent,
};
