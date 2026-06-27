const reservationSql = require('../services/sql/reservationSqlService');

async function findActiveBySessionId(sessionId, client = null) {
  return reservationSql.findActiveBySessionId(sessionId, client);
}

async function findByStripeSessionId(stripeSessionId, client = null) {
  return reservationSql.findByStripeSessionId(stripeSessionId, client);
}

async function findOverlappingHold(criteria, client = null) {
  return reservationSql.findOverlappingHold(criteria, client);
}

async function findBookedDateOverlap(carId, startDate, endDate, client = null) {
  return reservationSql.findBookedDateOverlap(carId, startDate, endDate, client);
}

async function create(payload, client = null) {
  return reservationSql.createPendingReservation(payload, client);
}

async function update(reservation, client = null) {
  return reservationSql.update(reservation, client);
}

async function markAbandoned(activeSessionIds, now = new Date(), client = null) {
  return reservationSql.markAbandonedReservations(activeSessionIds, now, client);
}

module.exports = {
  findActiveBySessionId,
  findByStripeSessionId,
  findOverlappingHold,
  findBookedDateOverlap,
  create,
  update,
  markAbandoned,
};
