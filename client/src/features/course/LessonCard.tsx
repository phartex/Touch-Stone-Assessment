import { CheckCircle2, Lock, Play } from 'lucide-react';
import { Link } from 'react-router';
import { StatusBadge, statusFromProgress } from '../../components/ui/Badge';
import { cn } from '../../components/ui/cn';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { formatDuration } from '../../lib/format';
import type { LessonWithProgress } from '../../lib/types';

interface LessonCardProps {
  lesson: LessonWithProgress;
  locked?: boolean;
  active?: boolean;
  compact?: boolean;
}

export function lessonWatchPercent(lesson: Pick<LessonWithProgress, 'completed' | 'lastPositionSeconds' | 'durationSeconds'>) {
  if (lesson.completed) return 100;
  return Math.min(100, (lesson.lastPositionSeconds / lesson.durationSeconds) * 100);
}

/**
 * A lesson as a card. `compact` is the smaller "up next / related" variant used beside the player.
 * Locked lessons (not enrolled) render as non-interactive.
 */
export function LessonCard({ lesson, locked = false, active = false, compact = false }: LessonCardProps) {
  const percent = lessonWatchPercent(lesson);
  const status = statusFromProgress(lesson.completed, lesson.lastPositionSeconds > 0);

  const content = (
    <>
      <div
        className={cn(
          'grid shrink-0 place-items-center rounded-xl font-semibold',
          compact ? 'size-10 text-sm' : 'size-12',
          lesson.completed ? 'bg-emerald-100 text-emerald-700' : active ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600',
        )}
        aria-hidden
      >
        {locked ? (
          <Lock className="size-4" />
        ) : lesson.completed ? (
          <CheckCircle2 className="size-5" />
        ) : active ? (
          <Play className="size-4 fill-current" />
        ) : (
          lesson.position
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={cn('text-xs font-medium', active ? 'text-brand-600' : 'text-slate-500')}>
              Lesson {lesson.position} · {formatDuration(lesson.durationSeconds)}
              {active && <span> · Now playing</span>}
            </p>
            <h3 className={cn('font-semibold text-slate-900', compact ? 'truncate text-sm' : 'mt-0.5')}>{lesson.title}</h3>
          </div>
          {!compact && !locked && <StatusBadge status={status} />}
        </div>
        {!compact && lesson.description && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{lesson.description}</p>}
        {!locked && status === 'in-progress' && (
          <ProgressBar value={percent} label={`${lesson.title} watched`} size="sm" className="mt-2.5" />
        )}
        {compact && !locked && status !== 'in-progress' && (
          <p className={cn('mt-0.5 text-xs', lesson.completed ? 'text-emerald-700' : 'text-slate-500')}>
            {lesson.completed ? 'Completed' : 'Not started'}
          </p>
        )}
      </div>
    </>
  );

  const base = cn(
    'flex items-center gap-4 rounded-2xl bg-white ring-1 transition',
    compact ? 'p-3' : 'p-4',
    active ? 'ring-2 ring-brand-500 bg-brand-50/40' : 'ring-slate-200',
  );

  if (locked) {
    return (
      <div className={cn(base, 'opacity-75')} aria-label={`${lesson.title} (locked: enroll to watch)`}>
        {content}
      </div>
    );
  }

  return (
    <Link
      to={`/lessons/${lesson.id}`}
      aria-current={active ? 'page' : undefined}
      className={cn(base, 'hover:shadow-md hover:ring-brand-300')}
    >
      {content}
    </Link>
  );
}
