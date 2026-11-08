import { Router } from 'express';
import { notFound } from '../../lib/errors.js';
import { currentUser, requireAuth, requireRole } from '../../middleware/auth.js';
import { idParam, validate } from '../../middleware/validate.js';
import { coursesRepository } from '../courses/courses.repository.js';
import { coursesService } from '../courses/courses.service.js';
import {
  createCourseSchema,
  updateCourseSchema,
  type CreateCourseInput,
  type UpdateCourseInput,
} from '../courses/courses.schemas.js';
import { lessonsService } from '../lessons/lessons.service.js';
import {
  createLessonSchema,
  reorderLessonsSchema,
  updateLessonSchema,
  type CreateLessonInput,
  type ReorderLessonsInput,
  type UpdateLessonInput,
} from '../lessons/lessons.schemas.js';
import { adminRepository } from './admin.repository.js';

export const adminRouter = Router();
// Every admin route requires an authenticated admin.
adminRouter.use(requireAuth, requireRole('admin'));

// ----- Reporting -----

adminRouter.get('/dashboard', async (_req, res) => {
  const [totals, courses, recentActivity] = await Promise.all([
    adminRepository.totals(),
    adminRepository.courseStats(),
    adminRepository.recentActivity(),
  ]);
  const enrollments = totals?.enrollments ?? 0;
  res.json({
    totals: {
      ...totals,
      completionRatePercent: enrollments ? Math.round(((totals?.completedEnrollments ?? 0) / enrollments) * 100) : 0,
    },
    courses,
    recentActivity,
  });
});

adminRouter.get('/learners', async (_req, res) => {
  res.json({ learners: await adminRepository.learners() });
});

// ----- Courses -----

adminRouter.get('/courses', async (_req, res) => {
  res.json({ courses: await adminRepository.courseStats() });
});

adminRouter.post('/courses', validate(createCourseSchema), async (req, res) => {
  const course = await coursesService.create(currentUser(req), res.locals.body as CreateCourseInput);
  res.status(201).json({ course });
});

adminRouter.get('/courses/:id', validate(idParam, 'params'), async (req, res) => {
  const course = await coursesRepository.findById(res.locals.params.id);
  if (!course) throw notFound('Course');
  const lessons = await lessonsService.listForCourse(course.id);
  res.json({ course, lessons });
});

adminRouter.patch('/courses/:id', validate(idParam, 'params'), validate(updateCourseSchema), async (_req, res) => {
  const course = await coursesService.update(res.locals.params.id, res.locals.body as UpdateCourseInput);
  res.json({ course });
});

adminRouter.delete('/courses/:id', validate(idParam, 'params'), async (_req, res) => {
  await coursesService.remove(res.locals.params.id);
  res.status(204).end();
});

adminRouter.get('/courses/:id/learners', validate(idParam, 'params'), async (_req, res) => {
  const course = await coursesRepository.findById(res.locals.params.id);
  if (!course) throw notFound('Course');
  res.json({ learners: await adminRepository.courseLearners(course.id) });
});

// ----- Lessons -----

adminRouter.post(
  '/courses/:id/lessons',
  validate(idParam, 'params'),
  validate(createLessonSchema),
  async (_req, res) => {
    const lesson = await lessonsService.create(res.locals.params.id, res.locals.body as CreateLessonInput);
    res.status(201).json({ lesson });
  },
);

adminRouter.put(
  '/courses/:id/lessons/order',
  validate(idParam, 'params'),
  validate(reorderLessonsSchema),
  async (_req, res) => {
    const lessons = await lessonsService.reorder(res.locals.params.id, res.locals.body as ReorderLessonsInput);
    res.json({ lessons });
  },
);

adminRouter.patch('/lessons/:id', validate(idParam, 'params'), validate(updateLessonSchema), async (_req, res) => {
  const lesson = await lessonsService.update(res.locals.params.id, res.locals.body as UpdateLessonInput);
  res.json({ lesson });
});

adminRouter.delete('/lessons/:id', validate(idParam, 'params'), async (_req, res) => {
  await lessonsService.remove(res.locals.params.id);
  res.status(204).end();
});
