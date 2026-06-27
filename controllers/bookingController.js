// validationResult – резултат от route-level express-validator правила.
const { validationResult } = require('express-validator');
const carRepository = require('../repositories/carRepository');
const { computeBookingPrice } = require('../utils/pricing');
const { getSessionId } = require('../utils/reservationHelpers');
const { validateBookingDates } = require('../utils/bookingValidation');
const {
  releaseActiveReservationForSession,
  checkCarAvailabilityForRange,
  createPendingReservation,
} = require('../services/reservationService');
// Освобождава активната резервация за session-а – JSON или redirect според caller.
exports.releaseActiveReservation = async (req, res) => {
  const wantsJson =
    req.headers.accept && req.headers.accept.includes('application/json');
  const redirectTo = req.body.redirect || req.get('referer') || '/';

  try {
    const { cancelled } = await releaseActiveReservationForSession(req);

    if (!cancelled) {
      if (wantsJson) {
        return res.status(404).json({ ok: false, message: 'No active reservation.' });
      }
      return res.redirect(redirectTo);
    }

    if (wantsJson) {
      return res.json({ ok: true });
    }
    return res.redirect(redirectTo);
  } catch (err) {
    console.error('Release reservation error:', err);
    if (wantsJson) {
      return res
        .status(500)
        .json({ ok: false, message: 'Failed to release reservation.' });
    }
    return res.redirect(redirectTo);
  }
};

// Заменя текущия hold с нов при промяна на dates/car/location на order page.
exports.releaseAndReholdReservation = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      ok: false,
      message: errors.array()[0]?.msg || 'Invalid request.',
      errors: errors.array(),
    });
  }

  const {
    carId,
    pickupDate,
    returnDate,
    pickupTime,
    returnTime,
    pickupLocation,
    returnLocation,
  } = req.body || {};

  try {
    const car = await carRepository.findById(carId);
    if (!car) {
      return res.status(404).json({ ok: false, message: 'Car not found' });
    }

    const normalizedPickupTime = pickupTime || '00:00';
    const normalizedReturnTime = returnTime || '23:59';

    const {
      isValid,
      errors: bookingErrors,
      startDate,
      endDate,
    } = validateBookingDates({
      pickupDate,
      returnDate,
      pickupTime: normalizedPickupTime,
      returnTime: normalizedReturnTime,
    });

    if (!isValid || !startDate || !endDate) {
      return res.status(422).json({
        ok: false,
        message: bookingErrors[0] || 'Invalid booking dates',
      });
    }

    const pricing = computeBookingPrice(
      car,
      startDate,
      endDate,
      pickupLocation,
      returnLocation
    );
    if (!pricing || !Number.isFinite(pricing.totalPrice) || pricing.totalPrice <= 0) {
      return res.status(422).json({ ok: false, message: 'Unable to calculate price' });
    }

    await releaseActiveReservationForSession(req);

    const { overlappingReservation, bookedOverlap } =
      await checkCarAvailabilityForRange({
        carId: car.id,
        startDate,
        endDate,
        now: new Date(),
      });

    if (overlappingReservation || bookedOverlap) {
      return res.status(409).json({
        ok: false,
        message: 'Selected car is already reserved/booked in this period.',
      });
    }

    await createPendingReservation({
      carId: car.id,
      sessionId: getSessionId(req),
      startDate,
      endDate,
      pickupTime: normalizedPickupTime,
      returnTime: normalizedReturnTime,
      pickupLocation,
      returnLocation,
      pricing,
    });

    return res.status(200).json({ ok: true, reheld: true });
  } catch (err) {
    console.error('releaseAndReholdReservation error:', err);
    return res.status(500).json({
      ok: false,
      message: 'Failed to release and re-hold reservation.',
    });
  }
};
