import { z } from 'zod';

const PRIORITY = ['LOW', 'MEDIUM', 'HIGH'] as const;
const STATUS = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED'] as const;

const futureDate = z.coerce
  .date()
  .refine((d) => d.getTime() > Date.now(), { message: 'dueDate must be a future date' });

export const createTaskSchema = {
  body: z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(20000).optional(),
    priority: z.enum(PRIORITY).default('MEDIUM'),
    projectId: z.string().min(1),
    assigneeId: z.string().min(1).optional(),
    dueDate: futureDate.optional(),
  }),
};

export const updateTaskSchema = {
  body: z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(20000).nullable().optional(),
    priority: z.enum(PRIORITY).optional(),
    projectId: z.string().min(1).optional(),
    assigneeId: z.string().min(1).nullable().optional(),
    dueDate: futureDate.nullable().optional(),
  }),
};

export const transitionStatusSchema = {
  body: z.object({
    status: z.enum(STATUS),
  }),
};

export const listTaskSchema = {
  body: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    status: z.enum(STATUS).optional(),
    priority: z.enum(PRIORITY).optional(),
    assigneeId: z.string().min(1).optional(),
    projectId: z.string().min(1).optional(),
    search: z.string().optional(),
    orderBy: z.union([z.string(), z.record(z.enum(['asc', 'desc']))]).optional(),
    order: z.enum(['asc', 'desc']).optional(),
  }),
};
