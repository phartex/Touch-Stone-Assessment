import type { RequestHandler } from 'express';
import { forbidden, unauthorized } from '../lib/errors.js';
import { AUTH_COOKIE, verifyToken } from '../lib/token.js';
import type { AuthUser, Role } from '../lib/types.js';
import { usersRepository } from '../modules/auth/users.repository.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Requires a valid session cookie. The user is re-loaded from the database on every request so
 * that deleted users or role changes take effect immediately rather than when the token expires.
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const token: unknown = req.cookies?.[AUTH_COOKIE];
  const userId = typeof token === 'string' ? verifyToken(token) : null;
  if (!userId) return next(unauthorized());
  const user = await usersRepository.findById(userId);
  if (!user) return next(unauthorized());
  req.user = user;
  next();
};

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };
}

/** Narrowing helper for handlers mounted behind `requireAuth`. */
export function currentUser(req: Express.Request): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}
