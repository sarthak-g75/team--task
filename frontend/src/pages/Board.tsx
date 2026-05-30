import { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { CreateTaskDialog } from '@/components/CreateTaskDialog';
import { CreateProjectDialog } from '@/components/CreateProjectDialog';
import { BoardDndProvider } from '@/components/board/BoardDndProvider';
import { BoardColumn } from '@/components/board/BoardColumn';
import { useBoard } from '@/hooks/useBoard';
import { useTaskEvents } from '@/hooks/useTaskEvents';
import { useAuth } from '@/stores/auth';
import { useToast } from '@/stores/toast';
import { STATUSES } from '@/lib/types';

export default function Board() {
  const user = useAuth((s) => s.user);
  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const [selectedProjectId, setSelectedProjectId] = useState('');
  const { projects, byStatus, userName, isLoading, isError } = useBoard(selectedProjectId);

  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);

  const lastEvent = useTaskEvents();
  const pushToast = useToast((s) => s.push);
  useEffect(() => {
    if (lastEvent) {
      pushToast(`"${lastEvent.title}" moved ${lastEvent.from} → ${lastEvent.to}`, 'info');
    }
  }, [lastEvent, pushToast]);

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
          <BoardDndProvider>
            <div className="flex gap-4">
              {STATUSES.map((status) => (
                <BoardColumn
                  key={status}
                  status={status}
                  tasks={byStatus[status]}
                  userName={userName}
                />
              ))}
            </div>
          </BoardDndProvider>
        )}
      </main>

      {taskDialogOpen && <CreateTaskDialog onClose={() => setTaskDialogOpen(false)} />}
      {projectDialogOpen && <CreateProjectDialog onClose={() => setProjectDialogOpen(false)} />}
    </div>
  );
}
