import { z } from 'zod';

export const createUserSchema = {
  body: z.object({
    name: z.string().min(2).max(100),
    email: z.string().email(),
    password: z.string().min(8).max(128),
    role: z.enum(['MANAGER', 'MEMBER']).default('MEMBER'),
  }),
};

export const updateUserSchema = {
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    email: z.string().email().optional(),
    password: z.string().min(8).max(128).optional(),
    role: z.enum(['ADMIN', 'MANAGER', 'MEMBER']).optional(),
  }),
};

export const listUserSchema = {
  body: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    role: z.enum(['ADMIN', 'MANAGER', 'MEMBER']).optional(),
    search: z.string().optional(),
    orderBy: z.union([z.string(), z.record(z.enum(['asc', 'desc']))]).optional(),
    order: z.enum(['asc', 'desc']).optional(),
  }),
};
