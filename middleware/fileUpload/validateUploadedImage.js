const path = require('path');
const {
  getNormalizedExtension,
  isAllowedImageExtension,
  isAllowedImageMimetype,
  matchesImageMagic,
  readFileHead,
  removeUploadedFile,
} = require('./uploadUtils');

async function validateUploadedImage(req, res, next) {
  const file = req.file;
  if (!file) {
    return next();
  }

  const ext = getNormalizedExtension(file.originalname || file.filename);
  const savedExt = path.extname(file.filename || '').toLowerCase();

  try {
    if (!isAllowedImageExtension(ext) || ext !== savedExt) {
      req.fileValidationError = 'Only image files are allowed (JPG, JPEG, PNG, WEBP).';
      await removeUploadedFile(file);
      return next();
    }

    if (!isAllowedImageMimetype(ext, file.mimetype)) {
      req.fileValidationError = 'Uploaded file MIME type does not match a supported image format.';
      await removeUploadedFile(file);
      return next();
    }

    const head = await readFileHead(file.path);
    if (!matchesImageMagic(head, ext)) {
      req.fileValidationError = 'Uploaded file is not a valid image.';
      await removeUploadedFile(file);
      return next();
    }

    return next();
  } catch (err) {
    await removeUploadedFile(file);
    return next(err);
  }
}

module.exports = { validateUploadedImage };
