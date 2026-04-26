const { HttpError } = require('../utils/httpError');

function notFound(req, res) {
  res.status(404).json({ success: false, message: 'Route not found' });
}

function errorHandler(err, _req, res, _next) {
  const status = err instanceof HttpError ? err.status : (err.status || 500);
  const payload = {
    success: false,
    message: err.message || 'Internal server error'
  };
  if (err.details) payload.details = err.details;
  if (process.env.NODE_ENV === 'development') payload.stack = err.stack;
  if (status >= 500) console.error(err);
  res.status(status).json(payload);
}

module.exports = { notFound, errorHandler };
