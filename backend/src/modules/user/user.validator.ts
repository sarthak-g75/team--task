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
    password: z.string().min(8).max(128).optional(),
    role: z.enum(['ADMIN', 'MANAGER', 'MEMBER']).optional(),
  }),
};
