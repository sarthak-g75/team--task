import { useUpdateStatus } from '@/lib/queries';
import { errorMessage } from '@/lib/api';
import { useToast } from '@/stores/toast';
import { TRANSITIONS, STATUS_LABEL } from '@/lib/types';
import type { Priority, Task } from '@/lib/types';
import { cn } from '@/lib/utils';

const PRIORITY_STYLE: Record<Priority, string> = {
  LOW: 'bg-muted text-muted-foreground',
  MEDIUM: 'bg-chart-2/15 text-foreground',
  HIGH: 'bg-destructive/10 text-destructive',
};

function isOverdue(task: Task): boolean {
  if (!task.dueDate || task.status === 'DONE') return false;
  return new Date(task.dueDate).getTime() < Date.now();
}

export function TaskCard({ task, assigneeName }: { task: Task; assigneeName?: string }) {
  const updateStatus = useUpdateStatus();
  const toast = useToast((s) => s.push);
  const nextStates = TRANSITIONS[task.status];
  const overdue = isOverdue(task);

  return (
    <div className="space-y-2 rounded-lg border bg-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug">{task.title}</p>
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold',
            PRIORITY_STYLE[task.priority],
          )}
        >
          {task.priority}
        </span>
      </div>

      {task.description && (
        <p className="line-clamp-2 text-xs text-muted-foreground">{task.description}</p>
      )}

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{assigneeName ?? 'Unassigned'}</span>
        {task.dueDate && (
          <span className={cn(overdue && 'font-medium text-destructive')}>
            {new Date(task.dueDate).toLocaleDateString()}
          </span>
        )}
      </div>

      {nextStates.length > 0 && (
        <select
          aria-label="Change status"
          className="w-full rounded-md border bg-background px-2 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          value=""
          disabled={updateStatus.isPending}
          onChange={(e) => {
            const status = e.target.value as Task['status'];
            if (!status) return;
            updateStatus.mutate(
              { id: task.id, status },
              {
                onSuccess: () => toast(`"${task.title}" → ${STATUS_LABEL[status]}`, 'success'),
                onError: (err) => toast(errorMessage(err, 'Status change failed'), 'error'),
              },
            );
          }}
        >
          <option value="">Move to…</option>
          {nextStates.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
