import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from '../lib/errors.js';
import { env } from '../config/env.js';

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  // Malformed JSON body from express.json()
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Malformed JSON body' } });
    return;
  }
  // Postgres constraint violations that slipped past API validation.
  if (err?.code === '23505') {
    res.status(409).json({ error: { code: 'CONFLICT', message: 'A record with these values already exists' } });
    return;
  }
  if (err?.code === '23514' || err?.code === '22P02') {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid data' } });
    return;
  }
  if (env.NODE_ENV !== 'test') console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong' } });
};
