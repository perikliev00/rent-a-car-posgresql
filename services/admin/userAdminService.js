const userSql = require('../sql/userSqlService');

module.exports = {
  async listUsers() {
    return userSql.listUsers();
  },
};
