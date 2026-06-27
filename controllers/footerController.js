// Footer/информационни страници controller.

exports.getCareers = (req, res) => {
    res.render('careers', { title: 'Careers - Join Our Team' });
};

exports.getBlog = (req, res) => {
    res.render('blog', { title: 'Blog - Latest News & Updates' });
};

exports.getFAQ = (req, res) => {
    res.render('faq', { title: 'Frequently Asked Questions' });
};

exports.getRoadside = (req, res) => {
    res.render('roadside', { title: 'Roadside Assistance' });
};

exports.getTerms = (req, res) => {
    res.render('terms', { title: 'Terms of Service' });
};

exports.getPrivacy = (req, res) => {
    res.render('privacy', { title: 'Privacy Policy' });
};

exports.getCookies = (req, res) => {
    res.render('cookies', { title: 'Cookie Policy' });
};

exports.getAccessibility = (req, res) => {
    res.render('accessibility', { title: 'Accessibility' });
};

exports.getCodeOfConduct = (req, res) => {
    res.render('code-of-conduct', { title: 'Code of Conduct' });
};

exports.getResponsibleDisclosure = (req, res) => {
    res.render('responsible-disclosure', { title: 'Responsible Disclosure' });
};

exports.getHowToBook = (req, res) => {
    res.render('how-to-book', { title: 'How to Book' });
};

exports.getPaymentMethods = (req, res) => {
    res.render('payment-methods', { title: 'Payment Methods' });
};

exports.getDeliveryReturns = (req, res) => {
    res.render('delivery-returns', { title: 'Delivery & Returns' });
};

exports.getRoadsideCoverage = (req, res) => {
    res.render('roadside-coverage', { title: 'Roadside Coverage' });
};

exports.getRoadsideWhatToDo = (req, res) => {
    res.render('roadside-what-to-do', { title: 'Roadside: What to Do' });
};

exports.getRoadsideInsurance = (req, res) => {
    res.render('roadside-insurance', { title: 'Roadside Insurance' });
};
