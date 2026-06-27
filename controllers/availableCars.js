const { validationResult } = require('express-validator');
const {
  parseCarFilterRaw,
  filtersViewModel,
} = require('../utils/carFilters');
const { computeBookingPrice } = require('../utils/pricing');
const filterCarsByComputedUnitPrice = require('../utils/carFilters').filterCarsByComputedUnitPrice;
const { validateBookingDates } = require('../utils/bookingValidation');
const carRepository = require('../repositories/carRepository');
const asyncHandler = require('../utils/asyncHandler');

exports.postSearchCars = asyncHandler(async (req, res) => {
  let errors = validationResult(req);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const pickupDateOnly = req.body['pickup-date'];
  const returnDateOnly = req.body['return-date'];
  const pickupTimeInput = req.body['pickup-time'];
  const returnTimeInput = req.body['return-time'];

  const {
    isValid,
    errors: bookingErrors,
    startDate,
    endDate,
    rentalDays,
  } = validateBookingDates({
    pickupDate: pickupDateOnly,
    returnDate: returnDateOnly,
    pickupTime: pickupTimeInput || '10:00',
    returnTime: returnTimeInput || '10:00',
    now,
  });

  if (!isValid) {
    bookingErrors.forEach((msg) => {
      errors.errors.push({ msg });
    });
  }

  if (!errors.isEmpty()) {
    const { cars, currentPage, totalPages } = await carRepository.paginate({}, {
      page: carRepository.parsePage(req.body.page ?? req.query.page),
    });

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const pickupDateISO =
      pickupDateOnly || today.toISOString().split('T')[0];
    const returnDateISO =
      returnDateOnly || tomorrow.toISOString().split('T')[0];

    const message = errors.array()[0].msg;
    const criteria = parseCarFilterRaw(req.body);

    return res.status(422).render('index', {
      title: 'Search cars',
      cars,
      message,
      pickupDateISO,
      returnDateISO,
      pickupDate: pickupDateOnly,
      returnDate: returnDateOnly,
      pickupTime: pickupTimeInput,
      returnTime: returnTimeInput,
      pickupLocation: req.body['pickup-location'],
      returnLocation: req.body['return-location'],
      currentPage,
      totalPages,
      category: criteria.category || '',
      filters: filtersViewModel(criteria, req.body),
    });
  }

  const {
    'pickup-time': pickupTime,
    'return-time': returnTime,
    'pickup-location': pickupLoc,
    'return-location': returnLoc,
    transmission,
    fuelType,
    priceMin,
    priceMax,
    seatsMin,
    seatsMax,
    category,
  } = req.body;

  const pickupDate = startDate;
  const returnDate = endDate;

  const criteria = parseCarFilterRaw({
    category,
    transmission,
    fuelType,
    seatsMin,
    seatsMax,
    priceMin,
    priceMax,
  });

  const { cars: carsForPage, currentPage, totalPages } = await carRepository.paginate(criteria, {
    page: carRepository.parsePage(req.body.page),
    rentalDays,
    pickupDate: pickupDateOnly,
    returnDate: returnDateOnly,
    pickupTime: pickupTime || '10:00',
    returnTime: returnTime || '10:00',
    startDate,
    endDate,
    onlyAvailable: true,
  });
  let pageCars = carsForPage.map((car) => {
    const p = computeBookingPrice(car, pickupDate, returnDate, pickupLoc, returnLoc);
    return { ...car, ...p };
  });
  pageCars = filterCarsByComputedUnitPrice(pageCars, criteria);

  const sharedRentalDays = pageCars[0]?.rentalDays || rentalDays || 0;
  const sharedDeliveryPrice = pageCars[0]?.deliveryPrice || 0;
  const sharedReturnPrice = pageCars[0]?.returnPrice || 0;

  res.render('searchResults', {
    title: 'Search Results',
    pickupLocation: pickupLoc,
    returnLocation: returnLoc,
    pickupDate: pickupDateOnly,
    returnDate: returnDateOnly,
    rentalDays: sharedRentalDays,
    pickupTime,
    returnTime,
    deliveryPrice: sharedDeliveryPrice,
    returnPrice: sharedReturnPrice,
    cars: pageCars,
    currentPage,
    totalPages,
    filters: filtersViewModel(criteria, {
      priceMin,
      priceMax,
      seatsMin,
      seatsMax,
    }),
    category: criteria.category || '',
  });
});
