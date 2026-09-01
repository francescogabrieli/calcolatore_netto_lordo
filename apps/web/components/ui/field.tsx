import { cn } from '@/lib/cn';

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-[var(--text-muted)]">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs font-medium text-[var(--negative)]">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass = (hasError = false) =>
  cn(
    'w-full rounded-lg border bg-[var(--surface-muted)] px-3.5 py-2.5 text-sm tnum text-[var(--text)]',
    'outline-none transition-[border-color,box-shadow] duration-200',
    'focus:ring-2 focus:ring-[var(--accent)]/35 focus:border-[var(--accent)]',
    hasError ? 'border-[var(--negative)]' : 'border-[var(--border)]',
  );
