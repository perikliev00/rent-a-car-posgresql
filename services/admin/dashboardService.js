const orderSql = require('../sql/orderSqlService');
const { expireFinishedOrders } = require('../sql/bookingSyncSqlService');

async function getDashboardData() {
  await expireFinishedOrders();

  const orders = await orderSql.listOrders({ isDeleted: false });
  const populatedOrders = await orderSql.populateOrdersWithCars(orders);

  const totalOrders = populatedOrders.length;
  const totalRevenue =
    totalOrders > 0
      ? populatedOrders.reduce(
          (sum, order) => sum + parseFloat(order.totalPrice || 0),
          0
        )
      : 0;
  const pendingOrders =
    totalOrders > 0
      ? populatedOrders.filter(
          (order) => !order.status || order.status === 'pending'
        ).length
      : 0;

  return {
    orders: populatedOrders || [],
    stats: {
      totalOrders,
      totalRevenue: totalRevenue.toFixed(2),
      pendingOrders,
    },
  };
}

module.exports = {
  getDashboardData,
};
