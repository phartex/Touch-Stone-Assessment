import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from './cn';

const controlClasses = (invalid: boolean) =>
  cn(
    'block w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400',
    'focus:outline-none focus:ring-2 focus:ring-brand-500/40',
    invalid ? 'border-red-400 focus:border-red-500' : 'border-slate-300 focus:border-brand-500',
  );

interface FieldWrapperProps {
  label: string;
  error?: string;
  hint?: string;
  children: (ids: { id: string; describedBy: string | undefined }) => ReactNode;
}

/** Associates label, hint and error text with the control for screen readers. */
function FieldWrapper({ label, error, hint, children }: FieldWrapperProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">
        {label}
      </label>
      {children({ id, describedBy })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

type Common = { label: string; error?: string; hint?: string };

export function TextField({ label, error, hint, className, ...props }: Common & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldWrapper label={label} error={error} hint={hint}>
      {({ id, describedBy }) => (
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(controlClasses(Boolean(error)), className)}
          {...props}
        />
      )}
    </FieldWrapper>
  );
}

export function TextAreaField({ label, error, hint, className, ...props }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldWrapper label={label} error={error} hint={hint}>
      {({ id, describedBy }) => (
        <textarea
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(controlClasses(Boolean(error)), 'min-h-24', className)}
          {...props}
        />
      )}
    </FieldWrapper>
  );
}

export function SelectField({
  label,
  error,
  hint,
  className,
  children,
  ...props
}: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <FieldWrapper label={label} error={error} hint={hint}>
      {({ id, describedBy }) => (
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(controlClasses(Boolean(error)), className)}
          {...props}
        >
          {children}
        </select>
      )}
    </FieldWrapper>
  );
}
