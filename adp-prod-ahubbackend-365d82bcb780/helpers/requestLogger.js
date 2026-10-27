/**
 * Express middleware for HTTP request/response logging and centralized error
 * handling. Every request is tagged with a correlation id so that all log
 * events belonging to a single request can be grouped together in Splunk
 * (search: `correlationId="..."`).
 */

const crypto = require('crypto');
const logger = require('./logger');

/**
 * Attaches a correlation id to each request and logs the request lifecycle.
 * Reuses an incoming `x-correlation-id` / `x-request-id` header when present so
 * ids stay consistent across upstream services; otherwise generates a new one.
 */
function requestLogger(req, res, next) {
  const correlationId =
    req.headers['x-correlation-id'] ||
    req.headers['x-request-id'] ||
    crypto.randomUUID();

  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);

  const startedAt = process.hrtime.bigint();

  logger.http('request.received', {
    correlationId,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip || req.socket?.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const meta = {
      correlationId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      userId: req.user?.id,
    };

    if (res.statusCode >= 500) {
      logger.error('request.completed', meta);
    } else if (res.statusCode >= 400) {
      logger.warn('request.completed', meta);
    } else {
      logger.http('request.completed', meta);
    }
  });

  next();
}

/**
 * Centralized error handler. Place this AFTER all routes so unhandled errors
 * bubble here, get logged with their correlation id, and return a safe response.
 */
// eslint-disable-next-line no-unused-vars
function errorLogger(err, req, res, next) {
  logger.error('request.unhandled_error', {
    correlationId: req.correlationId,
    method: req.method,
    path: req.originalUrl,
    userId: req.user?.id,
    error: err,
  });

  if (res.headersSent) {
    return next(err);
  }

  res.status(err.status || 500).send({
    data: null,
    message: 'Internal server error',
    status: 'Failure',
    correlationId: req.correlationId,
  });
}

module.exports = {
  requestLogger,
  errorLogger,
};
