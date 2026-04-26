const isProduction = process.env.NODE_ENV === 'production';

const COOKIE_NAMES = {
  token: 'sf_token',
  cart: 'sf_cart',
  csrf: 'sf_csrf'
};

function cookieOptions(overrides = {}) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/',
    ...overrides
  };
}

module.exports = { COOKIE_NAMES, cookieOptions };
