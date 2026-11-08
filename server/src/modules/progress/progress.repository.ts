import { queryOne, type Queryable } from '../../db/pool.js';

export interface LessonProgressRecord {
  lessonId: string;
  lastPositionSeconds: number;
  completed: boolean;
  completedAt: string | null;
  updatedAt: string;
}

const PROGRESS_COLUMNS = `
  lesson_id AS "lessonId", last_position_seconds AS "lastPositionSeconds",
  completed, completed_at AS "completedAt", updated_at AS "updatedAt"`;

export const progressRepository = {
  findForUpdate(userId: string, lessonId: string, client: Queryable) {
    return queryOne<LessonProgressRecord>(
      `SELECT ${PROGRESS_COLUMNS} FROM lesson_progress WHERE user_id = $1 AND lesson_id = $2 FOR UPDATE`,
      [userId, lessonId],
      client,
    );
  },

  /**
   * Insert or update progress. Completion is merged with OR so a concurrent/stale write can never
   * flip a completed lesson back to incomplete, and the first completion timestamp is preserved.
   */
  async upsert(
    userId: string,
    lessonId: string,
    values: { positionSeconds: number; completed: boolean },
    client: Queryable,
  ) {
    const row = await queryOne<LessonProgressRecord>(
      `INSERT INTO lesson_progress (user_id, lesson_id, last_position_seconds, completed, completed_at)
       VALUES ($1, $2, $3, $4, CASE WHEN $4 THEN now() END)
       ON CONFLICT (user_id, lesson_id) DO UPDATE SET
         last_position_seconds = EXCLUDED.last_position_seconds,
         completed    = lesson_progress.completed OR EXCLUDED.completed,
         completed_at = COALESCE(lesson_progress.completed_at, EXCLUDED.completed_at),
         updated_at   = now()
       RETURNING ${PROGRESS_COLUMNS}`,
      [userId, lessonId, values.positionSeconds, values.completed],
      client,
    );
    return row!;
  },

  async courseCounts(userId: string, courseId: string, client: Queryable) {
    const row = await queryOne<{ lessonCount: number; completedLessons: number }>(
      `SELECT count(l.id) AS "lessonCount",
              count(lp.lesson_id) FILTER (WHERE lp.completed) AS "completedLessons"
       FROM lessons l
       LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = $1
       WHERE l.course_id = $2`,
      [userId, courseId],
      client,
    );
    return row ?? { lessonCount: 0, completedLessons: 0 };
  },

  async markCourseCompleted(userId: string, courseId: string, client: Queryable) {
    await client.query(
      `UPDATE enrollments SET completed_at = now()
       WHERE user_id = $1 AND course_id = $2 AND completed_at IS NULL`,
      [userId, courseId],
    );
  },
};
