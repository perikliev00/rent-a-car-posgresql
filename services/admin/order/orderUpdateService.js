const carRepository = require('../../../repositories/carRepository');
const orderSql = require('../../sql/orderSqlService');
const { computeBookingPrice } = require('../../../utils/pricing');
const { parseSofiaDate } = require('../../../utils/timeZone');
const {
  updateRange,
  moveRange,
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
const { buildOrderEditErrorResult } = require('./orderFormService');

function extractStoredRange(blocks, prevStart, prevEnd) {
  if (!Array.isArray(blocks) || !blocks.length) {
    return { storedStart: prevStart, storedEnd: prevEnd };
  }

  const candidate = blocks.find((block) => {
    const start = new Date(block.startDate);
    const end = new Date(block.endDate);
    return start < prevEnd && end > prevStart;
  });

  if (candidate) {
    return {
      storedStart: new Date(candidate.startDate),
      storedEnd: new Date(candidate.endDate),
    };
  }

  return { storedStart: prevStart, storedEnd: prevEnd };
}

async function updateOrder(orderId, payload) {
  const trimmedContact = trimContactDetails(payload);
  if (contactFieldsIncomplete(trimmedContact)) {
    return buildOrderEditErrorResult(
      orderId,
      payload,
      CONTACT_REQUIRED_MESSAGE
    );
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
      return buildOrderEditErrorResult(orderId, payload, err.message);
    }
    throw err;
  }

  try {
    await runWithOptionalTransaction((client) =>
      updateOrderCore({
        orderId,
        payload,
        contact: trimmedContact,
        range,
        client,
      })
    );
    return { success: true };
  } catch (err) {
    if (err.isOrderFormError) {
      let message = err.message || 'Error saving order';
      if (err.code === 'RESERVATION_CONFLICT') {
        message = RESERVATION_CONFLICT_MESSAGE;
      } else if (err.code === 'OVERLAP') {
        message =
          'Selected car is already booked in the specified period. Please choose different dates or a different car.';
      } else if (err.code === 'MISSING_CONTACT') {
        message = CONTACT_REQUIRED_MESSAGE;
      }
      return buildOrderEditErrorResult(orderId, payload, message);
    }
    throw err;
  }
}

async function updateOrderCore({ orderId, payload, contact, range, client }) {
  const existingOrder = await orderSql.findOrderById(orderId, client);
  if (!existingOrder) {
    const err = new Error('Order not found');
    err.status = 404;
    throw err;
  }

  const prevCarId = existingOrder.carId;
  const prevStart =
    existingOrder.pickupDate instanceof Date
      ? existingOrder.pickupDate
      : parseSofiaDate(existingOrder.pickupDate, existingOrder.pickupTime || '00:00');
  const prevEnd =
    existingOrder.returnDate instanceof Date
      ? existingOrder.returnDate
      : parseSofiaDate(existingOrder.returnDate, existingOrder.returnTime || '23:59');

  let storedPrevStart = prevStart;
  let storedPrevEnd = prevEnd;
  try {
    const blocks = await fetchDateBlocksForCar(prevCarId, client);
    const stored = extractStoredRange(blocks, prevStart, prevEnd);
    storedPrevStart = stored.storedStart;
    storedPrevEnd = stored.storedEnd;
  } catch (_) {
    // ignore
  }

  const newCarId =
    payload.carId && payload.carId.toString
      ? payload.carId.toString()
      : String(prevCarId);

  const car = await carRepository.findById(newCarId);
  if (!car) {
    const err = new Error('Car not found');
    err.code = 'CAR_NOT_FOUND';
    throw err;
  }

  const sameCar = String(prevCarId) === String(newCarId);
  const sameStart = prevStart && range.start && prevStart.getTime() === range.start.getTime();
  const sameEnd = prevEnd && range.end && prevEnd.getTime() === range.end.getTime();
  const samePickupLoc = existingOrder.pickupLocation === payload.pickupLocation;
  const sameReturnLoc = existingOrder.returnLocation === payload.returnLocation;

  const shouldRecalculatePrice =
    !sameCar || !sameStart || !sameEnd || !samePickupLoc || !sameReturnLoc;

  if (!sameCar || !sameStart || !sameEnd) {
    const reservationConflict = await findActiveReservationHold(
      newCarId,
      range.start,
      range.end
    );
    if (reservationConflict) {
      throw new OrderFormError(
        'RESERVATION_CONFLICT',
        RESERVATION_CONFLICT_MESSAGE
      );
    }
  }

  if (sameCar && sameStart && sameEnd) {
    existingOrder.pickupLocation = payload.pickupLocation;
    existingOrder.returnLocation = payload.returnLocation;
    existingOrder.hotelName = payload.hotelName;
    existingOrder.fullName = contact.fullName;
    existingOrder.phoneNumber = contact.phoneNumber;
    existingOrder.email = contact.email;
    existingOrder.address = contact.address;

    if (shouldRecalculatePrice) {
      const pricing = computeBookingPrice(
        car,
        prevStart,
        prevEnd,
        payload.pickupLocation,
        payload.returnLocation
      );
      existingOrder.rentalDays = pricing.rentalDays;
      existingOrder.deliveryPrice = pricing.deliveryPrice;
      existingOrder.returnPrice = pricing.returnPrice;
      existingOrder.totalPrice = pricing.totalPrice;
    }

    await orderSql.updateOrderFromDoc(existingOrder, client);
    return;
  }

  if (String(newCarId) === String(prevCarId)) {
    await updateRange(
      prevCarId,
      storedPrevStart,
      storedPrevEnd,
      range.start,
      range.end,
      client
    );
  } else {
    await moveRange(
      prevCarId,
      newCarId,
      storedPrevStart,
      storedPrevEnd,
      range.start,
      range.end,
      client
    );
  }

  existingOrder.carId = newCarId;
  existingOrder.pickupDate = range.start;
  existingOrder.pickupTime = payload.pickupTime;
  existingOrder.returnDate = range.end;
  existingOrder.returnTime = payload.returnTime;
  existingOrder.pickupLocation = payload.pickupLocation;
  existingOrder.returnLocation = payload.returnLocation;
  existingOrder.hotelName = payload.hotelName;
  existingOrder.fullName = contact.fullName;
  existingOrder.phoneNumber = contact.phoneNumber;
  existingOrder.email = contact.email;
  existingOrder.address = contact.address;

  const now = new Date();
  if (range.end <= now) {
    existingOrder.status = 'expired';
    if (!existingOrder.expiredAt) {
      existingOrder.expiredAt = now;
    }
  } else {
    existingOrder.status = 'active';
    existingOrder.expiredAt = undefined;
  }

  if (shouldRecalculatePrice) {
    const pricing = computeBookingPrice(
      car,
      range.start,
      range.end,
      payload.pickupLocation,
      payload.returnLocation
    );
    existingOrder.rentalDays = pricing.rentalDays;
    existingOrder.deliveryPrice = pricing.deliveryPrice;
    existingOrder.returnPrice = pricing.returnPrice;
    existingOrder.totalPrice = pricing.totalPrice;
  }

  await orderSql.updateOrderFromDoc(existingOrder, client);
}

module.exports = {
  updateOrder,
  updateOrderCore,
  extractStoredRange,
};
