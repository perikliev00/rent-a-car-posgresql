const handleFileRejected = (req, res, next) => {
  if (req.fileRejected) {
    req.fileValidationError =
      'Only image files are allowed (JPG, JPEG, PNG, WEBP) with a matching MIME type.';
  }
  next();
};

module.exports = { handleFileRejected };

