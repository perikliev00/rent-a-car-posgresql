const { purgeExpired } = require('./sql/bookingSyncSqlService');

async function cleanUpOutdatedDates() {
  try {
    await purgeExpired();
    console.log('🧹 Car date blocks cleanup completed');
  } catch (err) {
    console.error('Cleanup error (car date blocks):', err);
  }
}

module.exports = {
  cleanUpOutdatedDates,
};
