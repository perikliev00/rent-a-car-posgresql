// Express router – support страници и JSON chat/support APIs.
const express = require('express');
const router = express.Router();
const supportController = require('../controllers/supportController');
const contactController = require('../controllers/contactController');
const { csrfProtection, setCsrfToken } = require('../middleware/csrf');
const { contactLimiter } = require('../middleware/rateLimit');
const { body, query, param } = require('express-validator');

router.get('/support/phone', supportController.getPhoneSupport);
router.get('/support/email', csrfProtection, setCsrfToken, contactController.getContacts);
router.get('/support/visit', supportController.getVisitLocation);
router.get('/support/chat', supportController.getLiveChat);
router.post(
  '/support/email',
  contactLimiter,
  // Validate CSRF token from the support/contact form.
  csrfProtection,
  // Re-seed the token if the form must be re-rendered with validation errors.
  setCsrfToken,
  [
    // Name is required and bounded in length.
    body('name')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Please enter your full name (2–100 characters).'),
    // Email must be valid and not overly long.
    body('email')
      .trim()
      .isEmail()
      .withMessage('Please enter a valid email address.')
      .isLength({ max: 150 })
      .withMessage('Email address is too long.'),
    // Phone is optional but constrained when present.
    body('phone')
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ max: 50 })
      .withMessage('Phone number is too long.'),
    // Subject must match one of the supported categories.
    body('subject')
      .trim()
      .isIn(['booking', 'existing', 'fleet', 'pricing', 'support', 'other'])
      .withMessage('Please select a valid subject.'),
    // Message body must be substantial enough to be useful.
    body('message')
      .trim()
      .isLength({ min: 10, max: 1000 })
      .withMessage('Message must be between 10 and 1000 characters.'),
  ],
  // Submit to the shared contact handler.
  contactController.postContact
);

// Chat API routes
// Return summary metadata about currently available cars for chat helpers/UI assistants.
router.get('/api/chat/cars-summary', supportController.getCarsSummary);
// Return a filtered list of cars based on optional query parameters.
router.get(
  '/api/chat/cars-by-filter',
  [
    // Fuel type is optional but constrained to known domain values.
    query('fuelType')
      .optional()
      .isIn(['Petrol', 'Diesel', 'Hybrid', 'Electric'])
      .withMessage('Invalid fuel type.'),
    // Transmission is optional but constrained too.
    query('transmission')
      .optional()
      .isIn(['Automatic', 'Manual'])
      .withMessage('Invalid transmission.'),
    // Minimum seats must be within the valid fleet range.
    query('seatsMin')
      .optional()
      .isInt({ min: 2, max: 9 })
      .withMessage('seatsMin must be an integer between 2 and 9.'),
    // Maximum seats follows the same bounds.
    query('seatsMax')
      .optional()
      .isInt({ min: 2, max: 9 })
      .withMessage('seatsMax must be an integer between 2 and 9.'),
  ],
  supportController.getCarsByFilter
);
// Return pricing/fee information used by support/chat features.
router.get('/api/chat/pricing-info', supportController.getPricingInfo);
// Return details for a single car by ID.
router.get(
  '/api/chat/car-details/:carId',
  [
    // Route param must be a valid PostgreSQL integer ID before the controller looks it up.
    param('carId')
      .isInt({ min: 1 })
      .withMessage('Invalid car id.'),
  ],
  supportController.getCarDetails
);

// Export the support router.
module.exports = router;


