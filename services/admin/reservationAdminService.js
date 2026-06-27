const reservationRepository = require('../../repositories/reservationRepository');

async function findActiveReservationHold(carId, start, end) {
  return reservationRepository.findOverlappingHold({
    carId,
    startDate: start,
    endDate: end,
  });
}

module.exports = {
  findActiveReservationHold,
};
