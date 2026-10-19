import { createHash, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';

const commonOptions = {
  issuer: 'rydora-api',
  audience: 'rydora-web',
};

export function createAccessToken(user) {
  return jwt.sign(
    { sub: String(user._id), role: user.role, type: 'access' },
    env.JWT_ACCESS_SECRET,
    { ...commonOptions, expiresIn: env.ACCESS_TOKEN_TTL, jwtid: randomUUID() },
  );
}

export function createRefreshToken(user, sessionId = randomUUID()) {
  return jwt.sign(
    { sub: String(user._id), role: user.role, type: 'refresh', sid: sessionId },
    env.JWT_REFRESH_SECRET,
    { ...commonOptions, expiresIn: env.REFRESH_TOKEN_TTL, jwtid: randomUUID() },
  );
}

export function verifyAccessToken(token) {
  const claims = jwt.verify(token, env.JWT_ACCESS_SECRET, commonOptions);
  if (claims.type !== 'access') throw new Error('Unexpected token type');
  return claims;
}

export function verifyRefreshToken(token) {
  const claims = jwt.verify(token, env.JWT_REFRESH_SECRET, commonOptions);
  if (claims.type !== 'refresh') throw new Error('Unexpected token type');
  return claims;
}

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function tokenExpiration(token) {
  const decoded = jwt.decode(token);
  return new Date(decoded.exp * 1000);
}

export function durationToMilliseconds(value) {
  const match = /^(\d+)(s|m|h|d)$/.exec(value);
  if (!match) throw new Error(`Unsupported token duration: ${value}`);
  const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return Number(match[1]) * multipliers[match[2]];
}

