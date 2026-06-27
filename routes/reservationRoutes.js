// Express router – reservation hold create, release и release-and-rehold flows.
const express = require('express');
// body validators – защита на reservation payload преди controllers.
const { body } = require('express-validator');
const orderCarController = require('../controllers/orderCar');
// bookingController – release / re-hold handlers.
const bookingController = require('../controllers/bookingController');
// CSRF – задължителен за reservation-changing POST заявки.
const { csrfProtection, setCsrfToken } = require('../middleware/csrf');

const router = express.Router();

// Разрешени pickup/return локации – за re-hold validation.
const LOCATIONS = [
  'office', 'sunny-beach', 'sveti-vlas', 'nesebar', 'burgas', 'burgas-airport',
  'sofia', 'sofia-airport', 'varna', 'varna-airport', 'plovdiv', 'eleni', 'ravda',
];

// Order създаване – render на order page за избрана кола и date range.
router.post('/orders', csrfProtection, setCsrfToken, orderCarController.getOrderCar);
// Освобождава активната резервация за текущата session.
router.post('/reservations/release', csrfProtection, bookingController.releaseActiveReservation);
// Атомарно заменя активния hold с нов за обновени booking параметри.
router.post(
  '/reservations/release-and-rehold',
  csrfProtection,
  [
    body('carId')
      .isInt({ min: 1 })
      .withMessage('Invalid car id.'),
    body('pickupDate')
      .notEmpty()
      .withMessage('Pickup date is required.'),
    body('returnDate')
      .notEmpty()
      .withMessage('Return date is required.'),
    body('pickupTime')
      .optional({ checkFalsy: true })
      .matches(/^\d{1,2}:\d{2}$/)
      .withMessage('Pickup time must be in HH:MM format.'),
    body('returnTime')
      .optional({ checkFalsy: true })
      .matches(/^\d{1,2}:\d{2}$/)
      .withMessage('Return time must be in HH:MM format.'),
    body('pickupLocation')
      .isIn(LOCATIONS)
      .withMessage('Invalid pickup location.'),
    body('returnLocation')
      .isIn(LOCATIONS)
      .withMessage('Invalid return location.'),
  ],
  bookingController.releaseAndReholdReservation
);

module.exports = router;
