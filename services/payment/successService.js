const stripe = require('../../config/stripe');
const { findOrderByStripeSessionId } = require('../sql/orderSqlService');
const { ValidationError } = require('../../utils/appError');

async function handleCheckoutSuccessFlow(req) {
  console.log('💥 /success HIT');

  const stripeSessionId = req.query.session_id;
  if (!stripeSessionId) {
    throw new ValidationError('Invalid checkout session.');
  }

  const session = await stripe.checkout.sessions.retrieve(stripeSessionId);

  if (session.payment_status !== 'paid') {
    throw new ValidationError('Payment was not completed.');
  }

  const order = await findOrderByStripeSessionId(stripeSessionId);
  const confirmed = !!order;

  console.log('🔎 Webhook fulfillment complete for session?', confirmed, stripeSessionId);

  return {
    title: 'Payment Success',
    confirmed,
    message: confirmed
      ? 'Your booking has been confirmed and added to our system.'
      : 'Your payment was received. We are confirming your booking — this usually takes a few seconds.',
  };
}

module.exports = {
  handleCheckoutSuccessFlow,
};
