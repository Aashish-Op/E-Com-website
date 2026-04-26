const { httpError } = require('../utils/httpError');
const { COOKIE_NAMES } = require('../utils/cookies');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function csrfProtection(req, _res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (process.env.NODE_ENV !== 'production' && process.env.CSRF_STRICT !== 'true') return next();
  if (req.path === '/api/payments/webhook') return next();

  const cookieToken = req.cookies?.[COOKIE_NAMES.csrf];
  const headerToken = req.get('x-csrf-token');
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return next(httpError(403, 'Invalid CSRF token'));
  }
  next();
}

module.exports = csrfProtection;
