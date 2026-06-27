const carRepository = require('../../../repositories/carRepository');
const orderSql = require('../../sql/orderSqlService');
const reservationRepository = require('../../../repositories/reservationRepository');
const { computeBookingPrice } = require('../../../utils/pricing');
const { parseSofiaDate } = require('../../../utils/timeZone');
const {
  purgeExpired,
  addRange,
  fetchDateBlocksForCar,
} = require('../../sql/bookingSyncSqlService');
const { findActiveReservationHold } = require('../reservationAdminService');
const {
  trimContactDetails,
  contactFieldsIncomplete,
} = require('../../contactService');
const {
  CONTACT_REQUIRED_MESSAGE,
  RESERVATION_CONFLICT_MESSAGE,
  OrderFormError,
  parseDateRange,
  runWithOptionalTransaction,
} = require('./orderShared');
const { buildOrderNewErrorResult } = require('./orderFormService');

async function getCarAvailability(carId, query = {}) {
  const { pickupDate, pickupTime, returnDate, returnTime } = query;

  if (!carId || !pickupDate || !returnDate) {
    return {
      status: 400,
      body: { ok: false, error: 'Missing required parameters' },
    };
  }

  const start = parseSofiaDate(pickupDate, pickupTime || '00:00');
  const end = parseSofiaDate(returnDate, returnTime || '23:59');

  if (
    !start ||
    !end ||
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    start >= end
  ) {
    return {
      status: 400,
      body: { ok: false, error: 'Invalid date/time range' },
    };
  }

  const overlap = await reservationRepository.findBookedDateOverlap(carId, start, end);
  let conflicts = [];

  if (overlap) {
    const blocks = await fetchDateBlocksForCar(carId);
    conflicts = blocks
      .filter(
        (block) =>
          new Date(block.startDate) < end && new Date(block.endDate) > start
      )
      .map((block) => ({
        startDate: new Date(block.startDate).toISOString(),
        endDate: new Date(block.endDate).toISOString(),
      }));
  }

  return {
    status: 200,
    body: { ok: true, available: !overlap, conflicts },
  };
}

async function createOrder(payload) {
  const trimmedContact = trimContactDetails(payload);
  if (contactFieldsIncomplete(trimmedContact)) {
    return buildOrderNewErrorResult(payload, CONTACT_REQUIRED_MESSAGE);
  }

  let range;
  try {
    range = parseDateRange(
      payload.pickupDate,
      payload.pickupTime,
      payload.returnDate,
      payload.returnTime
    );
  } catch (err) {
    if (err.isOrderFormError) {
      return buildOrderNewErrorResult(payload, err.message);
    }
    throw err;
  }

  const command = {
    carId: payload.carId,
    pickupLocation: payload.pickupLocation,
    returnLocation: payload.returnLocation,
    pickupTime: payload.pickupTime,
    returnTime: payload.returnTime,
    hotelName: payload.hotelName,
    contact: trimmedContact,
  };

  try {
    await runWithOptionalTransaction((client) =>
      createOrderCore({
        command,
        range,
        client,
      })
    );
    return { success: true };
  } catch (err) {
    if (err.isOrderFormError) {
      return buildOrderNewErrorResult(payload, err.message);
    }
    throw err;
  }
}

async function createOrderCore({ command, range, client }) {
  if (!command.carId) {
    throw new OrderFormError('CAR_REQUIRED', 'Car selection is required.');
  }

  await purgeExpired(command.carId, client);
  const car = await carRepository.findById(command.carId);
  if (!car) {
    const err = new Error('Car not found');
    err.code = 'CAR_NOT_FOUND';
    throw err;
  }

  const overlap = await reservationRepository.findBookedDateOverlap(
    command.carId,
    range.start,
    range.end,
    client
  );
  if (overlap) {
    throw new OrderFormError(
      'OVERLAP',
      'Selected car is already booked in the specified period. Please choose different dates or a different car.'
    );
  }

  const reservationConflict = await findActiveReservationHold(
    command.carId,
    range.start,
    range.end
  );
  if (reservationConflict) {
    throw new OrderFormError('RESERVATION_CONFLICT', RESERVATION_CONFLICT_MESSAGE);
  }

  const pricing = computeBookingPrice(
    car,
    range.start,
    range.end,
    command.pickupLocation,
    command.returnLocation
  );

  const orderPayload = {
    carId: command.carId,
    pickupDate: range.start,
    pickupTime: command.pickupTime,
    returnDate: range.end,
    returnTime: command.returnTime,
    pickupLocation: command.pickupLocation,
    returnLocation: command.returnLocation,
    rentalDays: pricing.rentalDays,
    deliveryPrice: pricing.deliveryPrice,
    returnPrice: pricing.returnPrice,
    totalPrice: pricing.totalPrice,
    fullName: command.contact.fullName,
    phoneNumber: command.contact.phoneNumber,
    email: command.contact.email,
    address: command.contact.address,
    hotelName: command.hotelName,
  };

  await orderSql.createAdminOrder(orderPayload, client);
  await addRange(command.carId, range.start, range.end, client);
}

module.exports = {
  createOrder,
  createOrderCore,
  getCarAvailability,
};
