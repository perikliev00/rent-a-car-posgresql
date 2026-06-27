// csurf добавя CSRF защита – генерира и валидира request tokens за state-changing форми.
const csrf = require('csurf');

// Един reusable CSRF protection middleware за приложението.
const csrfProtection = csrf();

// Helper – копира генерирания CSRF token в res.locals за EJS шаблоните във форми.
function setCsrfToken(req, res, next) {
  // req.csrfToken съществува само след като csrfProtection middleware е минал по заявката.
  if (typeof req.csrfToken === 'function') {
    try {
      // Генерираме token и го излагаме към view layer за hidden form fields или AJAX bootstrap.
      res.locals.csrfToken = req.csrfToken();
    } catch (err) {
      // При грешка при генериране – подаваме грешката към central error handler.
      return next(err);
    }
  }
  // Независимо дали token е имал – продължаваме middleware chain-а.
  return next();
}

// Експорт на protection middleware и helper-а за токена в шаблоните.
module.exports = {
  csrfProtection,
  setCsrfToken,
};
