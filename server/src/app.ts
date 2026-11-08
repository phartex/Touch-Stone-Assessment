import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { coursesRouter } from './modules/courses/courses.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { lessonsRouter } from './modules/lessons/lessons.routes.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/courses', coursesRouter);
  app.use('/api/lessons', lessonsRouter);
  app.use('/api/me/dashboard', dashboardRouter);
  app.use('/api/admin', adminRouter);

  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}
