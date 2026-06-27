const handleMulterError = (err, req, res, next) => {
  if (err && err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      req.fileValidationError = 'File size exceeds 5MB limit';
    } else {
      req.fileValidationError = err.message || 'File upload error';
    }
    return next();
  }
  next(err);
};

module.exports = { handleMulterError };

