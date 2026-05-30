import { useState } from 'react';
import { useCreateTask, useProjects, useUsers } from '@/lib/queries';
import { errorMessage } from '@/lib/api';
import { useToast } from '@/stores/toast';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { PRIORITIES } from '@/lib/types';
import type { Priority } from '@/lib/types';
import { htmlToText } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function CreateTaskDialog({ onClose }: { onClose: () => void }) {
  const { data: projects } = useProjects();
  const { data: users } = useUsers();
  const createTask = useCreateTask();
  const toast = useToast((s) => s.push);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [projectId, setProjectId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const hasDescription = htmlToText(description).length > 0;
      await createTask.mutateAsync({
        title,
        priority,
        projectId,
        ...(hasDescription ? { description } : {}),
        ...(assigneeId ? { assigneeId } : {}),
        ...(dueDate ? { dueDate } : {}),
      });
      toast(`Task "${title}" created`, 'success');
      onClose();
    } catch (err) {
      const message = errorMessage(err, 'Could not create task');
      setError(message);
      toast(message, 'error');
    }
  };

  const field = 'w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-md space-y-4 rounded-xl border bg-card p-6 shadow-lg"
      >
        <h2 className="text-lg font-semibold">New task</h2>

        <input
          className={field}
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <RichTextEditor value={description} onChange={setDescription} />

        <div className="grid grid-cols-2 gap-3">
          <select className={field} value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <input
            className={field}
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        <select className={field} value={projectId} onChange={(e) => setProjectId(e.target.value)} required>
          <option value="">Select project…</option>
          {projects?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <select className={field} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
          <option value="">Unassigned</option>
          {users?.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.role})
            </option>
          ))}
        </select>

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={createTask.isPending}>
            {createTask.isPending ? 'Creating…' : 'Create task'}
          </Button>
        </div>
      </form>
    </div>
  );
}
