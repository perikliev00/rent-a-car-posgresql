const carRepository = require('../repositories/carRepository');
const { formatDateForDisplay } = require('../utils/dateFormatter');
const { purgeExpired } = require('../services/sql/bookingSyncSqlService');
const { parseCarFilterRaw, filtersViewModel } = require('../utils/carFilters');

// GET / – home page (landing)
exports.getHome = async (req, res, next) => {
  try {
    await purgeExpired();

    const criteria = parseCarFilterRaw(req.query);
    const rentalDays = 1;

    const { cars, currentPage, totalPages } = await carRepository.paginate(criteria, {
      page: carRepository.parsePage(req.query.page),
      rentalDays,
    });

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);

    const pickupDateISO = now.toISOString().split('T')[0];
    const returnDateISO = tomorrow.toISOString().split('T')[0];
    const pickupDate = formatDateForDisplay(pickupDateISO);
    const returnDate = formatDateForDisplay(returnDateISO);

    res.render('index', {
      title: 'Find Perfect Car',
      cars,
      pickupDate,
      returnDate,
      pickupDateISO,
      returnDateISO,
      returnLocation: '',
      pickupLocation: '',
      currentPage,
      totalPages,
      category: criteria.category,
      filters: filtersViewModel(criteria, req.query),
    });
  } catch (err) {
    console.error('getHome error:', err);
    err.publicMessage = 'Error fetching cars.';
    return next(err);
  }
};
