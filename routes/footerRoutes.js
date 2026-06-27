// Express router – статични информационни/footer страници.
const express = require('express');
const router = express.Router();
const footerController = require('../controllers/footerController');

router.get('/careers', footerController.getCareers);
router.get('/blog', footerController.getBlog);
router.get('/faq', footerController.getFAQ);
router.get('/roadside', footerController.getRoadside);
router.get('/terms', footerController.getTerms);
router.get('/privacy', footerController.getPrivacy);
router.get('/cookies', footerController.getCookies);
router.get('/accessibility', footerController.getAccessibility);
router.get('/code-of-conduct', footerController.getCodeOfConduct);
router.get('/responsible-disclosure', footerController.getResponsibleDisclosure);
router.get('/how-to-book', footerController.getHowToBook);
router.get('/payment-methods', footerController.getPaymentMethods);
router.get('/delivery-returns', footerController.getDeliveryReturns);
router.get('/roadside-coverage', footerController.getRoadsideCoverage);
router.get('/roadside-what-to-do', footerController.getRoadsideWhatToDo);
router.get('/roadside-insurance', footerController.getRoadsideInsurance);

module.exports = router;


