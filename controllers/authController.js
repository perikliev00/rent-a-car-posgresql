const { validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const userSql = require('../services/sql/userSqlService');

exports.getLogin = (req, res) => {
  res.render('login', { title: 'Login' });
};

exports.postLogin = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    const { email, password } = req.body;

    if (!errors.isEmpty()) {
      return res.status(422).render('login', {
        title: 'Login',
        email,
        errors: errors.array(),
      });
    }

    const user = await userSql.findUserByEmail(email);
    if (!user) {
      return res.status(401).render('login', {
        title: 'Login',
        email,
        errors: [{ msg: 'Invalid email or password' }],
      });
    }

    const result = await bcrypt.compare(password, user.password);
    if (!result) {
      return res.status(401).render('login', {
        title: 'Login',
        email,
        errors: [{ msg: 'Invalid email or password' }],
      });
    }

    req.session.isLoggedIn = true;
    req.session.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };
    return res.redirect('/');
  } catch (err) {
    console.error('Login error:', err);
    err.publicMessage = 'Something went wrong while logging you in. Please try again.';
    return next(err);
  }
};

exports.getSignup = (req, res) => {
  res.render('signup', { title: 'Sign up' });
};

exports.postSignup = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    const { email, password } = req.body;

    if (!errors.isEmpty()) {
      return res.status(422).render('signup', {
        title: 'Sign up',
        email,
        errors: errors.array(),
      });
    }

    if (!email || !password) {
      return res.status(400).render('signup', {
        title: 'Sign up',
        errors: [{ msg: 'Email and password are required' }],
        email,
      });
    }

    const existingUser = await userSql.findUserByEmail(email);
    if (existingUser) {
      return res.status(400).render('signup', {
        title: 'Sign up',
        errors: [{ msg: 'Email is already in use' }],
        email,
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let user;
    try {
      user = await userSql.createUser({
        email,
        password: hashedPassword,
      });
    } catch (err) {
      if (err.code === 'EMAIL_IN_USE') {
        return res.status(400).render('signup', {
          title: 'Sign up',
          errors: [{ msg: 'Email is already in use' }],
          email,
        });
      }
      throw err;
    }

    req.session.isLoggedIn = true;
    req.session.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };
    return res.redirect('/');
  } catch (err) {
    console.error('Signup error:', err);
    err.publicMessage = 'Something went wrong while signing you up. Please try again.';
    return next(err);
  }
};

exports.postLogout = (req, res) => {
  try {
    req.session.isLoggedIn = false;
    req.session.user = null;
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destroy error:', err);
      }
      return res.redirect('/');
    });
  } catch (err) {
    console.error('Logout error:', err);
    return res.redirect('/');
  }
};
