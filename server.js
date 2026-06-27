// Зарежда environment променливи от .env преди другите модули да четат process.env.
require('dotenv').config();

// Express framework – за HTTP сървър и middleware pipeline.
const express = require('express');
const pool = require('./db/pool');
// body-parser – за urlencoded и JSON request bodies на non-webhook routes.
const bodyParser = require('body-parser');
// path – за filesystem-safe абсолютни пътища към static директории.
const path = require('path');
// Express sessions – за guest/admin state между заявките.
const session = require('express-session');
// Session persistence в PostgreSQL.
const pgSession = require('connect-pg-simple')(session);
// crypto – за per-request CSP nonce за разрешени inline scripts.
const crypto = require('crypto');
// payment controller – Stripe webhook се mount-ва директно в server.js.
const paymentController = require('./controllers/payment');
// Rate limiter – защита на admin route група от request bursts.
const { adminLimiter } = require('./middleware/rateLimit');
// Security bootstrap – Helmet и свързани headers.
const applySecurity = require('./config/security');
// correlation ID middleware – уникален request ID за логове и error страници.
const { requestContext } = require('./middleware/requestContext');
// 404 generator и central error middleware.
const { handleNotFound, errorHandler } = require('./middleware/errorHandler');
const { csrfProtection, setCsrfToken } = require('./middleware/csrf');

// Route модули – mount-ват се в предсказуем ред.
const paymentRoutes = require('./routes/paymentRoutes');
const reservationRoutes = require('./routes/reservationRoutes');
const carRoutes     = require('./routes/carRoutes');
const adminRoutes   = require('./routes/adminRoutes');
const supportRoutes = require('./routes/supportRoutes');
const footerRoutes  = require('./routes/footerRoutes');
const authRoutes    = require('./routes/authRoutes');

// Background maintenance jobs – почистват booking state с времето.
const { cleanUpOutdatedDates } = require('./services/carService');
const { cleanUpAbandonedReservations } = require('./services/reservationService');
const { ensureSessionTable } = require('./services/sql/sessionSqlService');

// Главният Express application обект.
const app = express();
// Idle timeout за session TTL и cookie expiry.
const SESSION_IDLE_MS = 20 * 60 * 1000; // 20 минути
// Определяме веднъж дали приложението работи в production.
const isProd = process.env.NODE_ENV === 'production';
// Референция към live HTTP сървъра – за затваряне при graceful shutdown.
let server = null;
// Флаг – true след начало на shutdown – нови заявки получават 503.
let isShuttingDown = false;
// Проследяване на setInterval handles – да се спрат чисто.
const backgroundJobs = [];

// correlation ID – преди всичко, за да има всеки log ред достъп.
app.use(requestContext);
// General static assets от public/.
app.use(express.static(path.join(__dirname, 'public')));
// CSS файлове от явен /css mount.
app.use('/css',    express.static(path.join(__dirname, 'public/css')));
// Car и други images от public/images.
app.use('/images', express.static(path.join(__dirname, 'public/images')));
// EJS за server-side views.
app.set('view engine', 'ejs');

// Stripe webhooks – raw body за верификация на подписа.
app.post(
  '/webhook/stripe',
  express.raw({ type: 'application/json' }),
  paymentController.handleStripeWebhook
);
// HTML form submissions – за нормалните routes.
app.use(bodyParser.urlencoded({ extended: true }));
// JSON request bodies – за API-style routes.
app.use(bodyParser.json());

// CSP nonce – преди Helmet, за да може script-src да разреши nonced scripts.
app.use((req, res, next) => {
  // Генерираме свеж nonce на заявка и го излагаме към templates/security.
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
});
// Helmet/CSP и други HTTP security headers след nonce.
applySecurity(app, { isProd });

// При shutdown – отказваме нови заявки с 503 вместо да висят.
app.use((req, res, next) => {
  if (!isShuttingDown) {
    return next();
  }

  // Process-ът изтича и не трябва да приема нови business заявки.
  const message = 'Server is restarting. Please retry in a few moments.';
  // Browser заявки – rendered error страница.
  if ((req.get('accept') || '').includes('text/html')) {
    return res.status(503).render('error/500', {
      title: 'Service Unavailable',
      message,
      correlationId: req.correlationId,
    });
  }

  // Програмни клиенти – JSON payload с app error форма.
  return res.status(503).json({
    error: {
      code: 'SERVICE_UNAVAILABLE',
      message,
      correlationId: req.correlationId,
    },
  });
});

// PostgreSQL-backed session store – login/guest state оцелява при restart.
const store = new pgSession({
  pool,
  tableName: 'session',
  createTableIfMissing: true,
  ttl: Math.floor(SESSION_IDLE_MS / 1000),
  pruneSessionInterval: 15 * 60,
});

