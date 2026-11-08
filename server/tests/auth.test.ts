import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../src/db/pool.js';
import { app, loginAs, resetDb } from './helpers.js';

beforeEach(resetDb);
afterAll(() => pool.end());

const newUser = { name: 'New Learner', email: 'New.Learner@Example.com', password: 'Secret123' };

describe('POST /api/auth/register', () => {
  it('creates a learner, never exposes the password hash, and sets an httpOnly session cookie', async () => {
    const res = await request(app).post('/api/auth/register').send(newUser).expect(201);
    expect(res.body.user).toMatchObject({ name: 'New Learner', email: 'new.learner@example.com', role: 'learner' });
    expect(res.body.user).not.toHaveProperty('password_hash');
    const cookie = res.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toMatch(/^ts_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it('ignores attempts to self-assign the admin role', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...newUser, role: 'admin' })
      .expect(201);
    expect(res.body.user.role).toBe('learner');
  });

  it('rejects duplicate emails case-insensitively', async () => {
    await request(app).post('/api/auth/register').send(newUser).expect(201);
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...newUser, email: 'NEW.learner@example.com' })
      .expect(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('returns field-level validation errors for weak passwords and bad emails', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: '', email: 'not-an-email', password: 'short' })
      .expect(400);
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });
});

describe('login, session and logout', () => {
  it('rejects wrong credentials with a generic message', async () => {
    await request(app).post('/api/auth/register').send(newUser).expect(201);
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: newUser.email, password: 'Wrong1234' })
      .expect(401);
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'Wrong1234' })
      .expect(401);
    expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message);
  });

  it('returns the current user for a valid session and 401 without one', async () => {
    await request(app).get('/api/auth/me').expect(401);
    const { agent, email } = await loginAs('learner');
    const res = await agent.get('/api/auth/me').expect(200);
    expect(res.body.user.email).toBe(email);
  });

  it('rejects a tampered token', async () => {
    await request(app).get('/api/auth/me').set('Cookie', 'ts_session=not.a.jwt').expect(401);
  });

  it('logout clears the session', async () => {
    const { agent } = await loginAs('learner');
    await agent.post('/api/auth/logout').expect(204);
    await agent.get('/api/auth/me').expect(401);
  });

  it('invalidates sessions for deleted users immediately', async () => {
    const { agent, userId } = await loginAs('learner');
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    await agent.get('/api/auth/me').expect(401);
  });
});
