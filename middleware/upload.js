// path помага за OS-safe filesystem пътища към дестинациите на upload-нати файлове.
const path = require('path');
// multer обработва multipart/form-data uploads от admin car create/edit форми.
const multer = require('multer');
const {
  getNormalizedExtension,
  isAllowedImageExtension,
  isAllowedImageMimetype,
} = require('./fileUpload/uploadUtils');

// Конфигурация как upload-натите файлове да се пазят на диска.
const storage = multer.diskStorage({
    // destination решава в коя папка се записва файлът.
    destination: function (req, file, cb) {
        // Запазваме car images в public/images – за static serving по-късно.
        cb(null, path.join(__dirname, '..', 'public', 'images'));
    },
    // filename решава финалното име на файла.
    filename: function (req, file, cb) {
        // Уникален суфикс – текущо време + random цифри за по-малък collision риск.
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        // Запазваме оригиналното file extension, lowercase.
        const ext = path.extname(file.originalname || '').toLowerCase();
        // Всяка снимка под предсказуем car-* prefix за по-лесно разпознаване.
        cb(null, `car-${unique}${ext}`);
    }
});

// fileFilter – първи слой: extension + declared MIME type преди запис на диска.
function fileFilter(req, file, cb) {
  const ext = getNormalizedExtension(file.originalname);
  if (!isAllowedImageExtension(ext)) {
    req.fileRejected = true;
    return cb(null, false);
  }
  if (!isAllowedImageMimetype(ext, file.mimetype)) {
    req.fileRejected = true;
    return cb(null, false);
  }
  cb(null, true);
}

// Един конфигуриран multer instance – disk storage, file filter, 5MB лимит.
const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// Експорт – admin routes да извикват upload.single('image').
module.exports = { upload };
