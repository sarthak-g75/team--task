import { useState } from 'react';
import { useCreateProject } from '@/lib/queries';
import { errorMessage } from '@/lib/api';
import { useToast } from '@/stores/toast';
import { Button } from '@/components/ui/button';

export function CreateProjectDialog({ onClose }: { onClose: () => void }) {
  const createProject = useCreateProject();
  const toast = useToast((s) => s.push);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await createProject.mutateAsync({ name, ...(description ? { description } : {}) });
      toast(`Project "${name}" created`, 'success');
      onClose();
    } catch (err) {
      const message = errorMessage(err, 'Could not create project');
      setError(message);
      toast(message, 'error');
    }
  };

  const field =
    'w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-md space-y-4 rounded-xl border bg-card p-6 shadow-lg"
      >
        <h2 className="text-lg font-semibold">New project</h2>

        <input
          className={field}
          placeholder="Project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
        />
        <textarea
          className={field}
          placeholder="Description (optional)"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={createProject.isPending}>
            {createProject.isPending ? 'Creating…' : 'Create project'}
          </Button>
        </div>
      </form>
    </div>
  );
}
