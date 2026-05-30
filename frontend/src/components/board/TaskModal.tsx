import { useState } from 'react';
import { X, Pencil, Trash2 } from 'lucide-react';
import { RichTextViewer } from '@/components/editor/RichTextViewer';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { Button } from '@/components/ui/button';
import { useDeleteTask, useUpdateStatus, useUpdateTask, useUsers } from '@/lib/queries';
import type { UpdateTaskInput } from '@/lib/queries';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/stores/auth';
import { useToast } from '@/stores/toast';
import { PRIORITIES, STATUS_LABEL, TRANSITIONS } from '@/lib/types';
import type { Priority, Task } from '@/lib/types';
import { cn, htmlToText } from '@/lib/utils';

interface TaskModalProps {
  task: Task;
  userName: (id: string | null) => string;
  onClose: () => void;
}

const PRIORITY_STYLE: Record<Priority, string> = {
  LOW: 'bg-muted text-muted-foreground',
  MEDIUM: 'bg-chart-2/15 text-foreground',
  HIGH: 'bg-destructive/10 text-destructive',
};

const field =
  'w-full rounded-md border bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? '?').concat(parts[1]?.[0] ?? '').toUpperCase();
}

function Person({ name }: { name: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[9px] font-semibold text-primary">
        {initials(name)}
      </span>
      <span className="truncate">{name}</span>
    </span>
  );
}

export function TaskModal({ task, userName, onClose }: TaskModalProps) {
  const user = useAuth((s) => s.user);
  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const isAssignee = task.assigneeId === user?.id;
  const canEdit = canManage || isAssignee;

  const { data: users } = useUsers();
  const updateStatus = useUpdateStatus();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const toast = useToast((s) => s.push);

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [assigneeId, setAssigneeId] = useState(task.assigneeId ?? '');
  const [dueDate, setDueDate] = useState(task.dueDate ? task.dueDate.slice(0, 10) : '');

  const nextStates = TRANSITIONS[task.status];
  const hasDescription = !!task.description && htmlToText(task.description).length > 0;

  const changeStatus = (status: Task['status']) =>
    updateStatus.mutate(
      { id: task.id, status },
      {
        onSuccess: () => toast(`"${task.title}" → ${STATUS_LABEL[status]}`, 'success'),
        onError: (err) => toast(errorMessage(err, 'Status change failed'), 'error'),
      },
    );

  const save = () => {
    const patch: UpdateTaskInput = {};
    if (title !== task.title) patch.title = title;
    if (description !== (task.description ?? '')) {
      patch.description = htmlToText(description).length > 0 ? description : null;
    }
    if (priority !== task.priority) patch.priority = priority;
    if (dueDate !== (task.dueDate ? task.dueDate.slice(0, 10) : '')) patch.dueDate = dueDate || null;
    if (canManage && assigneeId !== (task.assigneeId ?? '')) patch.assigneeId = assigneeId || null;

    if (Object.keys(patch).length === 0) {
      setEditing(false);
      return;
    }
    updateTask.mutate(
      { id: task.id, data: patch },
      {
        onSuccess: () => {
          toast('Task updated', 'success');
          setEditing(false);
        },
        onError: (err) => toast(errorMessage(err, 'Could not update task'), 'error'),
      },
    );
  };

  const remove = () =>
    deleteTask.mutate(task.id, {
      onSuccess: () => {
        toast('Task deleted', 'success');
        onClose();
      },
      onError: (err) => toast(errorMessage(err, 'Could not delete task'), 'error'),
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border bg-card shadow-2xl"
      >
        <div className="flex items-center justify-between border-b px-5 py-2.5">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Task</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="grid flex-1 gap-6 overflow-y-auto p-5 md:grid-cols-[1fr_15rem]">
          <div className="min-w-0 space-y-4">
            {editing ? (
              <input className={cn(field, 'text-base font-semibold')} value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Title" />
            ) : (
              <h2 className="text-lg font-semibold leading-snug">{task.title}</h2>
            )}

            <div>
              <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Description</p>
              {editing ? (
                <RichTextEditor value={description} onChange={setDescription} />
              ) : hasDescription ? (
                <RichTextViewer html={task.description as string} />
              ) : (
                <p className="text-sm text-muted-foreground">No description.</p>
              )}
            </div>
          </div>

          <aside className="space-y-3 rounded-lg border bg-muted/30 p-3 text-sm">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">Status</p>
              {nextStates.length > 0 && (canManage || isAssignee) ? (
                <select
                  aria-label="Change status"
                  value=""
                  disabled={updateStatus.isPending}
                  onChange={(e) => {
                    const status = e.target.value as Task['status'];
                    if (status) changeStatus(status);
                  }}
                  className={field}
                >
                  <option value="">{STATUS_LABEL[task.status]} ▾</option>
                  {nextStates.map((s) => (
                    <option key={s} value={s}>
                      → {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="inline-block rounded-md border px-2 py-1 text-xs font-medium">
                  {STATUS_LABEL[task.status]}
                </span>
              )}
            </div>

            <Detail label="Assignee">
              {editing && canManage ? (
                <select className={field} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                  <option value="">Unassigned</option>
                  {users?.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              ) : task.assigneeId ? (
                <Person name={userName(task.assigneeId)} />
              ) : (
                <span className="text-muted-foreground">Unassigned</span>
              )}
            </Detail>

            <Detail label="Reporter">
              <Person name={userName(task.createdById)} />
            </Detail>

            <Detail label="Priority">
              {editing ? (
                <select className={field} value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              ) : (
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', PRIORITY_STYLE[task.priority])}>
                  {task.priority}
                </span>
              )}
            </Detail>

            <Detail label="Due date">
              {editing ? (
                <input type="date" className={field} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              ) : task.dueDate ? (
                new Date(task.dueDate).toLocaleDateString()
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </Detail>

            <p className="border-t pt-2 text-[11px] text-muted-foreground">
              Created {new Date(task.createdAt).toLocaleString()}
              <br />
              Updated {new Date(task.updatedAt).toLocaleString()}
            </p>
          </aside>
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
          {editing ? (
            <>
              <Button variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button onClick={save} disabled={updateTask.isPending}>
                {updateTask.isPending ? 'Saving…' : 'Save'}
              </Button>
            </>
          ) : (
            <>
              {canManage && (
                <Button variant="destructive" onClick={remove} disabled={deleteTask.isPending}>
                  <Trash2 className="size-4" />
                </Button>
              )}
              {canEdit && (
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Pencil className="size-4" /> Edit
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
