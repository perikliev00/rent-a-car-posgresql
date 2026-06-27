const {
  HOLD_WINDOW_MS,
  getSessionId,
} = require('../utils/reservationHelpers');
const reservationRepository = require('../repositories/reservationRepository');
const sessionSql = require('./sql/sessionSqlService');
const carRepository = require('../repositories/carRepository');

async function findActiveReservationBySession(req) {
  return reservationRepository.findActiveBySessionId(getSessionId(req));
}

async function releaseActiveReservationForSession(req) {
  const reservation = await findActiveReservationBySession(req);

  if (!reservation) {
    return { cancelled: false, reservation: null };
  }

  reservation.status = 'cancelled';
  reservation.holdExpiresAt = new Date();
  const updated = await reservationRepository.update(reservation);

  return { cancelled: true, reservation: updated };
}

function extendReservationHold(reservation) {
  if (!reservation) {
    return reservation;
  }

  reservation.holdExpiresAt = new Date(Date.now() + HOLD_WINDOW_MS);
  return reservation;
}

async function checkCarAvailabilityForRange({
  carId,
  startDate,
  endDate,
  now = new Date(),
}) {
  if (!carId || !(startDate instanceof Date) || !(endDate instanceof Date)) {
    throw new Error('checkCarAvailabilityForRange: invalid arguments');
  }

  const overlappingReservation = await reservationRepository.findOverlappingHold({
    carId,
    startDate,
    endDate,
    now,
  });
  const bookedOverlap = await reservationRepository.findBookedDateOverlap(
    carId,
    startDate,
    endDate
  );

  return {
    overlappingReservation,
    bookedOverlap,
  };
}

async function createPendingReservation(payload) {
  return reservationRepository.create(payload);
}

async function attachCarNameToReservation(reservation) {
  if (!reservation) {
    return reservation;
  }

  const rawCarId =
    reservation.carId && typeof reservation.carId === 'object'
      ? reservation.carId.id
      : reservation.carId;

  if (!rawCarId) {
    return reservation;
  }

  const car = await carRepository.findById(rawCarId);
  if (!car) {
    return reservation;
  }

  return {
    ...reservation,
    carId: { id: car.id, name: car.name },
  };
}

async function cleanUpAbandonedReservations() {
  try {
    const nowUTC = new Date();
    const activeSids = await sessionSql.listActiveSessionIds();
    const modifiedCount = await reservationRepository.markAbandoned(
      activeSids,
      nowUTC
    );

    if (modifiedCount) {
      console.log(`🧽 Marked ${modifiedCount} reservation(s) as expired or abandoned.`);
    }
  } catch (err) {
    console.error('Cleanup error (abandoned reservations):', err);
  }
}

module.exports = {
  findActiveReservationBySession,
  releaseActiveReservationForSession,
  extendReservationHold,
  attachCarNameToReservation,
  checkCarAvailabilityForRange,
  createPendingReservation,
  cleanUpAbandonedReservations,
};
