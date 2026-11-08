import { query, queryOne } from '../../db/pool.js';

/**
 * Read-only reporting queries for the admin area. Progress per enrollment is
 * completed lessons / lessons in the course, computed in SQL so we aggregate once.
 */
const ENROLLMENT_PROGRESS = `
  SELECT e.user_id, e.course_id, e.enrolled_at, e.completed_at,
         COALESCE(lc.lesson_count, 0) AS lesson_count,
         COALESCE(pc.completed_count, 0) AS completed_count,
         pc.last_activity_at,
         CASE WHEN COALESCE(lc.lesson_count, 0) = 0 THEN 0
              ELSE round(100.0 * COALESCE(pc.completed_count, 0) / lc.lesson_count) END AS progress_percent
  FROM enrollments e
  LEFT JOIN LATERAL (SELECT count(*) AS lesson_count FROM lessons WHERE course_id = e.course_id) lc ON true
  LEFT JOIN LATERAL (
    SELECT count(*) FILTER (WHERE lp.completed) AS completed_count, max(lp.updated_at) AS last_activity_at
    FROM lesson_progress lp JOIN lessons l ON l.id = lp.lesson_id
    WHERE lp.user_id = e.user_id AND l.course_id = e.course_id
  ) pc ON true`;

export interface AdminCourseStats {
  id: string;
  title: string;
  category: string;
  level: string;
  thumbnailUrl: string | null;
  isPublished: boolean;
  lessonCount: number;
  totalDurationSeconds: number;
  enrollmentCount: number;
  completedCount: number;
  avgProgressPercent: number;
  lastActivityAt: string | null;
  updatedAt: string;
}

export const adminRepository = {
  totals() {
    return queryOne<{
      learners: number;
      courses: number;
      publishedCourses: number;
      lessons: number;
      enrollments: number;
      completedEnrollments: number;
      activeLearners7d: number;
    }>(
      `SELECT
         (SELECT count(*) FROM users WHERE role = 'learner') AS learners,
         (SELECT count(*) FROM courses) AS courses,
         (SELECT count(*) FROM courses WHERE is_published) AS "publishedCourses",
         (SELECT count(*) FROM lessons) AS lessons,
         (SELECT count(*) FROM enrollments) AS enrollments,
         (SELECT count(*) FROM enrollments WHERE completed_at IS NOT NULL) AS "completedEnrollments",
         (SELECT count(DISTINCT user_id) FROM lesson_progress
            WHERE updated_at > now() - interval '7 days') AS "activeLearners7d"`,
    );
  },

  courseStats() {
    return query<AdminCourseStats>(
      `SELECT c.id, c.title, c.category, c.level, c.thumbnail_url AS "thumbnailUrl",
              c.is_published AS "isPublished", c.updated_at AS "updatedAt",
              COALESCE(ls.lesson_count, 0) AS "lessonCount",
              COALESCE(ls.total_duration, 0) AS "totalDurationSeconds",
              COALESCE(ep.enrollment_count, 0) AS "enrollmentCount",
              COALESCE(ep.completed_count, 0) AS "completedCount",
              COALESCE(ep.avg_progress, 0)::int AS "avgProgressPercent",
              ep.last_activity_at AS "lastActivityAt"
       FROM courses c
       LEFT JOIN LATERAL (
         SELECT count(*) AS lesson_count, sum(duration_seconds) AS total_duration
         FROM lessons WHERE course_id = c.id
       ) ls ON true
       LEFT JOIN LATERAL (
         SELECT count(*) AS enrollment_count,
                count(*) FILTER (WHERE ep.lesson_count > 0 AND ep.completed_count = ep.lesson_count) AS completed_count,
                round(avg(ep.progress_percent)) AS avg_progress,
                max(ep.last_activity_at) AS last_activity_at
         FROM (${ENROLLMENT_PROGRESS}) ep WHERE ep.course_id = c.id
       ) ep ON true
       ORDER BY c.created_at DESC`,
    );
  },

  recentActivity(limit = 10) {
    return query<{
      userName: string;
      userEmail: string;
      lessonId: string;
      lessonTitle: string;
      courseId: string;
      courseTitle: string;
      completed: boolean;
      lastPositionSeconds: number;
      durationSeconds: number;
      updatedAt: string;
    }>(
      `SELECT u.name AS "userName", u.email AS "userEmail",
              l.id AS "lessonId", l.title AS "lessonTitle", c.id AS "courseId", c.title AS "courseTitle",
              lp.completed, lp.last_position_seconds AS "lastPositionSeconds",
              l.duration_seconds AS "durationSeconds", lp.updated_at AS "updatedAt"
       FROM lesson_progress lp
       JOIN users u ON u.id = lp.user_id
       JOIN lessons l ON l.id = lp.lesson_id
       JOIN courses c ON c.id = l.course_id
       ORDER BY lp.updated_at DESC
       LIMIT $1`,
      [limit],
    );
  },

  learners() {
    return query<{
      id: string;
      name: string;
      email: string;
      joinedAt: string;
      enrolledCourses: number;
      completedCourses: number;
      avgProgressPercent: number;
      lastActivityAt: string | null;
    }>(
      `SELECT u.id, u.name, u.email, u.created_at AS "joinedAt",
              count(ep.course_id) AS "enrolledCourses",
              count(ep.course_id) FILTER (WHERE ep.lesson_count > 0 AND ep.completed_count = ep.lesson_count)
                AS "completedCourses",
              COALESCE(round(avg(ep.progress_percent)), 0)::int AS "avgProgressPercent",
              max(ep.last_activity_at) AS "lastActivityAt"
       FROM users u
       LEFT JOIN (${ENROLLMENT_PROGRESS}) ep ON ep.user_id = u.id
       WHERE u.role = 'learner'
       GROUP BY u.id
       ORDER BY max(ep.last_activity_at) DESC NULLS LAST, u.created_at DESC`,
    );
  },

  courseLearners(courseId: string) {
    return query<{
      userId: string;
      name: string;
      email: string;
      enrolledAt: string;
      completedLessons: number;
      lessonCount: number;
      progressPercent: number;
      lastActivityAt: string | null;
    }>(
      `SELECT u.id AS "userId", u.name, u.email, ep.enrolled_at AS "enrolledAt",
              ep.completed_count AS "completedLessons", ep.lesson_count AS "lessonCount",
              ep.progress_percent::int AS "progressPercent", ep.last_activity_at AS "lastActivityAt"
       FROM (${ENROLLMENT_PROGRESS}) ep
       JOIN users u ON u.id = ep.user_id
       WHERE ep.course_id = $1
       ORDER BY ep.progress_percent DESC, u.name`,
      [courseId],
    );
  },
};
