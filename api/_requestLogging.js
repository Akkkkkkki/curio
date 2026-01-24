import { randomUUID } from 'crypto';

const MAX_ERROR_MESSAGE_LENGTH = 200;

const sanitizeErrorMessage = (message) => {
  if (!message) return null;
  if (message.length <= MAX_ERROR_MESSAGE_LENGTH) return message;
  return `${message.slice(0, MAX_ERROR_MESSAGE_LENGTH)}…`;
};

export const attachRequestLogger = (req, res, { route, provider, model } = {}) => {
  const requestIdHeader = req.headers['x-request-id'];
  const requestId =
    typeof requestIdHeader === 'string' && requestIdHeader.trim()
      ? requestIdHeader
      : `req_${randomUUID()}`;
  res.setHeader('x-request-id', requestId);

  const start = Date.now();

  res.on('finish', () => {
    const status = res.statusCode;
    const ok = status < 400;
    const errorInfo = res.locals?.apiError || {};
    const payload = {
      event: 'api_request',
      ts: new Date().toISOString(),
      route,
      method: req.method,
      status,
      durationMs: Date.now() - start,
      ok,
      requestId,
      deployment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
      commitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
      provider: provider || null,
      model: model || null,
      errorName: ok ? null : errorInfo.name || null,
      errorMessage: ok ? null : sanitizeErrorMessage(errorInfo.message),
    };

    console.log(JSON.stringify(payload));
  });
};

export const recordApiError = (res, { name, message }) => {
  res.locals = res.locals || {};
  res.locals.apiError = { name, message };
};
