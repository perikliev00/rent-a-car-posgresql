// helmet задава защитни HTTP headers за Express приложения.
const helmet = require('helmet');

/**
 * Прилага security headers. CSP остава nonce-based за scripts.
 * @param {import('express').Express} app
 * @param {{ isProd: boolean }} opts
 */
function applySecurity(app, { isProd }) {
  // ---- Helmet base с CSP ----
  // Mount-ваме един Helmet middleware – CSP плюс browser-protection headers.
  app.use(helmet({
    contentSecurityPolicy: {
      // Започваме от Helmet defaults и override-ваме само директивите нужни за проекта.
      useDefaults: true,
      directives: {
        // По подразбиране – ресурси само от същия origin.
        "default-src": ["'self'"],
        // Scripts: local + per-request nonce + Stripe
        "script-src": [
          // Скриптове от същия origin.
          "'self'",
          // res.locals.cspNonce трябва да е сетнат по-рано от middleware
          // Inline script blocks само с exact per-request nonce.
          (req, res) => `'nonce-${res.locals.cspNonce}'`,
          // Stripe hosted script bundle.
          "https://js.stripe.com",
          // Stripe network origin за checkout flows.
          "https://m.stripe.network"
        ],
        // Явно разрешаваме script elements от същите източници.
        "script-src-elem": [
          "'self'",
          (req, res) => `'nonce-${res.locals.cspNonce}'`,
          "https://js.stripe.com",
          "https://m.stripe.network"
        ],
        // Забранени inline attributes (onclick и т.н.)
        "script-src-attr": ["'none'"],
        // Stripe frames/popups
        "frame-src": [
          // Stripe JS може да inject-ва secure iframes за payment UI.
          "https://js.stripe.com",
          // Stripe webhook/hosted flows също използват този origin.
          "https://hooks.stripe.com",
          "https://checkout.stripe.com"
        ],
        // XHR/fetch към Stripe
        // Позволяваме заявки към нашия backend плюс Stripe APIs.
        "connect-src": ["'self'", "https://api.stripe.com", "https://m.stripe.network"],
        // Form posts към Stripe checkout
        "form-action": ["'self'", "https://checkout.stripe.com"],
        // Styles: inline за EJS/Tailwind + external CSS
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
        // Images & fonts (https: ако car images са off-site)
        "img-src": ["'self'", "data:", "blob:", "https:"],
        "font-src": ["'self'", "data:", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
        // Workers/manifests
        "worker-src": ["'self'", "blob:"],
        "manifest-src": ["'self'"],
        // Lockdown
        "object-src": ["'none'"],
        "base-uri": ["'self'"],
        // Production-only – по-стриктни ancestors и upgrade
        ...(isProd ? {
          // Сайтът да не може да се embed-ва от външни origins.
          "frame-ancestors": ["'self'"],
          // Browsers да upgrade-ват http към https.
          "upgrade-insecure-requests": []
        } : {})
      }
    },
    // COEP изключен – може да счупи third-party интеграции; проектът не го изисква.
    crossOriginEmbedderPolicy: false,
    // X-Frame-Options (frameguard). Redundant ако frame-ancestors е наличен.
    frameguard: { action: 'sameorigin' },
    // MIME sniffing защити
    noSniff: true,
    // Referrer policy
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    // HSTS само в production (изисква HTTPS)
    hsts: isProd ? {
      maxAge: 15552000, // 180 дни
      includeSubDomains: true,
      preload: false
    } : false,
  }));

  // Минимална Permissions-Policy (Feature-Policy наследник)
  app.use((req, res, next) => {
    // Изключени чувствителни browser функции, които приложението не използва.
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    // Продължаваме обработката след като header-ът е добавен.
    next();
  });
}

// Експорт – server.js да приложи security при startup.
module.exports = applySecurity;
