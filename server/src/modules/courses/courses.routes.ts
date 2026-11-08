import { Router } from 'express';
import { currentUser, requireAuth } from '../../middleware/auth.js';
import { idParam, validate } from '../../middleware/validate.js';
import { coursesService } from './courses.service.js';
import { catalogQuerySchema, type CatalogQuery } from './courses.schemas.js';

export const coursesRouter = Router();
coursesRouter.use(requireAuth);

coursesRouter.get('/', validate(catalogQuerySchema, 'query'), async (req, res) => {
  const courses = await coursesService.listCatalog(currentUser(req), res.locals.query as CatalogQuery);
  res.json({ courses });
});

coursesRouter.get('/categories', async (_req, res) => {
  res.json({ categories: await coursesService.listCategories() });
});

coursesRouter.get('/:id', validate(idParam, 'params'), async (req, res) => {
  const course = await coursesService.getDetail(currentUser(req), res.locals.params.id);
  res.json({ course });
});

coursesRouter.post('/:id/enroll', validate(idParam, 'params'), async (req, res) => {
  const course = await coursesService.enroll(currentUser(req), res.locals.params.id);
  res.status(201).json({ course });
});
