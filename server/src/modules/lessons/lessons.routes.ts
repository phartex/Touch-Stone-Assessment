import { Router } from 'express';
import { currentUser, requireAuth } from '../../middleware/auth.js';
import { idParam, validate } from '../../middleware/validate.js';
import { progressService } from '../progress/progress.service.js';
import { lessonsService } from './lessons.service.js';
import { progressSchema, type ProgressInput } from './lessons.schemas.js';

export const lessonsRouter = Router();
lessonsRouter.use(requireAuth);

lessonsRouter.get('/:id', validate(idParam, 'params'), async (req, res) => {
  res.json(await lessonsService.getLessonView(currentUser(req), res.locals.params.id));
});

lessonsRouter.put('/:id/progress', validate(idParam, 'params'), validate(progressSchema), async (req, res) => {
  const result = await progressService.saveProgress(
    currentUser(req),
    res.locals.params.id,
    res.locals.body as ProgressInput,
  );
  res.json(result);
});
