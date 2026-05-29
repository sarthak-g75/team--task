import { useEffect, useMemo, useState } from 'react';
import { Header } from '@/components/Header';
import { TaskCard } from '@/components/TaskCard';
import { CreateTaskDialog } from '@/components/CreateTaskDialog';
import { CreateProjectDialog } from '@/components/CreateProjectDialog';
import { useTaskEvents } from '@/hooks/useTaskEvents';
import { useProjects, useTasks, useUsers } from '@/lib/queries';
import { useAuth } from '@/stores/auth';
import { useToast } from '@/stores/toast';
import { STATUSES, STATUS_LABEL } from '@/lib/types';
import type { Task, TaskStatus } from '@/lib/types';

export default function Board() {
  const user = useAuth((s) => s.user);
  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const [selectedProjectId, setSelectedProjectId] = useState('');
  const { data: projects } = useProjects();
  const { data: tasks, isLoading, isError } = useTasks(
    selectedProjectId ? { projectId: selectedProjectId } : {},
  );
  const { data: users } = useUsers();

  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);

  const lastEvent = useTaskEvents();
  const pushToast = useToast((s) => s.push);

  useEffect(() => {
    if (lastEvent) {
      pushToast(`"${lastEvent.title}" moved ${lastEvent.from} → ${lastEvent.to}`, 'info');
    }
  }, [lastEvent, pushToast]);

  const assigneeName = useMemo(() => {
    const map = new Map<string, string>();
    users?.forEach((u) => map.set(u.id, u.name));
    if (user) map.set(user.id, user.name);
    return (id: string | null) => (id ? (map.get(id) ?? 'Assigned') : 'Unassigned');
  }, [users, user]);

  const byStatus = useMemo(() => {
    const groups: Record<TaskStatus, Task[]> = {
      TODO: [],
      IN_PROGRESS: [],
      IN_REVIEW: [],
      DONE: [],
      BLOCKED: [],
    };
    tasks?.forEach((t) => groups[t.status].push(t));
    return groups;
  }, [tasks]);

  const noProjects = canManage && projects?.length === 0;

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <Header
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelectProject={setSelectedProjectId}
        onNewProject={canManage ? () => setProjectDialogOpen(true) : undefined}
        onNewTask={canManage ? () => setTaskDialogOpen(true) : undefined}
      />

      <main className="flex-1 overflow-x-auto p-6">
        {noProjects && (
          <p className="mb-4 rounded-lg border border-dashed bg-card p-3 text-sm text-muted-foreground">
            No projects yet — create one with <strong>New project</strong> before adding tasks.
          </p>
        )}
        {isLoading && <p className="text-sm text-muted-foreground">Loading tasks…</p>}
        {isError && <p className="text-sm text-destructive">Failed to load tasks.</p>}

        {!isLoading && !isError && (
          <div className="flex gap-4">
            {STATUSES.map((status) => (
              <section key={status} className="flex w-72 shrink-0 flex-col">
                <div className="mb-2 flex items-center justify-between px-1">
                  <h2 className="text-sm font-semibold">{STATUS_LABEL[status]}</h2>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {byStatus[status].length}
                  </span>
                </div>
                <div className="flex flex-col gap-2 rounded-lg bg-muted/40 p-2">
                  {byStatus[status].length === 0 && (
                    <p className="px-1 py-4 text-center text-xs text-muted-foreground">No tasks</p>
                  )}
                  {byStatus[status].map((task) => (
                    <TaskCard key={task.id} task={task} assigneeName={assigneeName(task.assigneeId)} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {taskDialogOpen && <CreateTaskDialog onClose={() => setTaskDialogOpen(false)} />}
      {projectDialogOpen && <CreateProjectDialog onClose={() => setProjectDialogOpen(false)} />}
    </div>
  );
}
