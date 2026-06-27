const orderSql = require('../../sql/orderSqlService');
const carRepository = require('../../../repositories/carRepository');

function buildInitialOrderDefaults() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  return {
    pickupDate: today,
    returnDate: today,
    pickupTime: '10:00',
    returnTime: '10:00',
    pickupLocation: 'office',
    returnLocation: 'office',
    rentalDays: 1,
    deliveryPrice: 0,
    returnPrice: 0,
    totalPrice: 0,
    hotelName: '',
    fullName: '',
    phoneNumber: '',
    email: '',
    address: '',
  };
}

function buildOrderFormDefaultsFromPayload(payload = {}) {
  return {
    pickupDate: payload.pickupDate || '',
    returnDate: payload.returnDate || '',
    pickupTime: payload.pickupTime || '',
    returnTime: payload.returnTime || '',
    pickupLocation: payload.pickupLocation || 'office',
    returnLocation: payload.returnLocation || 'office',
    rentalDays:
      payload.rentalDays !== undefined && payload.rentalDays !== ''
        ? payload.rentalDays
        : 1,
    deliveryPrice:
      payload.deliveryPrice !== undefined && payload.deliveryPrice !== ''
        ? payload.deliveryPrice
        : 0,
    returnPrice:
      payload.returnPrice !== undefined && payload.returnPrice !== ''
        ? payload.returnPrice
        : 0,
    totalPrice:
      payload.totalPrice !== undefined && payload.totalPrice !== ''
        ? payload.totalPrice
        : 0,
    fullName: payload.fullName || '',
    phoneNumber: payload.phoneNumber || '',
    email: payload.email || '',
    address: payload.address || '',
    hotelName: payload.hotelName || '',
  };
}

async function getCarsList() {
  return carRepository.listAll();
}

async function buildOrderNewErrorResult(payload, errorMessage) {
  const cars = await getCarsList();
  return {
    success: false,
    status: 422,
    viewModel: {
      error: errorMessage,
      defaults: buildOrderFormDefaultsFromPayload(payload),
      cars,
    },
  };
}

function toISODate(value) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return String(value).slice(0, 10);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function toHHMM(value) {
  if (!value) return '';
  if (/^\d{2}:\d{2}$/.test(value)) return value;
  const match = String(value).match(/^(\d{1,2}):(\d{2})/);
  return match ? `${String(match[1]).padStart(2, '0')}:${match[2]}` : '';
}

async function buildOrderEditErrorResult(orderId, payload, errorMessage) {
  const order = await orderSql.findOrderByIdPopulated(orderId);
  if (!order) {
    const err = new Error('Order not found');
    err.status = 404;
    throw err;
  }

  order.pickupDate = payload.pickupDate;
  order.returnDate = payload.returnDate;
  order.pickupTime = payload.pickupTime;
  order.returnTime = payload.returnTime;
  order.pickupLocation = payload.pickupLocation;
  order.returnLocation = payload.returnLocation;
  order.hotelName = payload.hotelName;
  order.fullName = payload.fullName;
  order.phoneNumber = payload.phoneNumber;
  order.email = payload.email;
  order.address = payload.address;
  order.rentalDays = payload.rentalDays;
  order.deliveryPrice = payload.deliveryPrice;
  order.returnPrice = payload.returnPrice;
  order.totalPrice = payload.totalPrice;

  const cars = await getCarsList();

  return {
    success: false,
    status: 422,
    viewModel: {
      error: errorMessage,
      order,
      cars,
      pickupDateISO: toISODate(order.pickupDate),
      returnDateISO: toISODate(order.returnDate),
      pickupTimeHHMM: toHHMM(order.pickupTime),
      returnTimeHHMM: toHHMM(order.returnTime),
    },
  };
}

async function getCreateOrderForm() {
  const cars = await getCarsList();
  return {
    defaults: buildInitialOrderDefaults(),
    cars,
  };
}

async function getOrderEditData(id) {
  const order = await orderSql.findOrderByIdPopulated(id);
  if (!order) {
    return null;
  }
  const cars = await getCarsList();
  return {
    order,
    cars,
    pickupDateISO: toISODate(order.pickupDate),
    returnDateISO: toISODate(order.returnDate),
    pickupTimeHHMM: toHHMM(order.pickupTime),
    returnTimeHHMM: toHHMM(order.returnTime),
  };
}

module.exports = {
  buildInitialOrderDefaults,
  buildOrderFormDefaultsFromPayload,
  getCarsList,
  buildOrderNewErrorResult,
  buildOrderEditErrorResult,
  toISODate,
  toHHMM,
  getCreateOrderForm,
  getOrderEditData,
};
