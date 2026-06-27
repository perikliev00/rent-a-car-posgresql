const { body } = require('express-validator');

const carValidationRules = [
  body('name').trim().isLength({ min: 2 }).withMessage('Name is required'),
  body('transmission')
    .trim()
    .isIn(['Automatic', 'Manual'])
    .withMessage('Transmission must be Automatic or Manual'),
  body('seats').toInt().isInt({ min: 2, max: 9 }).withMessage('Seats must be between 2 and 9'),
  body('fuelType')
    .trim()
    .isIn(['Petrol', 'Diesel', 'Hybrid', 'Electric'])
    .withMessage('Fuel type must be Petrol, Diesel, Hybrid or Electric'),
  body('priceTier_1_3')
    .optional({ checkFalsy: true })
    .toFloat()
    .isFloat({ gt: 0 })
    .withMessage('Tier 1–3 must be a number greater than 0'),
  body('priceTier_7_31')
    .optional({ checkFalsy: true })
    .toFloat()
    .isFloat({ gt: 0 })
    .withMessage('Tier 7–31 must be a number greater than 0'),
  body('priceTier_31_plus')
    .optional({ checkFalsy: true })
    .toFloat()
    .isFloat({ gt: 0 })
    .withMessage('Tier 31+ must be a number greater than 0'),
  body()
    .custom((value, { req }) => {
      const tier1 = parseFloat(req.body.priceTier_1_3);
      const tier2 = parseFloat(req.body.priceTier_7_31);
      const tier3 = parseFloat(req.body.priceTier_31_plus);
      const hasValidTier =
        (Number.isFinite(tier1) && tier1 > 0) ||
        (Number.isFinite(tier2) && tier2 > 0) ||
        (Number.isFinite(tier3) && tier3 > 0);
      if (!hasValidTier) {
        throw new Error('At least one price tier (1–3 days, 7–31 days, or 31+ days) is required');
      }
      return true;
    })
    .withMessage('At least one price tier is required'),
];

module.exports = { carValidationRules };

