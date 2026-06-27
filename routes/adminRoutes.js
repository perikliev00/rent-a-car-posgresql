// Express router – само за admin страници и действия.
const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/admin/dashboardController');
const orderController = require('../controllers/admin/orderController');
const carController = require('../controllers/admin/carController');
const contactAdminController = require('../controllers/contactController');
const { requireAdmin } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { csrfProtection, setCsrfToken } = require('../middleware/csrf');
const { adminUploadLimiter } = require('../middleware/rateLimit');

const { handleMulterError } = require('../middleware/fileUpload/handleMulterError');
const { handleFileRejected } = require('../middleware/fileUpload/handleFileRejected');
const { validateUploadedImage } = require('../middleware/fileUpload/validateUploadedImage');
const { verifyCsrfAfterUpload } = require('../middleware/fileUpload/verifyCsrfAfterUpload');
const { carValidationRules } = require('../validators/carValidationRules');

router.get('/admin-dashboard', requireAdmin, csrfProtection, setCsrfToken, dashboardController.getAdminDashboard);
router.get('/admin/orders', requireAdmin, csrfProtection, setCsrfToken, orderController.getAllOrders);
router.get('/admin/orders/expired', requireAdmin, csrfProtection, setCsrfToken, orderController.getExpiredOrders);
router.get('/admin/orders/deleted', requireAdmin, csrfProtection, setCsrfToken, orderController.getDeletedOrders);
router.post('/admin/orders/deleted/empty', requireAdmin, csrfProtection, orderController.postEmptyDeletedOrders);
router.get('/admin/orders/new', requireAdmin, csrfProtection, setCsrfToken, orderController.getCreateOrder);
router.post('/admin/orders/new', requireAdmin, csrfProtection, setCsrfToken, orderController.postCreateOrder);
router.get('/admin/cars/:id/availability', requireAdmin, orderController.getCarAvailability);
router.get('/admin/orders/:id', requireAdmin, csrfProtection, setCsrfToken, orderController.getOrderDetails);
router.get('/admin/orders/:id/edit', requireAdmin, csrfProtection, setCsrfToken, orderController.getEditOrder);
router.post('/admin/orders/:id/edit', requireAdmin, csrfProtection, setCsrfToken, orderController.postEditOrder);
router.post('/admin/orders/:id/delete', requireAdmin, csrfProtection, orderController.postDeleteOrder);
router.post('/admin/orders/:id/restore', requireAdmin, csrfProtection, orderController.postRestoreOrder);

router.get('/admin/contacts', requireAdmin, csrfProtection, setCsrfToken, contactAdminController.getAdminContacts);
router.post('/admin/contacts/:id/status', requireAdmin, csrfProtection, contactAdminController.postUpdateContactStatus);
router.post('/admin/contacts/:id/delete', requireAdmin, csrfProtection, contactAdminController.postDeleteContact);

router.get('/admin/cars', requireAdmin, csrfProtection, setCsrfToken, carController.listCars);
router.get('/admin/cars/new', requireAdmin, csrfProtection, setCsrfToken, carController.getCreateCar);
// Multipart routes: multer must parse the body first; CSRF + strict image checks run before persistence.
router.post(
  '/admin/cars/new',
  requireAdmin,
  adminUploadLimiter,
  upload.single('image'),
  handleMulterError,
  handleFileRejected,
  validateUploadedImage,
  verifyCsrfAfterUpload,
  setCsrfToken,
  carValidationRules,
  carController.postCreateCar
);
router.get('/admin/cars/:id/edit', requireAdmin, csrfProtection, setCsrfToken, carController.getEditCar);
router.post(
  '/admin/cars/:id/edit',
  requireAdmin,
  adminUploadLimiter,
  upload.single('image'),
  handleMulterError,
  handleFileRejected,
  validateUploadedImage,
  verifyCsrfAfterUpload,
  setCsrfToken,
  carValidationRules,
  carController.postEditCar
);
router.post('/admin/cars/:id/delete', requireAdmin, csrfProtection, carController.postDeleteCar);

// categories routes removed

module.exports = router;
