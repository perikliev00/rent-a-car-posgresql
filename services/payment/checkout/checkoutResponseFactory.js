function buildRenderOrderPageResponse(car, formData, message, options = {}) {
  return {
    type: 'renderOrderPage',
    car,
    formData,
    message,
    options,
  };
}

function buildRedirectResponse(url, statusCode = 303) {
  return {
    type: 'redirect',
    statusCode,
    url,
  };
}

module.exports = {
  buildRenderOrderPageResponse,
  buildRedirectResponse,
};
