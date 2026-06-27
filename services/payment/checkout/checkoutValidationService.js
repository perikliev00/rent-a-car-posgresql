const { validationResult } = require('express-validator');
const { validateBookingDates } = require('../../../utils/bookingValidation');
const { buildRenderOrderPageResponse } = require('./checkoutResponseFactory');

function validationResultFromReq(req) {
  return validationResult(req);
}

function validateCheckoutRequest(req, car, formData) {
  const errors = validationResultFromReq(req);

  if (!errors.isEmpty()) {
    const message = errors.array()[0].msg;
    return {
      ok: false,
      response: buildRenderOrderPageResponse(car, formData, message, {}),
    };
  }

  const {
    isValid,
    errors: bookingErrors,
    startDate,
    endDate,
  } = validateBookingDates({
    pickupDate: formData.pickupDate,
    returnDate: formData.returnDate,
    pickupTime: formData.pickupTime || '00:00',
    returnTime: formData.returnTime || '23:59',
  });

  if (!isValid || !startDate || !endDate) {
    const message =
      bookingErrors[0] || 'Invalid booking dates. Please choose a different range.';
    return {
      ok: false,
      response: buildRenderOrderPageResponse(car, formData, message, {}),
    };
  }

  return {
    ok: true,
    startDate,
    endDate,
  };
}

module.exports = {
  validationResultFromReq,
  validateCheckoutRequest,
};
