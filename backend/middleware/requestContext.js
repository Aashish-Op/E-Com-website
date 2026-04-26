const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { COOKIE_NAMES, cookieOptions } = require('../utils/cookies');

async function requestContext(req, res, next) {
  try {
    let cartToken = req.cookies?.[COOKIE_NAMES.cart];
    if (!cartToken) {
      cartToken = crypto.randomUUID();
      res.cookie(COOKIE_NAMES.cart, cartToken, cookieOptions({
        maxAge: 1000 * 60 * 60 * 24 * 365,
        httpOnly: true
      }));
    }
    req.cartToken = cartToken;

    let csrfToken = req.cookies?.[COOKIE_NAMES.csrf];
    if (!csrfToken) {
      csrfToken = crypto.randomBytes(24).toString('hex');
      res.cookie(COOKIE_NAMES.csrf, csrfToken, cookieOptions({
        maxAge: 1000 * 60 * 60 * 24 * 7,
        httpOnly: false
      }));
    }
    req.csrfToken = csrfToken;

    const bearer = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null;
    const token = req.cookies?.[COOKIE_NAMES.token] || bearer;
    if (token && process.env.JWT_SECRET) {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(payload.sub);
      if (user) req.user = user;
    }
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      res.clearCookie(COOKIE_NAMES.token, cookieOptions());
      return next();
    }
    next(err);
  }
}

module.exports = requestContext;
