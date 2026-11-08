import { Router, type CookieOptions, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { env, isProduction } from '../../config/env.js';
import { currentUser, requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { AUTH_COOKIE, signToken } from '../../lib/token.js';
import type { AuthUser } from '../../lib/types.js';
import { authService } from './auth.service.js';
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from './auth.schemas.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const cookieOptions: CookieOptions = {
  httpOnly: true, // not readable from JS → mitigates token theft via XSS
  secure: isProduction, // HTTPS only in production
  sameSite: 'lax', // not sent on cross-site POSTs → mitigates CSRF
  path: '/',
};

function startSession(res: Response, user: AuthUser) {
  res.cookie(AUTH_COOKIE, signToken(user.id), { ...cookieOptions, maxAge: SEVEN_DAYS_MS });
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts, please try again later' } },
});

export const authRouter = Router();

authRouter.post('/register', authLimiter, validate(registerSchema), async (_req, res) => {
  const user = await authService.register(res.locals.body as RegisterInput);
  startSession(res, user);
  res.status(201).json({ user });
});

authRouter.post('/login', authLimiter, validate(loginSchema), async (_req, res) => {
  const user = await authService.login(res.locals.body as LoginInput);
  startSession(res, user);
  res.json({ user });
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(AUTH_COOKIE, cookieOptions);
  res.status(204).end();
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: currentUser(req) });
});
