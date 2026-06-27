// Stripe SDK клиентът се използва при създаване на checkout sessions и верифициране на webhooks.
const Stripe = require('stripe');

// Един споделен Stripe клиент – secret key от environment променливи.
const stripe = new Stripe(process.env.STRIPE_SECRET);

// Експорт – controllers/services да преизползват същата конфигурация.
module.exports = stripe;
