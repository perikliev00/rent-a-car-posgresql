// Date formatter се използва при изграждане на user-facing reservation warning обобщения.
const { formatDateForDisplay } = require('./dateFormatter');

// Reservation статуси които още блокират наличността и се считат за активни в booking flow.
const ACTIVE_RESERVATION_STATUSES = ['pending', 'processing'];
// Подразбиране за hold време в милисекунди за временни session-bound reservations.
const HOLD_WINDOW_MS = 20 * 60 * 1000;

// Връща най-надеждния session идентификатор на текущата заявка.
function getSessionId(req) {
  // Приоритет: _sid в session payload; fallback – Express-генерирания session ID.
  return (req.session && (req.session._sid || req.sessionID)) || req.sessionID;
}

// Създава кратно summary за warning баннери при съществуваща активна резервация.
function buildExistingReservationSummary(reservation) {
  if (!reservation) return null;
  // Използваме populated car name когато е налично; иначе generic label.
  const carName = reservation.carId && reservation.carId.name ? reservation.carId.name : 'Reserved car';
  // Форматираме total price до 2 десетични само ако е число.
  const totalPrice =
    reservation.totalPrice != null && typeof reservation.totalPrice === 'number'
      ? reservation.totalPrice.toFixed(2)
      : null;
  // Връщаме формата очаквана от warning компоненти/шаблони.
  return {
    carName,
    pickupDate: formatDateForDisplay(reservation.pickupDate),
    returnDate: formatDateForDisplay(reservation.returnDate),
    totalPrice,
  };
}

// Експорт на споделените константи и helpers за reservation flow.
module.exports = {
  ACTIVE_RESERVATION_STATUSES,
  HOLD_WINDOW_MS,
  getSessionId,
  buildExistingReservationSummary,
};
