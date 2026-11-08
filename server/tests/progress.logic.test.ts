import { describe, expect, it } from 'vitest';
import { evaluateProgress, pickNextLesson, progressPercent } from '../src/modules/progress/progress.logic.js';

describe('evaluateProgress', () => {
  const base = { durationSeconds: 100, ended: false, previouslyCompleted: false };

  it('records position without completing mid-lesson', () => {
    expect(evaluateProgress({ ...base, reportedPositionSeconds: 42.123 })).toEqual({
      positionSeconds: 42.12,
      completed: false,
      justCompleted: false,
    });
  });

  it('completes once the learner reaches the 95% threshold', () => {
    expect(evaluateProgress({ ...base, reportedPositionSeconds: 94.9 }).completed).toBe(false);
    const result = evaluateProgress({ ...base, reportedPositionSeconds: 95 });
    expect(result).toMatchObject({ completed: true, justCompleted: true });
  });

  it('completes when the player reports the ended event even if duration metadata is longer', () => {
    expect(evaluateProgress({ ...base, reportedPositionSeconds: 10, ended: true })).toMatchObject({
      completed: true,
      justCompleted: true,
    });
  });

  it('keeps completion sticky when the learner seeks back or replays', () => {
    const result = evaluateProgress({ ...base, reportedPositionSeconds: 3, previouslyCompleted: true });
    expect(result).toEqual({ positionSeconds: 3, completed: true, justCompleted: false });
  });

  it('clamps out-of-range positions into [0, duration]', () => {
    expect(evaluateProgress({ ...base, reportedPositionSeconds: 500 }).positionSeconds).toBe(100);
    expect(evaluateProgress({ ...base, reportedPositionSeconds: -5 }).positionSeconds).toBe(0);
  });
});

describe('progressPercent', () => {
  it('handles empty courses and rounds', () => {
    expect(progressPercent(0, 0)).toBe(0);
    expect(progressPercent(1, 3)).toBe(33);
    expect(progressPercent(2, 3)).toBe(67);
    expect(progressPercent(3, 3)).toBe(100);
  });
});

describe('pickNextLesson', () => {
  it('returns the first incomplete lesson by position', () => {
    const lessons = [
      { id: 'c', position: 3, completed: false },
      { id: 'a', position: 1, completed: true },
      { id: 'b', position: 2, completed: false },
    ];
    expect(pickNextLesson(lessons)?.id).toBe('b');
  });

  it('falls back to the first lesson when all are complete, and null when empty', () => {
    expect(pickNextLesson([{ id: 'x', position: 1, completed: true }])?.id).toBe('x');
    expect(pickNextLesson([])).toBeNull();
  });
});
