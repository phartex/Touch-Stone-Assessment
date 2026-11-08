import { withTransaction } from '../../db/pool.js';
import { AppError, badRequest, notFound } from '../../lib/errors.js';
import type { AuthUser } from '../../lib/types.js';
import { coursesRepository } from '../courses/courses.repository.js';
import { progressPercent } from '../progress/progress.logic.js';
import { lessonsRepository } from './lessons.repository.js';
import type { CreateLessonInput, ReorderLessonsInput, UpdateLessonInput } from './lessons.schemas.js';

export const notEnrolled = (courseId: string) =>
  new AppError(403, 'NOT_ENROLLED', 'Enroll in this course to watch its lessons', { courseId });

export const lessonsService = {
  /**
   * Everything the lesson player page needs in one request: the lesson (with video URL), the
   * learner's resume position, sibling lessons with status, and prev/next navigation.
   */
  async getLessonView(user: AuthUser, lessonId: string) {
    const lesson = await lessonsRepository.findWithCourse(lessonId);
    if (!lesson || (!lesson.courseIsPublished && user.role !== 'admin')) throw notFound('Lesson');

    const enrolled = await coursesRepository.isEnrolled(user.id, lesson.courseId);
    // Admins can preview any lesson without enrolling; learners must enroll first.
    if (!enrolled && user.role !== 'admin') throw notEnrolled(lesson.courseId);

    const lessons = await coursesRepository.listLessonsWithProgress(user.id, lesson.courseId);
    const index = lessons.findIndex((l) => l.id === lesson.id);
    const current = lessons[index]!;
    const completedLessons = lessons.filter((l) => l.completed).length;

    return {
      lesson: {
        id: lesson.id,
        courseId: lesson.courseId,
        title: lesson.title,
        description: lesson.description,
        videoUrl: lesson.videoUrl,
        durationSeconds: lesson.durationSeconds,
        position: lesson.position,
        completed: current.completed,
        lastPositionSeconds: current.lastPositionSeconds,
      },
      course: {
        id: lesson.courseId,
        title: lesson.courseTitle,
        category: lesson.courseCategory,
        lessonCount: lessons.length,
        completedLessons,
        progressPercent: progressPercent(completedLessons, lessons.length),
      },
      enrolled,
      lessons,
      prevLessonId: lessons[index - 1]?.id ?? null,
      nextLessonId: lessons[index + 1]?.id ?? null,
    };
  },

  // ----- Admin -----

  async listForCourse(courseId: string) {
    const course = await coursesRepository.findById(courseId);
    if (!course) throw notFound('Course');
    return lessonsRepository.listByCourse(courseId);
  },

  create(courseId: string, input: CreateLessonInput) {
    return withTransaction(async (client) => {
      if (!(await lessonsRepository.lockCourse(courseId, client))) throw notFound('Course');
      const existing = await lessonsRepository.listByCourse(courseId, client);
      // Positions are always contiguous 1..n; clamp requested position into range.
      const position = Math.min(input.position ?? existing.length + 1, existing.length + 1);
      await lessonsRepository.deferPositionConstraint(client);
      await lessonsRepository.shiftPositions(courseId, position, 1, client);
      return lessonsRepository.insert(courseId, { ...input, position }, client);
    });
  },

  async update(lessonId: string, input: UpdateLessonInput) {
    const lesson = await lessonsRepository.update(lessonId, input);
    if (!lesson) throw notFound('Lesson');
    return lesson;
  },

  remove(lessonId: string) {
    return withTransaction(async (client) => {
      const lesson = await lessonsRepository.findWithCourse(lessonId, client);
      if (!lesson) throw notFound('Lesson');
      await lessonsRepository.lockCourse(lesson.courseId, client);
      const remaining = await lessonsRepository.listByCourse(lesson.courseId, client);
      if (lesson.courseIsPublished && remaining.length === 1) {
        throw badRequest('A published course must keep at least one lesson. Unpublish it first.');
      }
      const deleted = await lessonsRepository.remove(lessonId, client);
      if (!deleted) throw notFound('Lesson');
      await lessonsRepository.deferPositionConstraint(client);
      await lessonsRepository.shiftPositions(lesson.courseId, deleted.position + 1, -1, client);
    });
  },

  reorder(courseId: string, input: ReorderLessonsInput) {
    return withTransaction(async (client) => {
      if (!(await lessonsRepository.lockCourse(courseId, client))) throw notFound('Course');
      const existing = await lessonsRepository.listByCourse(courseId, client);
      const existingIds = new Set(existing.map((l) => l.id));
      const requested = new Set(input.lessonIds);
      const sameSet =
        requested.size === input.lessonIds.length &&
        requested.size === existingIds.size &&
        input.lessonIds.every((id) => existingIds.has(id));
      if (!sameSet) throw badRequest('lessonIds must list every lesson in the course exactly once');
      await lessonsRepository.deferPositionConstraint(client);
      await lessonsRepository.applyOrder(courseId, input.lessonIds, client);
      return lessonsRepository.listByCourse(courseId, client);
    });
  },
};
