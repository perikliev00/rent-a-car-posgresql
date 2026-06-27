const reservationRepository = require('../../../repositories/reservationRepository');

async function compensateReservationAfterStripeFailure(reservationDoc) {
  if (!reservationDoc) {
    return;
  }

  reservationDoc.status = 'cancelled';
  reservationDoc.holdExpiresAt = new Date();
  await reservationRepository.update(reservationDoc);
}

module.exports = {
  compensateReservationAfterStripeFailure,
};
