import { z } from 'zod';

export const createProjectSchema = {
  body: z.object({
    name: z.string().min(2).max(120),
    description: z.string().max(2000).optional(),
  }),
};

export const updateProjectSchema = {
  body: z.object({
    name: z.string().min(2).max(120).optional(),
    description: z.string().max(2000).nullable().optional(),
  }),
};

export const listProjectSchema = {
  body: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    search: z.string().optional(),
    orderBy: z.union([z.string(), z.record(z.enum(['asc', 'desc']))]).optional(),
    order: z.enum(['asc', 'desc']).optional(),
  }),
};
