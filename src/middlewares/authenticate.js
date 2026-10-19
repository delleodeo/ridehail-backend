import { User } from '../modules/users/user.model.js';
import { ACCOUNT_STATUS } from '../shared/constants.js';
import { AppError } from '../shared/errors/AppError.js';
import { verifyAccessToken } from '../modules/auth/token.service.js';

export async function authenticate(req, _res, next) {
  try {
    const token = req.cookies?.rydora_access;
    if (!token) {
      throw new AppError('Authentication is required.', {
        statusCode: 401,
        code: 'AUTH_REQUIRED',
      });
    }

    const claims = verifyAccessToken(token);
    const user = await User.findById(claims.sub).lean();
    if (!user || user.accountStatus !== ACCOUNT_STATUS.ACTIVE) {
      throw new AppError('This account is unavailable.', {
        statusCode: 401,
        code: 'ACCOUNT_UNAVAILABLE',
      });
    }

    req.auth = { userId: String(user._id), role: user.role, user };
    return next();
  } catch (error) {
    if (error instanceof AppError) return next(error);
    return next(
      new AppError('Your session is invalid or has expired.', {
        statusCode: 401,
        code: 'INVALID_ACCESS_TOKEN',
      }),
    );
  }
}

