const { parseSofiaDate } = require('../../../utils/timeZone');
const { runWithOptionalTransaction } = require('../../../db/transaction');

const CONTACT_REQUIRED_MESSAGE =
  'Full name, phone number, email, and address are required.';
const RESERVATION_CONFLICT_MESSAGE =
  'Selected car currently has an active online reservation in this period. Please choose different dates or wait until the hold expires.';

class OrderFormError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'OrderFormError';
    this.code = code;
    this.isOrderFormError = true;
  }
}

class OrderRestoreError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'OrderRestoreError';
    this.code = code;
    this.isOrderRestoreError = true;
  }
}

function parseDateRange(pickupDate, pickupTime, returnDate, returnTime) {
  const start = parseSofiaDate(pickupDate, pickupTime || '00:00');
  const end = parseSofiaDate(returnDate, returnTime || '23:59');
  if (
    !start ||
    !end ||
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    start >= end
  ) {
    throw new OrderFormError('INVALID_RANGE', 'Invalid pick-up/return range');
  }
  return { start, end };
}

module.exports = {
  CONTACT_REQUIRED_MESSAGE,
  RESERVATION_CONFLICT_MESSAGE,
  OrderFormError,
  OrderRestoreError,
  runWithOptionalTransaction,
  parseDateRange,
};
