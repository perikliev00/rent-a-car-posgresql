const { computeBookingPrice } = require('../../../utils/pricing');
const { buildRenderOrderPageResponse } = require('./checkoutResponseFactory');

function resolveCheckoutPricing(car, formData, startDate, endDate) {
  const pricing = computeBookingPrice(
    car,
    startDate,
    endDate,
    formData.pickupLocation,
    formData.returnLocation
  );

  if (!pricing || !Number.isFinite(pricing.totalPrice) || pricing.totalPrice <= 0) {
    return {
      ok: false,
      response: buildRenderOrderPageResponse(
        car,
        formData,
        'Unable to calculate price for this rental. Please try again.',
        {}
      ),
    };
  }

  return { ok: true, pricing };
}

module.exports = {
  resolveCheckoutPricing,
};
