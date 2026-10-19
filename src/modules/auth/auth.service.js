import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { Driver } from '../drivers/driver.model.js';
import { User } from '../users/user.model.js';
import { ACCOUNT_STATUS, ROLES } from '../../shared/constants.js';
import { AppError } from '../../shared/errors/AppError.js';
import { RefreshSession } from './refreshSession.model.js';
import {
  createAccessToken,
  createRefreshToken,
  hashToken,
  tokenExpiration,
  verifyRefreshToken,
} from './token.service.js';

const HASH_ROUNDS = 12;

function publicUser(user) {
  const value = user.toObject ? user.toObject() : { ...user };
  delete value.passwordHash;
  delete value.__v;
  return value;
}

async function issueSession(user, context, session) {
  const accessToken = createAccessToken(user);
  const refreshToken = createRefreshToken(user);
  await RefreshSession.create(
    [
      {
        userId: user._id,
        tokenHash: hashToken(refreshToken),
        expiresAt: tokenExpiration(refreshToken),
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
      },
    ],
    { session },
  );
  return { accessToken, refreshToken };
}

export async function register(input, context = {}) {
  const role = input.accountType === 'driver' ? ROLES.DRIVER : ROLES.COMMUTER;
  const passwordHash = await bcrypt.hash(input.password, HASH_ROUNDS);
  let result;

  await mongoose.connection.transaction(async (session) => {
    const [user] = await User.create(
      [
        {
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          phone: input.phone,
          passwordHash,
          role,
        },
      ],
      { session },
    );

    if (role === ROLES.DRIVER) {
      await Driver.create([{ userId: user._id }], { session });
    }

    const tokens = await issueSession(user, context, session);
    result = { user: publicUser(user), ...tokens };
  });

  return result;
}

export async function login({ identifier, password }, context = {}) {
  const normalized = identifier.trim().toLowerCase();
  const user = await User.findOne({
    $or: [{ email: normalized }, { phone: identifier.trim() }],
  }).select('+passwordHash');

  const validPassword = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !validPassword) {
    throw new AppError('The email, phone number, or password is incorrect.', {
      statusCode: 401,
      code: 'INVALID_CREDENTIALS',
    });
  }
  if (user.accountStatus !== ACCOUNT_STATUS.ACTIVE) {
    throw new AppError('This account is suspended. Contact an administrator.', {
      statusCode: 403,
      code: 'ACCOUNT_SUSPENDED',
    });
  }

  let tokens;
  await mongoose.connection.transaction(async (session) => {
    tokens = await issueSession(user, context, session);
  });
  return { user: publicUser(user), ...tokens };
}

export async function refresh(refreshToken, context = {}) {
  if (!refreshToken) {
    throw new AppError('A refresh session is required.', {
      statusCode: 401,
      code: 'REFRESH_REQUIRED',
    });
  }

  let claims;
  try {
    claims = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError('The refresh session is invalid or expired.', {
      statusCode: 401,
      code: 'INVALID_REFRESH_TOKEN',
    });
  }

  const oldHash = hashToken(refreshToken);
  let result;
  await mongoose.connection.transaction(async (session) => {
    const consumed = await RefreshSession.findOneAndUpdate(
      {
        tokenHash: oldHash,
        revokedAt: null,
        expiresAt: mongoose.trusted({ $gt: new Date() }),
      },
      { $set: { revokedAt: new Date() } },
      { returnDocument: 'after', session },
    );
    if (!consumed) {
      throw new AppError('This refresh session has already been used or revoked.', {
        statusCode: 401,
        code: 'REFRESH_REUSE_DETECTED',
      });
    }

    const user = await User.findOne({
      _id: claims.sub,
      accountStatus: ACCOUNT_STATUS.ACTIVE,
    }).session(session);
    if (!user) {
      throw new AppError('This account is unavailable.', {
        statusCode: 401,
        code: 'ACCOUNT_UNAVAILABLE',
      });
    }

    const tokens = await issueSession(user, context, session);
    consumed.replacedByTokenHash = hashToken(tokens.refreshToken);
    await consumed.save({ session });
    result = { user: publicUser(user), ...tokens };
  });
  return result;
}

export async function logout(refreshToken) {
  if (refreshToken) {
    await RefreshSession.updateOne(
      { tokenHash: hashToken(refreshToken), revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
  }
}

