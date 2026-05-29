import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/stores/auth';
import type { Paginated, Priority, Project, Task, TaskStatus, User } from '@/lib/types';

interface ListResponse<T> {
  data: T[];
}
interface ItemResponse<T> {
  data: T;
}

export function useTasks(
  filters: { status?: TaskStatus; priority?: Priority; projectId?: string } = {},
) {
  return useQuery({
    queryKey: ['tasks', filters],
    queryFn: async () => {
      const res = await api.post<Paginated<Task>>('/tasks/all', { limit: 100, ...filters });
      return res.data.data;
    },
  });
}

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await api.post<ListResponse<Project>>('/projects/all', { limit: 100 });
      return res.data.data;
    },
  });
}

export function useUsers() {
  const role = useAuth((s) => s.user?.role);
  return useQuery({
    queryKey: ['users'],
    enabled: role === 'ADMIN' || role === 'MANAGER',
    queryFn: async () => {
      const res = await api.post<ListResponse<User>>('/users/all', { limit: 100 });
      return res.data.data;
    },
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; description?: string }) => {
      const res = await api.post<ItemResponse<Project>>('/projects', input);
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority: Priority;
  projectId: string;
  assigneeId?: string;
  dueDate?: string;
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      const res = await api.post<ItemResponse<Task>>('/tasks', input);
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useUpdateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TaskStatus }) => {
      const res = await api.patch<ItemResponse<Task>>(`/tasks/${id}/status`, { status });
      return res.data.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}
