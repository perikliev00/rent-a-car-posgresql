const { buildOrderPageViewModel } = require('../paymentService');

// Преизгражда order page с view model, CSRF token и status code.
function renderOrderPage(req, res, car, formData, message, options = {}) {
  // Извикваме paymentService да събере view model от car, formData, message.
  const viewModel = buildOrderPageViewModel(car, formData, message, options);

  // Добавяме CSRF token ако middleware го е подготвил.
  if (res.locals && res.locals.csrfToken) {
    viewModel.csrfToken = res.locals.csrfToken;
  }

  // Render с 422 или custom statusCode, връщаме orderMain шаблона.
  return res.status(options.statusCode || 422).render('orderMain', viewModel);
}

function renderSuccessPage(res, viewModel) {
  res.set('Cache-Control', 'private, no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  return res.render('success', viewModel);
}

module.exports = {
  renderOrderPage,
  renderSuccessPage,
};
