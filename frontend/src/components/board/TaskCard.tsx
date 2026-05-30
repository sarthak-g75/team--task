import { useState } from 'react';
import { useBoardDnd } from './dndContext';
import { TaskModal } from './TaskModal';
import type { Priority, Task } from '@/lib/types';
import { cn, htmlToText } from '@/lib/utils';

const PRIORITY_STYLE: Record<Priority, string> = {
  LOW: 'bg-muted text-muted-foreground',
  MEDIUM: 'bg-chart-2/15 text-foreground',
  HIGH: 'bg-destructive/10 text-destructive',
};

function isOverdue(task: Task): boolean {
  if (!task.dueDate || task.status === 'DONE') return false;
  return new Date(task.dueDate).getTime() < Date.now();
}

interface TaskCardProps {
  task: Task;
  userName: (id: string | null) => string;
}

export function TaskCard({ task, userName }: TaskCardProps) {
  const { dragging, startDrag, endDrag } = useBoardDnd();
  const [open, setOpen] = useState(false);

  const overdue = isOverdue(task);
  const isDragging = dragging?.id === task.id;
  const descriptionPreview = task.description ? htmlToText(task.description) : '';

  return (
    <>
      <div
        draggable
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') setOpen(true);
        }}
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', task.id);
          e.dataTransfer.effectAllowed = 'move';
          startDrag(task);
        }}
        onDragEnd={endDrag}
        className={cn(
          'cursor-grab space-y-2 rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing',
          isDragging && 'opacity-40',
        )}
      >
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

        {descriptionPreview && (
          <p className="line-clamp-2 text-xs text-muted-foreground">{descriptionPreview}</p>
        )}

        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{userName(task.assigneeId)}</span>
          {task.dueDate && (
            <span className={cn(overdue && 'font-medium text-destructive')}>
              {new Date(task.dueDate).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      {open && <TaskModal task={task} userName={userName} onClose={() => setOpen(false)} />}
    </>
  );
}
