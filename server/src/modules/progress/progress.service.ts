import { withTransaction } from '../../db/pool.js';
import { notFound } from '../../lib/errors.js';
import type { AuthUser } from '../../lib/types.js';
import { coursesRepository } from '../courses/courses.repository.js';
import { lessonsRepository } from '../lessons/lessons.repository.js';
import type { ProgressInput } from '../lessons/lessons.schemas.js';
import { notEnrolled } from '../lessons/lessons.service.js';
import { evaluateProgress, progressPercent } from './progress.logic.js';
import { progressRepository } from './progress.repository.js';

export const progressService = {
  /**
   * Record the learner's playback position for a lesson. The server decides completion (via
   * `evaluateProgress`) rather than trusting a client-sent "completed" flag, and rolls lesson
   * completion up into course completion.
   */
  saveProgress(user: AuthUser, lessonId: string, input: ProgressInput) {
    return withTransaction(async (client) => {
      const lesson = await lessonsRepository.findWithCourse(lessonId, client);
      if (!lesson || (!lesson.courseIsPublished && user.role !== 'admin')) throw notFound('Lesson');
      if (!(await coursesRepository.isEnrolled(user.id, lesson.courseId, client))) throw notEnrolled(lesson.courseId);

      const existing = await progressRepository.findForUpdate(user.id, lessonId, client);
      const result = evaluateProgress({
        durationSeconds: lesson.durationSeconds,
        reportedPositionSeconds: input.positionSeconds,
        ended: input.ended,
        previouslyCompleted: existing?.completed ?? false,
      });

      const progress = await progressRepository.upsert(user.id, lessonId, result, client);
      const counts = await progressRepository.courseCounts(user.id, lesson.courseId, client);
      const courseCompleted = counts.lessonCount > 0 && counts.completedLessons === counts.lessonCount;
      if (result.justCompleted && courseCompleted) {
        await progressRepository.markCourseCompleted(user.id, lesson.courseId, client);
      }

      return {
        progress,
        justCompleted: result.justCompleted,
        course: {
          id: lesson.courseId,
          lessonCount: counts.lessonCount,
          completedLessons: counts.completedLessons,
          progressPercent: progressPercent(counts.completedLessons, counts.lessonCount),
          completed: courseCompleted,
        },
      };
    });
  },
};
