/**
 * Structured logger for the Ahub backend.
 *
 * Emits one JSON object per line (JSON Lines) to stdout/stderr. This format is
 * directly ingestible by Splunk – either by pointing a Universal Forwarder /
 * file monitor at the process log, or by piping stdout to the Splunk HTTP Event
 * Collector (HEC). Keeping the output as structured JSON means every field
 * (level, message, correlationId, userId, durationMs, ...) becomes a searchable
 * Splunk field with no custom props.conf parsing required.
 *
 * No external dependencies are required.
 *
 * Optional environment variables:
 *   LOG_LEVEL   -> minimum level to emit (error|warn|info|http|debug). Default: info
 *   SERVICE_NAME-> logical service name attached to every event. Default: ahub-backend
 *   NODE_ENV    -> environment tag attached to every event. Default: development
 */

const os = require('os');

const LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const SERVICE_NAME = process.env.SERVICE_NAME || 'ahub-backend';
const ENVIRONMENT = process.env.NODE_ENV || 'development';
const HOSTNAME = os.hostname();

function resolveThreshold() {
  const configured = (process.env.LOG_LEVEL || 'info').toLowerCase();
  return LEVELS[configured] !== undefined ? LEVELS[configured] : LEVELS.info;
}

const THRESHOLD = resolveThreshold();

/**
 * Remove values that Splunk should never receive (tokens, passwords, secrets).
 * Applied recursively to any metadata object passed to the logger.
 */
const REDACT_KEYS = new Set([
  'password',
  'pass',
  'token',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'authorization',
  'secret',
  'secretkey',
  'apikey',
  'api_key',
]);

function sanitize(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (seen.has(value)) {
    return '[Circular]';
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item, seen));
  }

  const output = {};
  for (const [key, val] of Object.entries(value)) {
    if (REDACT_KEYS.has(key.toLowerCase())) {
      output[key] = '[REDACTED]';
    } else {
      output[key] = sanitize(val, seen);
    }
  }
  return output;
}

function serializeError(error) {
  if (!(error instanceof Error)) {
    return error;
  }
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    ...(error.code !== undefined ? { code: error.code } : {}),
  };
}

function write(level, message, meta = {}) {
  if (LEVELS[level] > THRESHOLD) {
    return;
  }

  const { error, ...rest } = meta || {};

  const event = {
    timestamp: new Date().toISOString(),
    level,
    service: SERVICE_NAME,
    env: ENVIRONMENT,
    host: HOSTNAME,
    pid: process.pid,
    message,
    ...sanitize(rest),
  };

  if (error !== undefined) {
    event.error = sanitize(serializeError(error));
  }

  const line = JSON.stringify(event);

  if (level === 'error') {
    process.stderr.write(`${line}\n`);
  } else {
    process.stdout.write(`${line}\n`);
  }
}

module.exports = {
  error: (message, meta) => write('error', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  info: (message, meta) => write('info', message, meta),
  http: (message, meta) => write('http', message, meta),
  debug: (message, meta) => write('debug', message, meta),
  levels: LEVELS,
};
