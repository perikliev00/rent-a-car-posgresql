const { validationResult } = require('express-validator');
const contactSql = require('../services/sql/contactSqlService');

exports.getContacts = async (req, res, next) => {
  try {
    res.render('contacts', {
      title: 'Contact Us - Rent A Car',
    });
  } catch (err) {
    console.error('getContacts error:', err);
    err.publicMessage = 'Error loading contacts page.';
    return next(err);
  }
};

exports.postContact = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors || !errors.isEmpty()) {
      const firstError = errors.array()[0]?.msg || 'Please correct the form and try again.';
      return res.status(422).render('contacts', {
        title: 'Contact Us - Rent A Car',
        errorMessage: firstError,
      });
    }

    const { name, email, phone, subject, message } = req.body;

    await contactSql.createContact({
      name,
      email,
      phone,
      subject,
      message,
      status: 'new',
    });

    return res.render('contacts', {
      title: 'Contact Us - Rent A Car',
      successMessage: 'Thank you for your message! We will get back to you soon.',
    });
  } catch (err) {
    console.error('postContact error:', err);
    err.publicMessage = 'There was an error sending your message. Please try again later.';
    return next(err);
  }
};

exports.getAdminContacts = async (req, res, next) => {
  try {
    const contacts = await contactSql.listContacts();
    res.render('admin/contacts', { title: 'Contact Messages', contacts });
  } catch (err) {
    console.error('Get admin contacts error:', err);
    err.publicMessage = 'Error loading contacts.';
    return next(err);
  }
};

exports.postUpdateContactStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    await contactSql.updateContactStatus(req.params.id, status);
    res.redirect('/admin/contacts');
  } catch (err) {
    console.error('Update contact status error:', err);
    err.publicMessage = 'Error updating status.';
    return next(err);
  }
};

exports.postDeleteContact = async (req, res, next) => {
  try {
    await contactSql.deleteContactById(req.params.id);
    res.redirect('/admin/contacts');
  } catch (err) {
    console.error('Delete contact error:', err);
    err.publicMessage = 'Error deleting contact.';
    return next(err);
  }
};
