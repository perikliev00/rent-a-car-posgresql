// Express router – всички authentication routes в един модул.
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { requireGuest, requireAuth } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const { csrfProtection, setCsrfToken } = require('../middleware/csrf');

// Login форма – само за guests; CSRF token за безопасно submit.
router.get('/login', requireGuest, csrfProtection, setCsrfToken, authController.getLogin);
router.post(
	'/login',
	requireGuest,
	authLimiter,
	csrfProtection,
	setCsrfToken,
	[
		body('email')
			.trim()
			.isEmail()
			.withMessage('Please enter a valid email address')
			.normalizeEmail(),
		body('password')
			.isLength({ min: 6 })
			.withMessage('Password must be at least 6 characters long')
	],
	authController.postLogin
);

router.get('/signup', requireGuest, csrfProtection, setCsrfToken, authController.getSignup);
router.post(
	'/signup',
	requireGuest,
	authLimiter,
	csrfProtection,
	setCsrfToken,
	[
		body('email')
			.trim()
			.isEmail()
			.withMessage('Please enter a valid email address')
			.normalizeEmail(),
		body('password')
			.isLength({ min: 6 })
			.withMessage('Password must be at least 6 characters long')
	],
		authController.postSignup
);

router.post('/logout', requireAuth, csrfProtection, authController.postLogout);

module.exports = router;

