import type { RequestHandler } from 'express';
import { z } from 'zod';
import { badRequest } from '../lib/errors.js';

/**
 * Parse `req[source]` with a Zod schema. On success the parsed (coerced, stripped) value is
 * stored on `res.locals[source]`, so handlers only ever see validated data.
 */
export function validate(schema: z.ZodType, source: 'body' | 'query' | 'params' = 'body'): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(
        badRequest(
          'Validation failed',
          result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
        ),
      );
    }
    res.locals[source] = result.data;
    next();
  };
}

export const idParam = z.object({ id: z.uuid('Invalid id') });
