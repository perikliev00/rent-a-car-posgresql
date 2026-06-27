// Trim и нормализация на user-entered contact полета преди validation/persistence.
function trimContactDetails(payload = {}) {
  return {
    fullName: (payload.fullName || '').trim(),
    phoneNumber: (payload.phoneNumber || '').trim(),
    email: (payload.email || '').trim(),
    address: (payload.address || '').trim(),
    hotelName: (payload.hotelName || '').trim(),
  };
}

/**
 * Проверява дали задължителните contact полета са непълни.
 * fullName, phoneNumber, email, address са задължителни.
 */
function contactFieldsIncomplete(contact) {
  const { fullName, phoneNumber, email, address } = contact || {};
  return [fullName, phoneNumber, email, address].some((value) => !value);
}

module.exports = {
  trimContactDetails,
  contactFieldsIncomplete,
};
