import { parseCookie } from 'cookie';
import { verifyAccessToken } from '../modules/auth/token.service.js';
import { User } from '../modules/users/user.model.js';
import { ACCOUNT_STATUS } from '../shared/constants.js';

export function readSocketAccessToken(cookieHeader = '') {
  return parseCookie(cookieHeader).rydora_access;
}

export async function socketAuth(socket, next) {
  try {
    const accessToken = readSocketAccessToken(socket.handshake.headers.cookie);
    const claims = verifyAccessToken(accessToken);
    const user = await User.findOne({
      _id: claims.sub,
      accountStatus: ACCOUNT_STATUS.ACTIVE,
    }).lean();
    if (!user) throw new Error('User unavailable');
    socket.data.auth = { userId: String(user._id), role: user.role };
    next();
  } catch {
    next(new Error('unauthorized'));
  }
}

