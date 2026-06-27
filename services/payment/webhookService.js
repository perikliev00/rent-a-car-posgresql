const stripe = require('../../config/stripe');
const { ValidationError } = require('../../utils/appError');
const { processStripeWebhookEvent } = require('../bookingFinalizationService');

// handleStripeWebhookFlow – валидира подпис, обработва checkout.session.completed.
async function handleStripeWebhookFlow(req) {
  const logPrefix = '🌐 [StripeWebhook]';
  console.log('════════════════════════════════════════════════════');
  console.log(
    `${logPrefix} HIT @ ${new Date().toISOString()} ${req.method} ${req.originalUrl}`
  );
  const sig = req.headers['stripe-signature'];   // Подпис за верификация.
  let event;

  try {
    event = stripe.webhooks.constructEvent(     // Верификация на подписа.
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error(`${logPrefix} ❌ Webhook signature verification failed:`, err.message);
    throw new ValidationError('Webhook signature verification failed.');
  }

  console.log(`${logPrefix} Parsed event type: ${event.type}`, event.id ? `id=${event.id}` : '');

  if (event.type === 'checkout.session.completed') {  // Единственият обработван тип.
    const session = event.data && event.data.object;  // Checkout session обект.
    if (!session || !session.id) {
      console.error(`${logPrefix} ❌ Webhook session missing id.`);
      return {
        statusCode: 200,
        body: { received: true },
      };
    }

    const stripeSessionId = session.id;
    console.log(`${logPrefix} checkout.session.completed for session ${stripeSessionId}`);

    const result = await processStripeWebhookEvent({
      eventId: event.id,
      stripeSessionId,
      logPrefix: `${logPrefix}[${req.correlationId}]`,
    });

    if (result?.reason === 'duplicate_event') {
      console.log(`${logPrefix} ℹ️ Event ${event.id} already processed, skipping`);
      return {
        statusCode: 200,
        body: { received: true },
      };
    }

    console.log(`${logPrefix} Reservation lookup result:`, !!result?.reservation);

    if (!result?.found) {
      console.warn(`${logPrefix} ⚠️ No reservation for stripeSessionId ${stripeSessionId}`);
      return {
        statusCode: 200,
        body: { received: true },
      };
    }

    if (result.reason === 'status_not_active' && result.reservation) {
      console.warn(
        `${logPrefix} ⚠️ Reservation status is not active`,
        result.reservation.id.toString(),
        'status=',
        result.reservation.status
      );
      return {
        statusCode: 200,
        body: { received: true },
      };
    }
  }

  console.log(`${logPrefix} Responding 200 { received: true }`);
  return {
    statusCode: 200,
    body: { received: true },
  };
}

module.exports = {
  handleStripeWebhookFlow,
};
