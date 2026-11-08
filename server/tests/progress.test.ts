import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool.js';
import { createPublishedCourse, loginAs, resetDb } from './helpers.js';

beforeEach(resetDb);
afterAll(() => pool.end());

async function setup(lessonCount = 2) {
  const { agent: admin } = await loginAs('admin');
  const course = await createPublishedCourse(admin, lessonCount);
  const learner = await loginAs('learner');
  return { admin, learner: learner.agent, learnerId: learner.userId, ...course };
}

describe('lesson access', () => {
  it('requires enrollment to open a lesson or save progress', async () => {
    const { learner, lessonIds } = await setup();
    const res = await learner.get(`/api/lessons/${lessonIds[0]}`).expect(403);
    expect(res.body.error.code).toBe('NOT_ENROLLED');
    await learner.put(`/api/lessons/${lessonIds[0]}/progress`).send({ positionSeconds: 5 }).expect(403);
  });

  it('lets admins preview lessons without enrolling', async () => {
    const { admin, lessonIds } = await setup();
    const res = await admin.get(`/api/lessons/${lessonIds[0]}`).expect(200);
    expect(res.body.enrolled).toBe(false);
  });

  it('returns the lesson with video, siblings and navigation once enrolled', async () => {
    const { learner, courseId, lessonIds } = await setup(3);
    await learner.post(`/api/courses/${courseId}/enroll`).expect(201);
    const res = await learner.get(`/api/lessons/${lessonIds[1]}`).expect(200);
    expect(res.body.lesson).toMatchObject({ id: lessonIds[1], videoUrl: 'https://example.com/video.mp4' });
    expect(res.body.lessons).toHaveLength(3);
    expect(res.body.prevLessonId).toBe(lessonIds[0]);
    expect(res.body.nextLessonId).toBe(lessonIds[2]);
  });
});

describe('progress tracking', () => {
  it('saves the resume position and returns it on the next visit', async () => {
    const { learner, courseId, lessonIds } = await setup();
    await learner.post(`/api/courses/${courseId}/enroll`).expect(201);

    const saved = await learner.put(`/api/lessons/${lessonIds[0]}/progress`).send({ positionSeconds: 42.5 }).expect(200);
    expect(saved.body.progress).toMatchObject({ lastPositionSeconds: 42.5, completed: false });

    const view = await learner.get(`/api/lessons/${lessonIds[0]}`).expect(200);
    expect(view.body.lesson.lastPositionSeconds).toBe(42.5);
  });

  it('completes a lesson at the end, keeps it completed on replay, and rolls up to the course', async () => {
    const { learner, courseId, lessonIds, learnerId } = await setup(2);
    await learner.post(`/api/courses/${courseId}/enroll`).expect(201);
    const [first, second] = lessonIds as [string, string];

    const done = await learner.put(`/api/lessons/${first}/progress`).send({ positionSeconds: 99, ended: true }).expect(200);
    expect(done.body).toMatchObject({ justCompleted: true, course: { completedLessons: 1, progressPercent: 50 } });

    // Replaying from the start must not un-complete the lesson.
    const replay = await learner.put(`/api/lessons/${first}/progress`).send({ positionSeconds: 2 }).expect(200);
    expect(replay.body).toMatchObject({ justCompleted: false, progress: { completed: true, lastPositionSeconds: 2 } });

    // Reaching 95% of the second lesson completes the course.
    const last = await learner.put(`/api/lessons/${second}/progress`).send({ positionSeconds: 96 }).expect(200);
    expect(last.body.course).toMatchObject({ completedLessons: 2, progressPercent: 100, completed: true });

    const { rows } = await pool.query('SELECT completed_at FROM enrollments WHERE user_id = $1', [learnerId]);
    expect(rows[0].completed_at).not.toBeNull();

    const course = await learner.get(`/api/courses/${courseId}`).expect(200);
    expect(course.body.course).toMatchObject({ progressPercent: 100, completedLessons: 2 });
  });

  it('rejects invalid progress payloads', async () => {
    const { learner, courseId, lessonIds } = await setup();
    await learner.post(`/api/courses/${courseId}/enroll`).expect(201);
    await learner.put(`/api/lessons/${lessonIds[0]}/progress`).send({ positionSeconds: -1 }).expect(400);
    await learner.put(`/api/lessons/${lessonIds[0]}/progress`).send({ positionSeconds: 'abc' }).expect(400);
  });
});

describe('dashboards', () => {
  it('summarises learner progress', async () => {
    const { learner, courseId, lessonIds } = await setup(2);
    await learner.post(`/api/courses/${courseId}/enroll`).expect(201);
    await learner.put(`/api/lessons/${lessonIds[0]}/progress`).send({ positionSeconds: 100, ended: true });
    await learner.put(`/api/lessons/${lessonIds[1]}/progress`).send({ positionSeconds: 30 });

    const res = await learner.get('/api/me/dashboard').expect(200);
    expect(res.body.stats).toMatchObject({
      enrolledCourses: 1,
      inProgressCourses: 1,
      completedCourses: 0,
      completedLessons: 1,
    });
    expect(res.body.continueWatching).toHaveLength(1);
    expect(res.body.continueWatching[0]).toMatchObject({ lessonId: lessonIds[1], lastPositionSeconds: 30 });
    expect(res.body.courses[0]).toMatchObject({ id: courseId, progressPercent: 50 });
  });

  it('gives admins course-level and learner-level activity', async () => {
    const { admin, learner, courseId, lessonIds } = await setup(2);
    await learner.post(`/api/courses/${courseId}/enroll`).expect(201);
    await learner.put(`/api/lessons/${lessonIds[0]}/progress`).send({ positionSeconds: 100, ended: true });

    const dash = await admin.get('/api/admin/dashboard').expect(200);
    expect(dash.body.totals).toMatchObject({ learners: 1, enrollments: 1, activeLearners7d: 1 });
    expect(dash.body.courses[0]).toMatchObject({ id: courseId, enrollmentCount: 1, avgProgressPercent: 50 });
    expect(dash.body.recentActivity[0]).toMatchObject({ lessonId: lessonIds[0], completed: true });

    const learners = await admin.get(`/api/admin/courses/${courseId}/learners`).expect(200);
    expect(learners.body.learners[0]).toMatchObject({ completedLessons: 1, lessonCount: 2, progressPercent: 50 });
  });
});
