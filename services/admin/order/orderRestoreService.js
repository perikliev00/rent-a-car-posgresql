const orderSql = require('../../sql/orderSqlService');
const { parseSofiaDate } = require('../../../utils/timeZone');
const { purgeExpired, addRange } = require('../../sql/bookingSyncSqlService');
const {
  OrderRestoreError,
  runWithOptionalTransaction,
} = require('./orderShared');

async function restoreOrder(orderId) {
  try {
    await runWithOptionalTransaction(async (client) => {
      const order = await orderSql.findOrderById(orderId, client);
      if (!order || !order.isDeleted) {
        throw new OrderRestoreError(
          'RESTORE_INVALID',
          'Cannot restore: order not found or not in bin.'
        );
      }

      const start =
        order.pickupDate instanceof Date
          ? order.pickupDate
          : parseSofiaDate(order.pickupDate, order.pickupTime || '00:00');
      const end =
        order.returnDate instanceof Date
          ? order.returnDate
          : parseSofiaDate(order.returnDate, order.returnTime || '23:59');

      if (
        !start ||
        !end ||
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime()) ||
        start >= end
      ) {
        throw new OrderRestoreError(
          'INVALID_RANGE',
          'Cannot restore: order has invalid stored dates.'
        );
      }

      await purgeExpired(order.carId, client);
      await addRange(order.carId, start, end, client);

      order.isDeleted = false;
      order.deletedAt = undefined;

      const now = new Date();
      if (end <= now) {
        order.status = 'expired';
        if (!order.expiredAt) {
          order.expiredAt = now;
        }
      } else if (
        !order.status ||
        order.status === 'expired' ||
        order.status === 'cancelled'
      ) {
        order.status = 'active';
        order.expiredAt = undefined;
      }

      await orderSql.updateOrderFromDoc(order, client);
    });
  } catch (err) {
    if (err.isOrderRestoreError) {
      throw err;
    }
    if (err && err.code === 'OVERLAP') {
      throw new OrderRestoreError(
        'OVERLAP',
        'Cannot restore order: car is already booked in that period.'
      );
    }
    throw err;
  }
}

module.exports = {
  restoreOrder,
};
