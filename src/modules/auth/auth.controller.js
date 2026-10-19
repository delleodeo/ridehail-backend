import { env } from '../../config/env.js';
import { sendSuccess } from '../../shared/utils/apiResponse.js';
import { setCsrfCookie } from '../../middlewares/csrf.js';
import * as authService from './auth.service.js';
import { durationToMilliseconds } from './token.service.js';

const accessCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
  maxAge: durationToMilliseconds(env.ACCESS_TOKEN_TTL),
};

const refreshCookieOptions = {
  ...accessCookieOptions,
  path: '/api/v1/auth',
  maxAge: durationToMilliseconds(env.REFRESH_TOKEN_TTL),
};

function requestContext(req) {
  return { userAgent: req.get('user-agent'), ipAddress: req.ip };
}

function setSessionCookies(res, result) {
  res.cookie('rydora_access', result.accessToken, accessCookieOptions);
  res.cookie('rydora_refresh', result.refreshToken, refreshCookieOptions);
  const csrfToken = setCsrfCookie(res);
  return { user: result.user, csrfToken };
}

export async function register(req, res) {
  const result = await authService.register(req.validated.body, requestContext(req));
  return sendSuccess(res, setSessionCookies(res, result), { statusCode: 201 });
}

export async function login(req, res) {
  const result = await authService.login(req.validated.body, requestContext(req));
  return sendSuccess(res, setSessionCookies(res, result));
}

export async function refresh(req, res) {
  const result = await authService.refresh(req.cookies?.rydora_refresh, requestContext(req));
  return sendSuccess(res, setSessionCookies(res, result));
}

export async function logout(req, res) {
  await authService.logout(req.cookies?.rydora_refresh);
  res.clearCookie('rydora_access', accessCookieOptions);
  res.clearCookie('rydora_refresh', refreshCookieOptions);
  res.clearCookie('rydora_csrf', { path: '/' });
  return sendSuccess(res, { message: 'Signed out successfully.' });
}

export function me(req, res) {
  return sendSuccess(res, { user: req.auth.user });
}

export function csrf(_req, res) {
  return sendSuccess(res, { csrfToken: setCsrfCookie(res) });
}

