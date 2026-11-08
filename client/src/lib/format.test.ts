import { describe, expect, it } from 'vitest';
import { formatDuration, formatRelative, formatTimestamp, pluralize } from './format';

describe('formatTimestamp', () => {
  it('formats seconds as m:ss or h:mm:ss', () => {
    expect(formatTimestamp(0)).toBe('0:00');
    expect(formatTimestamp(75.9)).toBe('1:15');
    expect(formatTimestamp(3725)).toBe('1:02:05');
  });
});

describe('formatDuration', () => {
  it('uses the most readable unit', () => {
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(600)).toBe('10 min');
    expect(formatDuration(5400)).toBe('1h 30m');
    expect(formatDuration(7200)).toBe('2h');
  });
});

describe('formatRelative', () => {
  const now = new Date('2026-01-10T12:00:00Z');
  it('describes how long ago something happened', () => {
    expect(formatRelative(null)).toBe('Never');
    expect(formatRelative('2026-01-10T11:59:30Z', now)).toBe('Just now');
    expect(formatRelative('2026-01-10T09:00:00Z', now)).toBe('3 hours ago');
    expect(formatRelative('2026-01-09T12:00:00Z', now)).toBe('yesterday');
  });
});

describe('pluralize', () => {
  it('handles singular and plural', () => {
    expect(pluralize(1, 'lesson')).toBe('1 lesson');
    expect(pluralize(3, 'lesson')).toBe('3 lessons');
  });
});