// Логваме session store грешки – счупена persistence засяга auth и booking hold.
store.on('error', (err) => {
  console.error('Session store error:', err && err.message ? err.message : err);
});

// Ако TLS се terminate-ва на proxy (Heroku/Render/Nginx) – trust в prod.
if (isProd) {
  app.set('trust proxy', 1);
}

// Sessions
app.use(session({
  name: 'sid',
  secret: process.env.SESSION_SECRET ,
  store,
  resave: false,
  saveUninitialized: false, // session само когато сетнем нещо
  rolling: true,            // refresh cookie expiry при всяка заявка (idle timeout)
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,         // false на localhost, true в prod
    maxAge: SESSION_IDLE_MS,       // browser expiry (idle чрез rolling)
  },
}));

// Session defaults – ПРЕДИ routes, за да има session от първия hit.
app.use((req, res, next) => {
  if (!req.session.isPaid) req.session.isPaid = false;
  if (req.session._sid !== req.sessionID) req.session._sid = req.sessionID;
  next();
});

// Auth state за templates.
app.use((req, res, next) => {
  res.locals.isLoggedIn = !!req.session.isLoggedIn;
  res.locals.user = req.session.user || null;
  next();
});

// Logged-in GET pages need a CSRF token for header logout forms.
app.use((req, res, next) => {
  if (req.method !== 'GET' || !req.session.isLoggedIn) {
    return next();
  }
  csrfProtection(req, res, (err) => {
    if (err) return next(err);
    setCsrfToken(req, res, next);
  });
});

// csrfToken винаги в res.locals – дори на routes без CSRF middleware.
app.use((req, res, next) => {
  if (typeof res.locals.csrfToken === 'undefined') {
    res.locals.csrfToken = null;
  }
  next();
});

// Mount customer-facing car routes първо.
app.use(carRoutes);
app.use(reservationRoutes);
app.use(paymentRoutes);
app.use(authRoutes);

// admin routes – защитени от admin rate limiter.
app.use(adminLimiter, adminRoutes);
app.use(supportRoutes);
app.use(footerRoutes);
// Ако никой route не match-не – 404.
app.use(handleNotFound);
// Финален safety net – всички грешки стигат тук.
app.use(errorHandler);

// Регистрира background job handle за stop при shutdown.
function registerBackgroundJob(job) {
  backgroundJobs.push(job);
  return job;
}

// Спира всички tracked intervals.
function stopBackgroundJobs() {
  while (backgroundJobs.length) {
    const job = backgroundJobs.pop();
    clearInterval(job);
  }
}

// Controlled shutdown при фатални събития.
async function gracefulShutdown(trigger, error = null) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.error(`Starting graceful shutdown due to ${trigger}`);
  if (error) {
    console.error(error);
  }

  stopBackgroundJobs();

  // Safety timer – при зависване на shutdown – force exit.
  const forceExitTimer = setTimeout(() => {
    console.error('Graceful shutdown timed out. Forcing exit.');
    process.exit(error ? 1 : 0);
  }, 10000);
  forceExitTimer.unref?.();

  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((serverCloseError) => {
          if (serverCloseError) {
            reject(serverCloseError);
            return;
          }
          resolve();
        });
      });
    }

    await pool.end();
  } catch (shutdownError) {
    console.error('Error during graceful shutdown:', shutdownError);
  } finally {
    clearTimeout(forceExitTimer);
    process.exit(error ? 1 : 0);
  }
}

// Bootstrap – async за DB connect и housekeeping.
(async () => {
  try {
    const pgResult = await pool.query('SELECT NOW() AS now');
    console.log('✓ PostgreSQL connected:', pgResult.rows[0].now);

    await ensureSessionTable();

    await cleanUpOutdatedDates();
    await cleanUpAbandonedReservations();

    registerBackgroundJob(setInterval(cleanUpOutdatedDates, 3 * 60 * 1000));          // всеки 3 мин
    registerBackgroundJob(setInterval(cleanUpAbandonedReservations, 3 * 60 * 1000));  // всеки 3 мин

    const PORT = process.env.PORT || 3000;
    server = app.listen(PORT, () => {
      console.log(`🚗  LuxRide Server running at http://localhost:${PORT}`);
      console.log(`NODE_ENV=${process.env.NODE_ENV || 'development'}  isProd=${isProd}`);
    });

    process.on('SIGINT', () => {
      gracefulShutdown('SIGINT');
    });

    process.on('SIGTERM', () => {
      gracefulShutdown('SIGTERM');
    });

    process.on('unhandledRejection', (reason) => {
      console.error('Unhandled promise rejection:', reason);
      gracefulShutdown('unhandledRejection', reason instanceof Error ? reason : new Error(String(reason)));
    });

    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception:', error);
      gracefulShutdown('uncaughtException', error);
    });
  } catch (err) {
    console.error('Database/bootstrap connection error:', err);
    process.exit(1);
  }
})();
