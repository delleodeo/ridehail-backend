import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../shared/errors/AppError.js';

const CSRF_COOKIE = 'rydora_csrf';

function sign(value) {
  return createHmac('sha256', env.CSRF_SECRET).update(value).digest('base64url');
}

export function createCsrfToken() {
  const value = randomBytes(24).toString('base64url');
  return `${value}.${sign(value)}`;
}

export function isValidCsrfToken(token) {
  if (typeof token !== 'string') return false;
  const [value, signature, ...rest] = token.split('.');
  if (!value || !signature || rest.length) return false;
  const expected = Buffer.from(sign(value));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function setCsrfCookie(res) {
  const token = createCsrfToken();
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
  });
  return token;
}

export function csrfProtection(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.get('x-csrf-token');
  if (
    !cookieToken ||
    !headerToken ||
    cookieToken !== headerToken ||
    !isValidCsrfToken(cookieToken)
  ) {
    return next(
      new AppError('The request could not be verified. Refresh and try again.', {
        statusCode: 403,
        code: 'CSRF_INVALID',
      }),
    );
  }
  return next();
}

