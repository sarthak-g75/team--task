import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/stores/auth';
import { Button } from '@/components/ui/button';
import type { Project } from '@/lib/types';

interface HeaderProps {
  projects?: Project[];
  selectedProjectId: string;
  onSelectProject: (id: string) => void;
  onNewProject?: () => void;
  onNewTask?: () => void;
}

export function Header({
  projects,
  selectedProjectId,
  onSelectProject,
  onNewProject,
  onNewTask,
}: HeaderProps) {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const clear = useAuth((s) => s.clear);

  const logout = () => {
    clear();
    navigate('/login');
  };

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-card px-6 py-3">
      <div className="flex items-center gap-3">
        <h1 className="text-base font-semibold">Task Board</h1>
        <select
          aria-label="Filter by project"
          className="rounded-md border bg-background px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={selectedProjectId}
          onChange={(e) => onSelectProject(e.target.value)}
        >
          <option value="">All projects</option>
          {projects?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3">
        {onNewProject && (
          <Button size="sm" variant="outline" onClick={onNewProject}>
            + New project
          </Button>
        )}
        {onNewTask && (
          <Button size="sm" onClick={onNewTask}>
            + New task
          </Button>
        )}
        {user?.role === 'ADMIN' && (
          <Button size="sm" variant="outline" onClick={() => navigate('/users')}>
            Users
          </Button>
        )}
        <div className="text-right text-xs">
          <p className="font-medium">{user?.name}</p>
          <p className="text-muted-foreground">{user?.role}</p>
        </div>
        <Button size="sm" variant="outline" onClick={logout}>
          Logout
        </Button>
      </div>
    </header>
  );
}
