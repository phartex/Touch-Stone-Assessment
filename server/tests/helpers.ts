import bcrypt from 'bcryptjs';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { pool } from '../src/db/pool.js';
import type { Role } from '../src/lib/types.js';

export const app = createApp();

export async function resetDb() {
  await pool.query('TRUNCATE lesson_progress, enrollments, lessons, courses, users CASCADE');
}

let counter = 0;

/** Creates a user directly in the DB and returns a Supertest agent that is logged in as them. */
export async function loginAs(role: Role = 'learner') {
  counter += 1;
  const email = `${role}${counter}@test.dev`;
  const password = 'Password123';
  // Low bcrypt cost keeps tests fast; production code uses 12 rounds.
  const hash = await bcrypt.hash(password, 4);
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id`,
    [email, `${role} ${counter}`, hash, role],
  );
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email, password }).expect(200);
  return { agent, userId: rows[0]!.id, email };
}

export const validCourse = {
  title: 'Testing Course',
  description: 'A course created during automated tests.',
  category: 'Testing',
  level: 'beginner',
};

export const validLesson = (overrides: Record<string, unknown> = {}) => ({
  title: 'A test lesson',
  description: 'Lesson description',
  videoUrl: 'https://example.com/video.mp4',
  durationSeconds: 100,
  ...overrides,
});

/** Creates a published course with `lessonCount` lessons via the admin API. */
export async function createPublishedCourse(admin: request.Agent, lessonCount = 3) {
  const courseRes = await admin.post('/api/admin/courses').send(validCourse).expect(201);
  const courseId: string = courseRes.body.course.id;
  const lessonIds: string[] = [];
  for (let i = 1; i <= lessonCount; i++) {
    const res = await admin
      .post(`/api/admin/courses/${courseId}/lessons`)
      .send(validLesson({ title: `Lesson ${i}` }))
      .expect(201);
    lessonIds.push(res.body.lesson.id);
  }
  await admin.patch(`/api/admin/courses/${courseId}`).send({ isPublished: true }).expect(200);
  return { courseId, lessonIds };
}
