import { describe, expect, it } from 'vitest';
import { validateRegistration } from '../auth/RegisterPage';
import { validateCourse, validateLesson } from './validation';

describe('validateCourse', () => {
  const valid = { title: 'React', description: 'A long enough description', category: 'Frontend', level: 'beginner' as const, thumbnailUrl: '' };

  it('accepts valid input with an optional thumbnail', () => {
    expect(validateCourse(valid)).toEqual({});
    expect(validateCourse({ ...valid, thumbnailUrl: 'https://img.example.com/a.png' })).toEqual({});
  });

  it('reports each invalid field', () => {
    const errors = validateCourse({ ...valid, title: 'ab', description: 'short', category: ' ', thumbnailUrl: 'javascript:alert(1)' });
    expect(Object.keys(errors).sort()).toEqual(['category', 'description', 'thumbnailUrl', 'title']);
  });
});

describe('validateLesson', () => {
  const valid = { title: 'Intro', description: '', videoUrl: 'https://cdn.example.com/v.mp4', durationSeconds: '90' };

  it('accepts valid input', () => {
    expect(validateLesson(valid)).toEqual({});
  });

  it('rejects non-http URLs and bad durations', () => {
    expect(validateLesson({ ...valid, videoUrl: 'ftp://x/y.mp4' }).videoUrl).toBeDefined();
    expect(validateLesson({ ...valid, durationSeconds: '' }).durationSeconds).toBeDefined();
    expect(validateLesson({ ...valid, durationSeconds: '1.5' }).durationSeconds).toBeDefined();
    expect(validateLesson({ ...valid, durationSeconds: '0' }).durationSeconds).toBeDefined();
    expect(validateLesson({ ...valid, durationSeconds: '100000' }).durationSeconds).toBeDefined();
  });
});

describe('validateRegistration', () => {
  it('mirrors the server password rules', () => {
    expect(validateRegistration({ name: 'A', email: 'a@b.co', password: 'abcdefgh' }).password).toMatch(/letter and a number/);
    expect(validateRegistration({ name: 'A', email: 'a@b.co', password: 'abc123' }).password).toMatch(/8 characters/);
    expect(validateRegistration({ name: 'A', email: 'a@b.co', password: 'abcdefg1' })).toEqual({});
    expect(validateRegistration({ name: ' ', email: 'nope', password: 'abcdefg1' })).toMatchObject({
      name: expect.any(String),
      email: expect.any(String),
    });
  });
});
