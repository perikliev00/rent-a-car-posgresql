const carRepository = require('../../../repositories/carRepository');
const reservationRepository = require('../../../repositories/reservationRepository');
const { NotFoundError, ExternalServiceError } = require('../../../utils/appError');
const { createStripeCheckoutSession } = require('../stripeCheckoutService');
const { validateCheckoutRequest } = require('./checkoutValidationService');
const { resolveCheckoutPricing } = require('./checkoutPricingService');
const { resolveCheckoutReservation } = require('./checkoutReservationService');
const { compensateReservationAfterStripeFailure } = require('./checkoutCompensationService');
const {
  buildRenderOrderPageResponse,
  buildRedirectResponse,
} = require('./checkoutResponseFactory');

async function createCheckoutSessionFlow(req) {
  const formData = { ...req.body, releaseRedirect: req.originalUrl };

  const car = await carRepository.findById(formData.carId);
  if (!car) {
    throw new NotFoundError('Car not found.');
  }

  const validation = validateCheckoutRequest(req, car, formData);
  if (!validation.ok) {
    return validation.response;
  }

  const { startDate, endDate } = validation;

  const pricingResult = resolveCheckoutPricing(car, formData, startDate, endDate);
  if (!pricingResult.ok) {
    return pricingResult.response;
  }

  const { pricing } = pricingResult;

  const reservationResult = await resolveCheckoutReservation({
    req,
    car,
    formData,
    startDate,
    endDate,
    pricing,
  });
  if (!reservationResult.ok) {
    return reservationResult.response;
  }

  const { reservationDoc, createdReservationThisStep } = reservationResult;

  let stripeSession;
  try {
    stripeSession = await createStripeCheckoutSession({ req, car, pricing });
  } catch (err) {
    console.error('Stripe session creation failed:', {
      correlationId: req.correlationId,
      message: err.message,
    });

    await compensateReservationAfterStripeFailure(
      reservationDoc,
      createdReservationThisStep
    );

    return buildRenderOrderPageResponse(
      car,
      formData,
      'Unable to start payment. Please try again in a minute.',
      {
        rentalDays: pricing.rentalDays,
        deliveryPrice: pricing.deliveryPrice,
        returnPrice: pricing.returnPrice,
        totalPrice: pricing.totalPrice,
      }
    );
  }

  reservationDoc.stripeSessionId = stripeSession.id;
  reservationDoc.status = 'processing';

  try {
    await reservationRepository.update(reservationDoc);
  } catch (err) {
    throw new ExternalServiceError(
      'Payment was prepared, but the reservation state could not be saved safely.',
      { reservationId: reservationDoc.id.toString() },
      { isOperational: false }
    );
  }

  return buildRedirectResponse(stripeSession.url);
}

module.exports = {
  createCheckoutSessionFlow,
};
