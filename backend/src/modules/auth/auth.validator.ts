import { z } from 'zod';

export const registerSchema = {
  body: z.object({
    organizationName: z.string().min(2).max(100),
    name: z.string().min(2).max(100),
    email: z.string().email(),
    password: z.string().min(8).max(128),
  }),
};

export const loginSchema = {
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
};
