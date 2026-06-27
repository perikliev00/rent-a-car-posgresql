const { createCheckoutSessionFlow } = require('../services/payment/checkout/checkoutSessionService');
const {
  renderOrderPage,
  renderSuccessPage,
} = require('../services/payment/paymentRenderService');
const { handleCheckoutSuccessFlow } = require('../services/payment/successService');
const { handleStripeWebhookFlow } = require('../services/payment/webhookService');
const { releaseActiveReservationForSession } = require('../services/reservationService');
const asyncHandler = require('../utils/asyncHandler');

exports.createCheckoutSession = asyncHandler(async (req, res) => {
  const result = await createCheckoutSessionFlow(req);

  if (result.type === 'renderOrderPage') {
    return renderOrderPage(
      req,
      res,
      result.car,
      result.formData,
      result.message,
      result.options
    );
  }

  if (result.type === 'redirect') {
    return res.redirect(result.statusCode, result.url);
  }

  throw new Error('Unexpected checkout session flow result.');
});

exports.handleCheckoutSuccess = asyncHandler(async (req, res) => {
  const result = await handleCheckoutSuccessFlow(req);
  return renderSuccessPage(res, result);
});

exports.handleCheckoutCancel = asyncHandler(async (req, res) => {
  try {
    await releaseActiveReservationForSession(req);
  } catch (err) {
    console.error('Cancel handler error:', {
      correlationId: req.correlationId,
      message: err.message,
    });
  }

  return res.send('Payment cancelled. You can start a new reservation when ready.');
});

exports.handleStripeWebhook = asyncHandler(async (req, res) => {
  const result = await handleStripeWebhookFlow(req);
  return res.status(result.statusCode).json(result.body);
});