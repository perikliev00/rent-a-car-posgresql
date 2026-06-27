const { csrfProtection } = require('../csrf');
const { removeUploadedFile } = require('./uploadUtils');

function verifyCsrfAfterUpload(req, res, next) {
  csrfProtection(req, res, async (err) => {
    if (err) {
      await removeUploadedFile(req.file);
      return next(err);
    }
    return next();
  });
}

module.exports = { verifyCsrfAfterUpload };
