import { useToast } from '@/stores/toast';
import type { ToastType } from '@/stores/toast';
import { cn } from '@/lib/utils';

const ACCENT: Record<ToastType, string> = {
  success: 'border-l-green-500 text-green-600 dark:text-green-400',
  error: 'border-l-destructive text-destructive',
  info: 'border-l-foreground/40 text-foreground',
};

const ICON: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  info: '🔔',
};

export function Toaster() {
  const toasts = useToast((s) => s.toasts);
  const dismiss = useToast((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismiss(t.id)}
          className={cn(
            'pointer-events-auto flex w-full items-start gap-2 rounded-lg border border-l-4 bg-card px-4 py-3 text-left text-sm shadow-xl',
            ACCENT[t.type],
          )}
        >
          <span aria-hidden className="leading-tight">
            {ICON[t.type]}
          </span>
          <span className="flex-1 text-foreground">{t.message}</span>
        </button>
      ))}
    </div>
  );
}
