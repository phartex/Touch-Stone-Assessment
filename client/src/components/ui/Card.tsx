import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-2xl bg-white shadow-sm ring-1 ring-slate-200', className)} {...props} />;
}

export function StatCard({ label, value, icon, hint }: { label: string; value: ReactNode; icon?: ReactNode; hint?: string }) {
  return (
    <Card className="flex items-start gap-4 p-5">
      {icon && <div className="rounded-xl bg-brand-50 p-2.5 text-brand-600">{icon}</div>}
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      </div>
    </Card>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 text-slate-600">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const GRADIENTS = [
  'from-indigo-500 to-violet-600',
  'from-sky-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-fuchsia-500 to-purple-600',
];

/** Course image with a deterministic gradient fallback when no thumbnail is set or it fails to load. */
export function CourseThumbnail({ src, title, className }: { src: string | null; title: string; className?: string }) {
  const hash = [...title].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const gradient = GRADIENTS[hash % GRADIENTS.length];
  return (
    <div className={cn('relative aspect-video overflow-hidden bg-gradient-to-br', gradient, className)}>
      <span className="absolute inset-0 flex items-center justify-center p-4 text-center text-lg font-bold text-white/90">
        {title}
      </span>
      {src && (
        <img
          src={src}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      )}
    </div>
  );
}
