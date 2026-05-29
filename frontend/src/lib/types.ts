export type Role = 'ADMIN' | 'MANAGER' | 'MEMBER';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'BLOCKED';

export const STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED'];
export const PRIORITIES: Priority[] = ['LOW', 'MEDIUM', 'HIGH'];

export const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
  BLOCKED: 'Blocked',
};

export const TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  TODO: ['IN_PROGRESS', 'BLOCKED'],
  IN_PROGRESS: ['IN_REVIEW', 'BLOCKED'],
  IN_REVIEW: ['DONE', 'BLOCKED'],
  DONE: [],
  BLOCKED: ['TODO', 'IN_PROGRESS', 'IN_REVIEW'],
};

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: Priority;
  status: TaskStatus;
  dueDate: string | null;
  projectId: string;
  assigneeId: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> {
  status: number;
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface ApiErrorBody {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}
