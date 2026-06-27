const fs = require('fs');
const path = require('path');

const ALLOWED_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

const EXTENSION_TO_MIMETYPES = {
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.webp': ['image/webp'],
};

async function removeUploadedFile(file) {
  if (!file?.path) return;
  try {
    await fs.promises.unlink(file.path);
  } catch (_) {
    // Ignore missing files – multer may not have persisted a rejected upload.
  }
}

async function readFileHead(filePath, length = 12) {
  const handle = await fs.promises.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, 0);
    return buffer;
  } finally {
    await handle.close();
  }
}

function matchesImageMagic(buffer, ext) {
  if (ext === '.jpg' || ext === '.jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (ext === '.png') {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }
  if (ext === '.webp') {
    return (
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    );
  }
  return false;
}

function isAllowedImageExtension(ext) {
  return ALLOWED_IMAGE_EXTENSIONS.has(ext);
}

function isAllowedImageMimetype(ext, mimetype) {
  const allowed = EXTENSION_TO_MIMETYPES[ext];
  return Boolean(allowed && allowed.includes((mimetype || '').toLowerCase()));
}

function getNormalizedExtension(originalName) {
  return path.extname(originalName || '').toLowerCase();
}

module.exports = {
  ALLOWED_IMAGE_EXTENSIONS,
  EXTENSION_TO_MIMETYPES,
  removeUploadedFile,
  readFileHead,
  matchesImageMagic,
  isAllowedImageExtension,
  isAllowedImageMimetype,
  getNormalizedExtension,
};
