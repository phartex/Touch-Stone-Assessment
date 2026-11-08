import { cn } from './cn';

interface ProgressBarProps {
  value: number;
  label: string;
  size?: 'sm' | 'md';
  showValue?: boolean;
  className?: string;
}

/** Accessible progress bar. `label` describes what the progress is for (read by screen readers). */
export function ProgressBar({ value, label, size = 'md', showValue = false, className }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, Math.round(value)));
  const complete = clamped === 100;
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        className={cn('w-full overflow-hidden rounded-full bg-slate-200', size === 'sm' ? 'h-1.5' : 'h-2.5')}
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-500', complete ? 'bg-emerald-500' : 'bg-brand-600')}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showValue && <span className="w-10 shrink-0 text-right text-xs font-semibold text-slate-600">{clamped}%</span>}
    </div>
  );
}
