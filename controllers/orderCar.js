// Car model – зарежда избраната кола преди order page.
const carRepository = require('../repositories/carRepository');
const { computeBookingPrice } = require('../utils/pricing');
const { formatDateForDisplay, formatLocationName } = require('../utils/dateFormatter');
const {
  getSessionId,
  buildExistingReservationSummary,
} = require('../utils/reservationHelpers');
const { validateBookingDates } = require('../utils/bookingValidation');
const {
  checkCarAvailabilityForRange,
  createPendingReservation,
  findActiveReservationBySession,
  attachCarNameToReservation,
} = require('../services/reservationService');
const {
  buildBaseOrderPayload,
  buildOrderViewModel,
} = require('../services/orderViewModelService');
const asyncHandler = require('../utils/asyncHandler');
const { NotFoundError, ValidationError } = require('../utils/appError');

module.exports.getOrderCar = asyncHandler(async (req, res) => {
    const {
      'pickup-date': pickupDateISO,
      'return-date': returnDateISO,
      'pickup-location': pickupLocation,
      'return-location': returnLocation,
      'pickup-time': pickupTime,
      'return-time': returnTime,
      carId,
    } = req.body || {};

    if (!carId) {
      throw new ValidationError('Car not specified.');
    }
    const car = await carRepository.findById(carId);
    if (!car) {
      throw new NotFoundError('Car not found.');
    }
    const pickupDateDisplay = formatDateForDisplay(pickupDateISO);
    const returnDateDisplay = formatDateForDisplay(returnDateISO);
    const pickupLocationDisplay = formatLocationName(pickupLocation);
    const returnLocationDisplay = formatLocationName(returnLocation);

    let pricing = {
      rentalDays: 0,
      deliveryPrice: 0,
      returnPrice: 0,
      totalPrice: 0,
    };

    const renderOrderPage = (overrides = {}, status = 200) => {
      const basePayload = buildBaseOrderPayload({
        pickupDateISO,
        returnDateISO,
        pickupTime,
        returnTime,
        pickupLocation,
        returnLocation,
        pickupDateDisplay,
        returnDateDisplay,
        pickupLocationDisplay,
        returnLocationDisplay,
        pricing,
        releaseRedirect: req.originalUrl,
      });

      const viewModel = buildOrderViewModel(car, basePayload, {
        message: overrides.message ?? null,
        existingReservation: overrides.existingReservation ?? null,
      });

      if (res.locals?.csrfToken) {
        viewModel.csrfToken = res.locals.csrfToken;
      }

      return res.status(status).render('orderMain', viewModel);
    };

    const {
      isValid,
      errors: bookingErrors,
      startDate,
      endDate,
    } = validateBookingDates({
      pickupDate: pickupDateISO,
      returnDate: returnDateISO,
      pickupTime: pickupTime || '00:00',
      returnTime: returnTime || '23:59',
    });

    if (!isValid || !startDate || !endDate) {
      if (startDate && endDate) {
        pricing = computeBookingPrice(car, startDate, endDate, pickupLocation, returnLocation);
      }
      return renderOrderPage(
        { message: bookingErrors[0] || 'Invalid booking dates.' },
        422
      );
    }

    pricing = computeBookingPrice(car, startDate, endDate, pickupLocation, returnLocation);
    if (!pricing || !Number.isFinite(pricing.totalPrice) || pricing.totalPrice <= 0) {
      return renderOrderPage(
        { message: 'Unable to calculate price for this rental. Please try again.' },
        422
      );
    }

    const sessionId = getSessionId(req);
    const now = new Date();

    let existingForSession = await findActiveReservationBySession(req);  // Има ли активна резервация за този session?
    if (existingForSession) {
      const sameReservationParams =
        String(existingForSession.carId) === String(car.id) &&
        existingForSession.pickupDate?.getTime?.() === startDate.getTime() &&
        existingForSession.returnDate?.getTime?.() === endDate.getTime() &&
        existingForSession.pickupTime === pickupTime &&
        existingForSession.returnTime === returnTime &&
        existingForSession.pickupLocation === pickupLocation &&
        existingForSession.returnLocation === returnLocation;

      if (sameReservationParams) {
        return renderOrderPage({ message: null, existingReservation: null });
      }

      existingForSession = await attachCarNameToReservation(existingForSession);
      return renderOrderPage({
        message:
          'You already have an active reservation. Please complete or release it before starting another.',
        existingReservation: buildExistingReservationSummary(existingForSession),
      });
    }

    const { overlappingReservation, bookedOverlap } = await checkCarAvailabilityForRange({  // Проверка за конфликти.
      carId: car.id,
      startDate,
      endDate,
      now,
    });

    if (overlappingReservation) {
      return renderOrderPage({
        message: 'Selected car is already reserved in this period. Please choose different dates or a different car.',
      });
    }

    if (bookedOverlap) {
      return renderOrderPage({
        message: 'Selected car is already booked in this period. Please choose different dates or a different car.',
      });
    }

    await createPendingReservation({
      carId: car.id,
      sessionId,
      startDate,
      endDate,
      pickupTime,
      returnTime,
      pickupLocation,
      returnLocation,
      pricing,
    });

    return renderOrderPage({ message: null, existingReservation: null });
  }); 
