import { query, queryOne } from '../../db/pool.js';
import type { AuthUser } from '../../lib/types.js';
import { coursesRepository } from '../courses/courses.repository.js';
import { toSummary } from '../courses/courses.service.js';

export interface ContinueWatchingItem {
  lessonId: string;
  lessonTitle: string;
  courseId: string;
  courseTitle: string;
  thumbnailUrl: string | null;
  lastPositionSeconds: number;
  durationSeconds: number;
  updatedAt: string;
}

export const dashboardService = {
  async learnerDashboard(user: AuthUser) {
    const [enrolledRows, totals, continueWatching] = await Promise.all([
      coursesRepository.listEnrolled(user.id),
      queryOne<{ completedLessons: number; secondsWatched: number }>(
        `SELECT count(*) FILTER (WHERE lp.completed) AS "completedLessons",
                COALESCE(sum(CASE WHEN lp.completed THEN l.duration_seconds
                                  ELSE lp.last_position_seconds END), 0)::int AS "secondsWatched"
         FROM lesson_progress lp JOIN lessons l ON l.id = lp.lesson_id
         WHERE lp.user_id = $1`,
        [user.id],
      ),
      query<ContinueWatchingItem>(
        `SELECT l.id AS "lessonId", l.title AS "lessonTitle", c.id AS "courseId", c.title AS "courseTitle",
                c.thumbnail_url AS "thumbnailUrl", lp.last_position_seconds AS "lastPositionSeconds",
                l.duration_seconds AS "durationSeconds", lp.updated_at AS "updatedAt"
         FROM lesson_progress lp
         JOIN lessons l ON l.id = lp.lesson_id
         JOIN courses c ON c.id = l.course_id
         JOIN enrollments e ON e.course_id = c.id AND e.user_id = lp.user_id
         WHERE lp.user_id = $1 AND NOT lp.completed AND lp.last_position_seconds > 0 AND c.is_published
         ORDER BY lp.updated_at DESC
         LIMIT 4`,
        [user.id],
      ),
    ]);

    const courses = enrolledRows.map((row) => ({
      ...toSummary(row),
      enrolledAt: row.enrolledAt,
      completedAt: row.completedAt,
      lastActivityAt: row.lastActivityAt,
    }));
    const completedCourses = courses.filter((c) => c.lessonCount > 0 && c.completedLessons === c.lessonCount);
    const inProgress = courses.filter((c) => c.completedLessons < c.lessonCount && c.lastActivityAt !== null);

    return {
      stats: {
        enrolledCourses: courses.length,
        inProgressCourses: inProgress.length,
        completedCourses: completedCourses.length,
        completedLessons: totals?.completedLessons ?? 0,
        minutesWatched: Math.round((totals?.secondsWatched ?? 0) / 60),
      },
      continueWatching,
      courses,
    };
  },
};
