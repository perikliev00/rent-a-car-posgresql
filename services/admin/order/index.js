const {
  getOrdersList,
  getExpiredOrders,
  getDeletedOrders,
  emptyDeletedOrders,
  getOrderDetails,
} = require('./orderListService');
const { getCreateOrderForm, getOrderEditData } = require('./orderFormService');
const { getCarAvailability, createOrder } = require('./orderCreateService');
const { updateOrder } = require('./orderUpdateService');
const { deleteOrder } = require('./orderDeleteService');
const { restoreOrder } = require('./orderRestoreService');

module.exports = {
  getOrdersList,
  getExpiredOrders,
  getDeletedOrders,
  emptyDeletedOrders,
  getCreateOrderForm,
  getCarAvailability,
  createOrder,
  getOrderDetails,
  getOrderEditData,
  updateOrder,
  deleteOrder,
  restoreOrder,
};
