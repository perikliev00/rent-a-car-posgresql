// Обвивка за асинхронни controller функции – автоматично подава rejections към error middleware.
function asyncHandler(handler) {
  // Връщаме нова функция със сигнатурата на Express middleware (req, res, next).
  return function wrappedAsyncHandler(req, res, next) {
    // Promise.resolve гарантира, че резултатът е Promise; .catch(next) предава грешките на next.
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

// Експорт – единствената експортирана функция от този модул.
module.exports = asyncHandler;
