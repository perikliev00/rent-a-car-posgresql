const orderSql = require('../../sql/orderSqlService');
const { parseSofiaDate } = require('../../../utils/timeZone');
const {
  removeRange,
  fetchDateBlocksForCar,
} = require('../../sql/bookingSyncSqlService');
const { runWithOptionalTransaction } = require('./orderShared');
const { extractStoredRange } = require('./orderUpdateService');

async function deleteOrder(orderId) {
  await runWithOptionalTransaction(async (client) => {
    const order = await orderSql.findOrderById(orderId, client);
    if (!order) return;

    const prevStart =
      order.pickupDate instanceof Date
        ? order.pickupDate
        : parseSofiaDate(order.pickupDate, order.pickupTime || '00:00');
    const prevEnd =
      order.returnDate instanceof Date
        ? order.returnDate
        : parseSofiaDate(order.returnDate, order.returnTime || '23:59');

    let storedStart = prevStart;
    let storedEnd = prevEnd;
    try {
      const blocks = await fetchDateBlocksForCar(order.carId, client);
      const stored = extractStoredRange(blocks, prevStart, prevEnd);
      storedStart = stored.storedStart;
      storedEnd = stored.storedEnd;
    } catch (_) {
      // ignore
    }

    await removeRange(order.carId, storedStart, storedEnd, client);
    order.isDeleted = true;
    order.deletedAt = new Date();
    await orderSql.updateOrderFromDoc(order, client);
  });
}

module.exports = {
  deleteOrder,
};
