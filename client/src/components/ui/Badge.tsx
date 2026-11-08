import { CheckCircle2, CircleDashed, PlayCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from './cn';

type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger';

const tones: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  brand: 'bg-brand-50 text-brand-700 ring-brand-100',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
};

export function Badge({ tone = 'neutral', icon, children, className }: { tone?: Tone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export type ProgressStatus = 'not-started' | 'in-progress' | 'completed';

export function statusFromProgress(completed: boolean, startedOrPercent: boolean | number): ProgressStatus {
  if (completed) return 'completed';
  const started = typeof startedOrPercent === 'number' ? startedOrPercent > 0 : startedOrPercent;
  return started ? 'in-progress' : 'not-started';
}

/** Completion state badge used on course and lesson cards. Uses icon + text, not colour alone. */
export function StatusBadge({ status }: { status: ProgressStatus }) {
  if (status === 'completed')
    return (
      <Badge tone="success" icon={<CheckCircle2 className="size-3.5" aria-hidden />}>
        Completed
      </Badge>
    );
  if (status === 'in-progress')
    return (
      <Badge tone="brand" icon={<PlayCircle className="size-3.5" aria-hidden />}>
        In progress
      </Badge>
    );
  return (
    <Badge tone="neutral" icon={<CircleDashed className="size-3.5" aria-hidden />}>
      Not started
    </Badge>
  );
}
