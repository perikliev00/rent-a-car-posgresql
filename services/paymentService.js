// dateFormatter – raw form стойности в display labels за EJS шаблони.
const { formatDateForDisplay, formatLocationName } = require('../utils/dateFormatter');
const {
  buildBaseOrderPayload,
  buildOrderViewModel,
} = require('./orderViewModelService');
const { trimContactDetails } = require('./contactService');

// Създава order page view-model при validation failure или re-render.
function buildOrderPageViewModel(car, formData, message, options = {}) {
  const pickupDateISO = formData.pickupDate;
  const returnDateISO = formData.returnDate;
  const pickupTime = formData.pickupTime;
  const returnTime = formData.returnTime;
  const pickupLocation = formData.pickupLocation;
  const returnLocation = formData.returnLocation;

  const pickupDateDisplay = formatDateForDisplay(pickupDateISO);
  const returnDateDisplay = formatDateForDisplay(returnDateISO);
  const pickupLocationDisplay = formatLocationName(pickupLocation);
  const returnLocationDisplay = formatLocationName(returnLocation);

  const pricing = {
    rentalDays: options.rentalDays ?? formData.rentalDays,
    deliveryPrice: options.deliveryPrice ?? formData.deliveryPrice,
    returnPrice: options.returnPrice ?? formData.returnPrice,
    totalPrice: options.totalPrice ?? formData.totalPrice,
  };

  const basePayload = buildBaseOrderPayload({
    pickupDateISO,
    returnDateISO,
    pickupTime,
    returnTime,
    pickupLocation,
    returnLocation,
    pickupDateDisplay,
    returnDateDisplay,
    pickupLocationDisplay,
    returnLocationDisplay,
    pricing,
    releaseRedirect:
      options.releaseRedirect || formData.releaseRedirect || formData.currentUrl || '',
  });

  const contact = {
    fullName: formData.fullName,
    phoneNumber: formData.phoneNumber,
    email: formData.email,
    address: formData.address,
    hotelName: formData.hotelName,
  };

  const viewModel = buildOrderViewModel(car, basePayload, {
    contact,
    existingReservation: options.existingReservation || null,
    message: message || null,
    title: 'Order Car',
  });

  return viewModel;
}

// Нормализира checkout contact полета преди запис в reservation/order.
function normalizeContactDetails(formData = {}) {
  return trimContactDetails(formData);
}

module.exports = {
  buildOrderPageViewModel,
  normalizeContactDetails,
};
