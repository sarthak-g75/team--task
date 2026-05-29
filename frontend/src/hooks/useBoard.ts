import { useMemo } from 'react';
import { useProjects, useTasks, useUsers } from '@/lib/queries';
import { useAuth } from '@/stores/auth';
import { STATUSES } from '@/lib/types';
import type { Task, TaskStatus } from '@/lib/types';

export function useBoard(projectId: string) {
  const user = useAuth((s) => s.user);
  const { data: tasks, isLoading, isError } = useTasks(projectId ? { projectId } : {});
  const { data: projects } = useProjects();
  const { data: users } = useUsers();

  const assigneeName = useMemo(() => {
    const map = new Map<string, string>();
    users?.forEach((u) => map.set(u.id, u.name));
    if (user) map.set(user.id, user.name);
    return (id: string | null) => (id ? (map.get(id) ?? 'Assigned') : 'Unassigned');
  }, [users, user]);

  const byStatus = useMemo(() => {
    const groups = Object.fromEntries(STATUSES.map((s) => [s, [] as Task[]])) as Record<
      TaskStatus,
      Task[]
    >;
    tasks?.forEach((t) => groups[t.status].push(t));
    return groups;
  }, [tasks]);

  return { projects, byStatus, assigneeName, isLoading, isError };
}
