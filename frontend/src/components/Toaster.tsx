import { Check, X, Bell } from 'lucide-react';
import type { ComponentType } from 'react';
import { useToast } from '@/stores/toast';
import type { ToastType } from '@/stores/toast';
import { cn } from '@/lib/utils';

const CONFIG: Record<ToastType, { icon: ComponentType<{ className?: string }>; badge: string; label: string }> = {
  success: { icon: Check, badge: 'bg-green-500/15 text-green-600 dark:text-green-400', label: 'Success' },
  error: { icon: X, badge: 'bg-destructive/15 text-destructive', label: 'Error' },
  info: { icon: Bell, badge: 'bg-primary/15 text-primary', label: 'Update' },
};

export function Toaster() {
  const toasts = useToast((s) => s.toasts);
  const dismiss = useToast((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-80 flex-col gap-2.5">
      {toasts.map((t) => {
        const { icon: Icon, badge, label } = CONFIG[t.type];
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-3 rounded-xl border border-border/60 bg-card/95 p-3 shadow-lg ring-1 ring-black/5 backdrop-blur duration-300 animate-in fade-in slide-in-from-right-4 dark:ring-white/10"
          >
            <span
              className={cn(
                'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full',
                badge,
              )}
            >
              <Icon className="size-4" />
            </span>
            <div className="flex-1 space-y-0.5">
              <p className="text-sm font-semibold leading-none">{label}</p>
              <p className="text-xs text-muted-foreground">{t.message}</p>
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="-mr-1 -mt-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
