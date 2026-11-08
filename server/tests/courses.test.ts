import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool.js';
import { app, createPublishedCourse, loginAs, resetDb, validCourse, validLesson } from './helpers.js';

beforeEach(resetDb);
afterAll(() => pool.end());

describe('role-based access to admin endpoints', () => {
  it('returns 401 for anonymous users and 403 for learners', async () => {
    await request(app).post('/api/admin/courses').send(validCourse).expect(401);
    const { agent: learner } = await loginAs('learner');
    await learner.post('/api/admin/courses').send(validCourse).expect(403);
    await learner.get('/api/admin/dashboard').expect(403);
  });
});

describe('admin course CRUD', () => {
  it('creates, updates and deletes a course', async () => {
    const { agent: admin } = await loginAs('admin');
    const created = await admin.post('/api/admin/courses').send(validCourse).expect(201);
    expect(created.body.course).toMatchObject({ title: 'Testing Course', isPublished: false });
    const id = created.body.course.id;

    const updated = await admin.patch(`/api/admin/courses/${id}`).send({ title: 'Renamed course' }).expect(200);
    expect(updated.body.course.title).toBe('Renamed course');

    await admin.delete(`/api/admin/courses/${id}`).expect(204);
    await admin.get(`/api/admin/courses/${id}`).expect(404);
  });

  it('validates input and rejects unknown ids gracefully', async () => {
    const { agent: admin } = await loginAs('admin');
    const res = await admin
      .post('/api/admin/courses')
      .send({ title: 'x', description: 'short', category: '', level: 'expert', thumbnailUrl: 'javascript:alert(1)' })
      .expect(400);
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['title', 'description', 'category', 'level', 'thumbnailUrl']));

    await admin.patch('/api/admin/courses/not-a-uuid').send({ title: 'Valid title' }).expect(400);
    await admin.patch('/api/admin/courses/00000000-0000-4000-8000-000000000000').send({ title: 'Valid' }).expect(404);
    await admin.patch(`/api/admin/courses/00000000-0000-4000-8000-000000000000`).send({}).expect(400);
  });

  it('refuses to publish a course with no lessons', async () => {
    const { agent: admin } = await loginAs('admin');
    const { body } = await admin.post('/api/admin/courses').send(validCourse).expect(201);
    const res = await admin.patch(`/api/admin/courses/${body.course.id}`).send({ isPublished: true }).expect(400);
    expect(res.body.error.message).toMatch(/at least one lesson/);
  });
});

describe('catalog and enrollment', () => {
  it('hides draft courses from learners but not from admins', async () => {
    const { agent: admin } = await loginAs('admin');
    const { courseId } = await createPublishedCourse(admin, 1);
    const draft = await admin.post('/api/admin/courses').send({ ...validCourse, title: 'Draft course' }).expect(201);

    const { agent: learner } = await loginAs('learner');
    const catalog = await learner.get('/api/courses').expect(200);
    expect(catalog.body.courses.map((c: { id: string }) => c.id)).toEqual([courseId]);
    await learner.get(`/api/courses/${draft.body.course.id}`).expect(404);
    await learner.post(`/api/courses/${draft.body.course.id}/enroll`).expect(404);
    await admin.get(`/api/courses/${draft.body.course.id}`).expect(200);
  });

  it('supports search and category filters', async () => {
    const { agent: admin } = await loginAs('admin');
    await createPublishedCourse(admin, 1);
    const { agent: learnerAgent } = await loginAs('learner');
    expect((await learnerAgent.get('/api/courses?search=testing').expect(200)).body.courses).toHaveLength(1);
    expect((await learnerAgent.get('/api/courses?search=nomatch').expect(200)).body.courses).toHaveLength(0);
    expect((await learnerAgent.get('/api/courses?category=testing').expect(200)).body.courses).toHaveLength(1);
  });

  it('enrolls idempotently and reports aggregate course data', async () => {
    const { agent: admin } = await loginAs('admin');
    const { courseId } = await createPublishedCourse(admin, 3);
    const { agent: learner } = await loginAs('learner');

    const before = await learner.get(`/api/courses/${courseId}`).expect(200);
    expect(before.body.course).toMatchObject({ enrolled: false, lessonCount: 3, totalDurationSeconds: 300 });

    await learner.post(`/api/courses/${courseId}/enroll`).expect(201);
    const again = await learner.post(`/api/courses/${courseId}/enroll`).expect(201);
    expect(again.body.course).toMatchObject({ enrolled: true, progressPercent: 0 });
    expect(again.body.course.nextLessonId).toBe(again.body.course.lessons[0].id);
  });
});

describe('lesson management', () => {
  it('inserts at a position, reorders and compacts positions on delete', async () => {
    const { agent: admin } = await loginAs('admin');
    const { courseId, lessonIds } = await createPublishedCourse(admin, 3);
    const [l1, l2, l3] = lessonIds as [string, string, string];

    const inserted = await admin
      .post(`/api/admin/courses/${courseId}/lessons`)
      .send(validLesson({ title: 'Inserted lesson', position: 1 }))
      .expect(201);
    const l0 = inserted.body.lesson.id as string;

    let detail = await admin.get(`/api/admin/courses/${courseId}`).expect(200);
    expect(detail.body.lessons.map((l: { id: string }) => l.id)).toEqual([l0, l1, l2, l3]);

    await admin
      .put(`/api/admin/courses/${courseId}/lessons/order`)
      .send({ lessonIds: [l3, l2, l1, l0] })
      .expect(200);
    await admin.delete(`/api/admin/lessons/${l2}`).expect(204);

    detail = await admin.get(`/api/admin/courses/${courseId}`).expect(200);
    expect(detail.body.lessons.map((l: { id: string; position: number }) => [l.id, l.position])).toEqual([
      [l3, 1],
      [l1, 2],
      [l0, 3],
    ]);
  });

  it('rejects a reorder that does not list every lesson exactly once', async () => {
    const { agent: admin } = await loginAs('admin');
    const { courseId, lessonIds } = await createPublishedCourse(admin, 2);
    await admin
      .put(`/api/admin/courses/${courseId}/lessons/order`)
      .send({ lessonIds: [lessonIds[0], lessonIds[0]] })
      .expect(400);
  });

  it('validates lesson input', async () => {
    const { agent: admin } = await loginAs('admin');
    const { courseId } = await createPublishedCourse(admin, 1);
    const res = await admin
      .post(`/api/admin/courses/${courseId}/lessons`)
      .send({ title: 'ok title', videoUrl: 'ftp://nope', durationSeconds: -1 })
      .expect(400);
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['videoUrl', 'durationSeconds']));
  });

  it('prevents deleting the last lesson of a published course', async () => {
    const { agent: admin } = await loginAs('admin');
    const { lessonIds } = await createPublishedCourse(admin, 1);
    await admin.delete(`/api/admin/lessons/${lessonIds[0]}`).expect(400);
  });
});
