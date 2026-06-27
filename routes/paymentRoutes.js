// Express router – success/cancel страници и create-checkout-session endpoint.
const express = require('express');
// Router instance – consumed от server.js.
const router = express.Router();
const paymentController = require('../controllers/payment');
// Route-level validators – защита на checkout payload преди controller логика.
const { body } = require('express-validator');
// CSRF middleware – защита на checkout form submission.
const { csrfProtection, setCsrfToken } = require('../middleware/csrf');

// Създава Stripe Checkout session след валидиране на booking/contact от order page.
router.post(
  '/create-checkout-session',
  // CSRF защита – формата трябва да идва от нашето приложение.
  csrfProtection,
  // Генерира token за re-render при validation грешки.
  setCsrfToken,
  [
    body('fullName').notEmpty().withMessage('Please enter your full name'),
    body('phoneNumber')
      .notEmpty()
      .withMessage('Please enter your phone number')
      .isMobilePhone('any')
      .withMessage('Please enter a valid phone number'),
    body('email')
      .notEmpty()
      .withMessage('Please enter your email')
      .isEmail()
      .withMessage('Please enter a valid email address'),
    body('address').notEmpty().withMessage('Please enter your address'),
    body('hotelName').notEmpty().withMessage('Please enter your hotel name'),
  ],
  paymentController.createCheckoutSession
);
// Stripe пренасочва тук след успешен платежен опит.
router.get('/success', paymentController.handleCheckoutSuccess);
// Stripe пренасочва тук при отказ от checkout от клиента.
router.get('/cancel', paymentController.handleCheckoutCancel);

// Ръчен тест – потвърждение че приложението получава заявки към webhook namespace.
router.get('/webhook/stripe-test', (req, res) => {
  console.log('🚨 TEST: /webhook/stripe-test HIT');
  res.send('Webhook TEST OK');
});

// Webhook се mount-ва в server.js с express.raw() за raw body.

module.exports = router;
