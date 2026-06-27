// GET /about – about страница.
exports.getAbout = async (req, res, next) => {
  try {
    res.render('about', {
      title: 'About Us - Rent A Car'
    });
  } catch (err) {
    console.error('getAbout error:', err);
    err.publicMessage = 'Error loading about page.';
    return next(err);
  }
};
