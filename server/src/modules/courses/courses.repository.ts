import { query, queryOne, type Queryable, pool } from '../../db/pool.js';
import type { CourseRecord, LessonWithProgress } from './courses.types.js';
import type { CatalogQuery, CreateCourseInput, UpdateCourseInput } from './courses.schemas.js';

export const COURSE_COLUMNS = `
  c.id, c.title, c.description, c.category, c.level,
  c.thumbnail_url AS "thumbnailUrl", c.is_published AS "isPublished",
  c.created_at AS "createdAt", c.updated_at AS "updatedAt"`;

export interface CourseSummaryRow extends CourseRecord {
  lessonCount: number;
  totalDurationSeconds: number;
  enrolled: boolean;
  completedLessons: number;
  enrolledAt: string | null;
  completedAt: string | null;
}

/**
 * Course row + aggregate lesson stats + the given user's enrollment and completed-lesson count.
 * `$1` must be the user id.
 */
const SUMMARY_SELECT = `
  SELECT ${COURSE_COLUMNS},
    COALESCE(ls.lesson_count, 0)    AS "lessonCount",
    COALESCE(ls.total_duration, 0)  AS "totalDurationSeconds",
    (e.user_id IS NOT NULL)         AS "enrolled",
    e.enrolled_at                   AS "enrolledAt",
    e.completed_at                  AS "completedAt",
    COALESCE(p.completed_count, 0)  AS "completedLessons"
  FROM courses c
  LEFT JOIN LATERAL (
    SELECT count(*) AS lesson_count, sum(duration_seconds) AS total_duration
    FROM lessons WHERE course_id = c.id
  ) ls ON true
  LEFT JOIN enrollments e ON e.course_id = c.id AND e.user_id = $1
  LEFT JOIN LATERAL (
    SELECT count(*) AS completed_count
    FROM lesson_progress lp JOIN lessons l ON l.id = lp.lesson_id
    WHERE l.course_id = c.id AND lp.user_id = $1 AND lp.completed
  ) p ON true`;

export const coursesRepository = {
  listPublished(userId: string, filters: CatalogQuery) {
    return query<CourseSummaryRow>(
      `${SUMMARY_SELECT}
       WHERE c.is_published
         AND ($2::text IS NULL OR c.title ILIKE '%' || $2 || '%' OR c.description ILIKE '%' || $2 || '%')
         AND ($3::text IS NULL OR lower(c.category) = lower($3))
       ORDER BY c.created_at DESC
       LIMIT 200`,
      [userId, filters.search ?? null, filters.category ?? null],
    );
  },

  listEnrolled(userId: string) {
    return query<CourseSummaryRow & { lastActivityAt: string | null }>(
      `SELECT * FROM (${SUMMARY_SELECT} WHERE e.user_id IS NOT NULL) s
       LEFT JOIN LATERAL (
         SELECT max(lp.updated_at) AS "lastActivityAt"
         FROM lesson_progress lp JOIN lessons l ON l.id = lp.lesson_id
         WHERE l.course_id = s.id AND lp.user_id = $1
       ) a ON true
       ORDER BY COALESCE(a."lastActivityAt", s."enrolledAt") DESC`,
      [userId],
    );
  },

  findSummary(userId: string, courseId: string) {
    return queryOne<CourseSummaryRow>(`${SUMMARY_SELECT} WHERE c.id = $2`, [userId, courseId]);
  },

  findById(courseId: string, client: Queryable = pool) {
    return queryOne<CourseRecord>(`SELECT ${COURSE_COLUMNS} FROM courses c WHERE c.id = $1`, [courseId], client);
  },

  listLessonsWithProgress(userId: string, courseId: string) {
    return query<LessonWithProgress>(
      `SELECT l.id, l.course_id AS "courseId", l.title, l.description,
              l.duration_seconds AS "durationSeconds", l.position,
              COALESCE(lp.completed, false) AS completed,
              COALESCE(lp.last_position_seconds, 0) AS "lastPositionSeconds"
       FROM lessons l
       LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = $1
       WHERE l.course_id = $2
       ORDER BY l.position`,
      [userId, courseId],
    );
  },

  async listCategories() {
    const rows = await query<{ category: string }>(
      `SELECT DISTINCT category FROM courses WHERE is_published ORDER BY category`,
    );
    return rows.map((r) => r.category);
  },

  async create(input: CreateCourseInput, createdBy: string) {
    const rows = await query<{ id: string }>(
      `INSERT INTO courses (title, description, category, level, thumbnail_url, is_published, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [input.title, input.description, input.category, input.level, input.thumbnailUrl, input.isPublished, createdBy],
    );
    return rows[0]!.id;
  },

  async update(courseId: string, input: UpdateCourseInput) {
    const columns: Record<keyof UpdateCourseInput, string> = {
      title: 'title',
      description: 'description',
      category: 'category',
      level: 'level',
      thumbnailUrl: 'thumbnail_url',
      isPublished: 'is_published',
    };
    const sets: string[] = [];
    const values: unknown[] = [];
    // Column names come from the fixed map above, never from user input.
    for (const [key, column] of Object.entries(columns) as [keyof UpdateCourseInput, string][]) {
      if (input[key] !== undefined) {
        values.push(input[key]);
        sets.push(`${column} = $${values.length}`);
      }
    }
    values.push(courseId);
    const row = await queryOne<{ id: string }>(
      `UPDATE courses SET ${sets.join(', ')}, updated_at = now() WHERE id = $${values.length} RETURNING id`,
      values,
    );
    return row !== null;
  },

  async remove(courseId: string) {
    const rows = await query<{ id: string }>(`DELETE FROM courses WHERE id = $1 RETURNING id`, [courseId]);
    return rows.length > 0;
  },

  async countLessons(courseId: string) {
    const row = await queryOne<{ count: number }>(`SELECT count(*) AS count FROM lessons WHERE course_id = $1`, [
      courseId,
    ]);
    return row?.count ?? 0;
  },

  async isEnrolled(userId: string, courseId: string, client: Queryable = pool) {
    const row = await queryOne(
      `SELECT 1 FROM enrollments WHERE user_id = $1 AND course_id = $2`,
      [userId, courseId],
      client,
    );
    return row !== null;
  },

  async enroll(userId: string, courseId: string) {
    await query(
      `INSERT INTO enrollments (user_id, course_id) VALUES ($1, $2) ON CONFLICT (user_id, course_id) DO NOTHING`,
      [userId, courseId],
    );
  },
};
