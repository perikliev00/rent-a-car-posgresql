const orderSql = require('../../sql/orderSqlService');
const { expireFinishedOrders } = require('../../sql/bookingSyncSqlService');
const { parseSofiaDate } = require('../../../utils/timeZone');

const ALLOWED_STATUSES = orderSql.ALLOWED_STATUSES;

function mapFilters(query = {}) {
  return {
    status: query.status || '',
    startDate: query.startDate || '',
    endDate: query.endDate || '',
    search: query.search || '',
  };
}

function buildDateRangeFilters(filters) {
  let rangeStart = null;
  let rangeEnd = null;

  if (filters.startDate) {
    const parsed = parseSofiaDate(filters.startDate, '00:00');
    if (parsed && !Number.isNaN(parsed.getTime())) {
      rangeStart = parsed;
    }
  }
  if (filters.endDate) {
    const parsed = parseSofiaDate(filters.endDate, '23:59');
    if (parsed && !Number.isNaN(parsed.getTime())) {
      rangeEnd = parsed;
    }
  }

  if (!rangeStart && !rangeEnd) {
    return null;
  }

  const start = rangeStart || rangeEnd;
  const end = rangeEnd || rangeStart;
  if (!start || !end || start > end) {
    return null;
  }

  return { rangeStart: start, rangeEnd: end };
}

async function getOrdersList(query = {}) {
  await expireFinishedOrders();

  const filters = mapFilters(query);
  const dateRange = buildDateRangeFilters(filters);

  const orders = await orderSql.listOrders({
    isDeleted: false,
    status: filters.status && ALLOWED_STATUSES.includes(filters.status)
      ? filters.status
      : undefined,
    search: filters.search,
    rangeStart: dateRange?.rangeStart,
    rangeEnd: dateRange?.rangeEnd,
  });

  const populatedOrders = await orderSql.populateOrdersWithCars(orders);

  return {
    orders: populatedOrders || [],
    filters,
  };
}

async function getExpiredOrders() {
  await expireFinishedOrders();

  const orders = await orderSql.listOrders({
    isDeleted: false,
    status: 'expired',
    sortBy: 'returnDateDesc',
  });

  const populatedOrders = await orderSql.populateOrdersWithCars(orders);

  return {
    orders: populatedOrders || [],
  };
}

async function getDeletedOrders() {
  const orders = await orderSql.listOrders({
    isDeleted: true,
    sortBy: 'deletedAtDesc',
  });

  const populatedOrders = await orderSql.populateOrdersWithCars(orders);

  return {
    orders: populatedOrders || [],
  };
}

async function emptyDeletedOrders() {
  await orderSql.permanentlyDeleteSoftDeletedOrders();
}

async function getOrderDetails(id) {
  return orderSql.findOrderByIdPopulated(id);
}

module.exports = {
  getOrdersList,
  getExpiredOrders,
  getDeletedOrders,
  emptyDeletedOrders,
  mapFilters,
  getOrderDetails,
};
