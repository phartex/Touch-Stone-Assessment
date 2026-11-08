/**
 * Pure business rules for learner progress. Kept free of I/O so they are trivially unit-testable.
 */

/**
 * A lesson counts as complete once the learner reaches this fraction of its duration. Players
 * often fire their last `timeupdate` slightly before the true end, and outros/credits are common,
 * so requiring 100% would make completion flaky.
 */
export const COMPLETION_THRESHOLD = 0.95;

export interface ProgressInput {
  durationSeconds: number;
  reportedPositionSeconds: number;
  /** True when the client observed the media `ended` event. */
  ended: boolean;
  previouslyCompleted: boolean;
}

export interface ProgressResult {
  positionSeconds: number;
  completed: boolean;
  /** True only on the update that transitions the lesson to completed. */
  justCompleted: boolean;
}

export function evaluateProgress(input: ProgressInput): ProgressResult {
  const { durationSeconds, reportedPositionSeconds, ended, previouslyCompleted } = input;
  // Clamp to [0, duration] and keep two decimals to match the NUMERIC(10,2) column.
  const clamped = Math.min(Math.max(reportedPositionSeconds, 0), durationSeconds);
  const positionSeconds = Math.round(clamped * 100) / 100;
  const reachedEnd = ended || positionSeconds >= durationSeconds * COMPLETION_THRESHOLD;
  // Completion is sticky: rewatching or seeking back never un-completes a lesson.
  const completed = previouslyCompleted || reachedEnd;
  return { positionSeconds, completed, justCompleted: completed && !previouslyCompleted };
}

export function progressPercent(completedLessons: number, totalLessons: number): number {
  if (totalLessons <= 0) return 0;
  return Math.min(100, Math.round((completedLessons / totalLessons) * 100));
}

/** The first incomplete lesson in course order, falling back to the first lesson. */
export function pickNextLesson<T extends { id: string; position: number; completed: boolean }>(
  lessons: readonly T[],
): T | null {
  const ordered = [...lessons].sort((a, b) => a.position - b.position);
  return ordered.find((lesson) => !lesson.completed) ?? ordered[0] ?? null;
}
