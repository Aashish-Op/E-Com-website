const { httpError } = require('../utils/httpError');

function requireAuth(req, _res, next) {
  if (!req.user) return next(httpError(401, 'Authentication required'));
  next();
}

function requireAdmin(req, _res, next) {
  if (!req.user) return next(httpError(401, 'Authentication required'));
  if (!['admin', 'super_admin'].includes(req.user.role)) {
    return next(httpError(403, 'Admin access required'));
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
