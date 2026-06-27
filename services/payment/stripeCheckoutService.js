const stripe = require('../../config/stripe');

async function createStripeCheckoutSession({ req, car, pricing }) {
  return stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'eur',
          product_data: { name: `Car Rental – ${car.name}` },
          unit_amount: Math.round(Number(pricing.totalPrice) * 100),
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${req.protocol}://${req.get('host')}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${req.protocol}://${req.get('host')}/cancel?session_id={CHECKOUT_SESSION_ID}`,
  });
}

module.exports = {
  createStripeCheckoutSession,
};
