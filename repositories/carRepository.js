const carSql = require('../services/sql/carSqlService');

async function findById(id) {
  return carSql.getSqlCarById(id);
}

async function paginate(criteria = {}, options = {}) {
  return carSql.paginateSqlCars(criteria, options);
}

async function listAll(client = null) {
  return carSql.listAllCars(client);
}

async function listAvailable(client = null) {
  return carSql.listAvailableCars(client);
}

async function listByFilter(filter = {}, client = null) {
  return carSql.listCarsByFilter(filter, client);
}

async function create(payload, client = null) {
  return carSql.createAdminCar(payload, client);
}

async function update(id, payload, client = null) {
  return carSql.updateAdminCar(id, payload, client);
}

async function deleteById(id, client = null) {
  return carSql.deleteCarById(id, client);
}

function parsePage(raw, options) {
  return carSql.parsePage(raw, options);
}

module.exports = {
  findById,
  paginate,
  listAll,
  listAvailable,
  listByFilter,
  create,
  update,
  deleteById,
  parsePage,
};
