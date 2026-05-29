import { useState } from 'react';
import { useBoardDnd } from './dndContext';
import { TaskCard } from './TaskCard';
import { useUpdateStatus } from '@/lib/queries';
import { useToast } from '@/stores/toast';
import { errorMessage } from '@/lib/api';
import { STATUS_LABEL } from '@/lib/types';
import type { Task, TaskStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

interface BoardColumnProps {
  status: TaskStatus;
  tasks: Task[];
  assigneeName: (id: string | null) => string;
}

export function BoardColumn({ status, tasks, assigneeName }: BoardColumnProps) {
  const { dragging, canDrop, endDrag } = useBoardDnd();
  const updateStatus = useUpdateStatus();
  const toast = useToast((s) => s.push);
  const [over, setOver] = useState(false);

  const droppable = canDrop(status);
  const isSource = dragging?.status === status;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setOver(false);
    const id = e.dataTransfer.getData('text/plain');
    const moved = dragging;
    endDrag();
    if (!id || !moved || moved.status === status || !canDrop(status)) return;
    updateStatus.mutate(
      { id, status },
      {
        onSuccess: () => toast(`"${moved.title}" → ${STATUS_LABEL[status]}`, 'success'),
        onError: (err) => toast(errorMessage(err, 'Status change failed'), 'error'),
      },
    );
  };

  return (
    <section
      className="flex w-72 shrink-0 flex-col"
      onDragOver={(e) => {
        if (!droppable) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold">{STATUS_LABEL[status]}</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {tasks.length}
        </span>
      </div>

      <div
        className={cn(
          'flex min-h-24 flex-col gap-2 rounded-lg bg-muted/40 p-2 transition-colors',
          dragging && droppable && 'ring-1 ring-primary/40',
          over && 'bg-primary/5 ring-2 ring-primary',
          dragging && !droppable && !isSource && 'opacity-50',
        )}
      >
        {tasks.length === 0 && (
          <p className="px-1 py-4 text-center text-xs text-muted-foreground">No tasks</p>
        )}
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} assigneeName={assigneeName(task.assigneeId)} />
        ))}
      </div>
    </section>
  );
}
