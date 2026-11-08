import { pool, query, queryOne, type Queryable } from '../../db/pool.js';
import type { CreateLessonInput, UpdateLessonInput } from './lessons.schemas.js';

export interface LessonRecord {
  id: string;
  courseId: string;
  title: string;
  description: string;
  videoUrl: string;
  durationSeconds: number;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface LessonWithCourse extends LessonRecord {
  courseTitle: string;
  courseCategory: string;
  courseIsPublished: boolean;
}

const LESSON_COLUMNS = `
  l.id, l.course_id AS "courseId", l.title, l.description, l.video_url AS "videoUrl",
  l.duration_seconds AS "durationSeconds", l.position,
  l.created_at AS "createdAt", l.updated_at AS "updatedAt"`;

export const lessonsRepository = {
  findWithCourse(lessonId: string, client: Queryable = pool) {
    return queryOne<LessonWithCourse>(
      `SELECT ${LESSON_COLUMNS}, c.title AS "courseTitle", c.category AS "courseCategory",
              c.is_published AS "courseIsPublished"
       FROM lessons l JOIN courses c ON c.id = l.course_id
       WHERE l.id = $1`,
      [lessonId],
      client,
    );
  },

  listByCourse(courseId: string, client: Queryable = pool) {
    return query<LessonRecord>(
      `SELECT ${LESSON_COLUMNS} FROM lessons l WHERE l.course_id = $1 ORDER BY l.position`,
      [courseId],
      client,
    );
  },

  /** Locks the parent course row so concurrent position changes in one course are serialized. */
  async lockCourse(courseId: string, client: Queryable) {
    const row = await queryOne(`SELECT id FROM courses WHERE id = $1 FOR UPDATE`, [courseId], client);
    return row !== null;
  },

  async deferPositionConstraint(client: Queryable) {
    await client.query('SET CONSTRAINTS lessons_course_position_key DEFERRED');
  },

  async shiftPositions(courseId: string, fromPosition: number, delta: 1 | -1, client: Queryable) {
    await client.query(
      `UPDATE lessons SET position = position + $3 WHERE course_id = $1 AND position >= $2`,
      [courseId, fromPosition, delta],
    );
  },

  async insert(courseId: string, input: CreateLessonInput & { position: number }, client: Queryable) {
    const rows = await query<LessonRecord>(
      `INSERT INTO lessons AS l (course_id, title, description, video_url, duration_seconds, position)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${LESSON_COLUMNS}`,
      [courseId, input.title, input.description, input.videoUrl, input.durationSeconds, input.position],
      client,
    );
    return rows[0]!;
  },

  async update(lessonId: string, input: UpdateLessonInput) {
    const columns: Record<keyof UpdateLessonInput, string> = {
      title: 'title',
      description: 'description',
      videoUrl: 'video_url',
      durationSeconds: 'duration_seconds',
    };
    const sets: string[] = [];
    const values: unknown[] = [];
    // Column names come from the fixed map above, never from user input.
    for (const [key, column] of Object.entries(columns) as [keyof UpdateLessonInput, string][]) {
      if (input[key] !== undefined) {
        values.push(input[key]);
        sets.push(`${column} = $${values.length}`);
      }
    }
    values.push(lessonId);
    return queryOne<LessonRecord>(
      `UPDATE lessons AS l SET ${sets.join(', ')}, updated_at = now()
       WHERE l.id = $${values.length}
       RETURNING ${LESSON_COLUMNS}`,
      values,
    );
  },

  async remove(lessonId: string, client: Queryable) {
    return queryOne<{ position: number }>(`DELETE FROM lessons WHERE id = $1 RETURNING position`, [lessonId], client);
  },

  /** Assigns positions 1..n following the order of `lessonIds`. */
  async applyOrder(courseId: string, lessonIds: string[], client: Queryable) {
    await client.query(
      `UPDATE lessons l SET position = o.ord, updated_at = now()
       FROM unnest($2::uuid[]) WITH ORDINALITY AS o(id, ord)
       WHERE l.id = o.id AND l.course_id = $1`,
      [courseId, lessonIds],
    );
  },
};
