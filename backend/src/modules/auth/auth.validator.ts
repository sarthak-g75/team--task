import { z } from 'zod';

export const loginSchema = {
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
};

export const registerSchema = {
  body: z.object({
    name: z.string().min(2).max(100),
    email: z.string().email(),
    password: z.string().min(8).max(128),
  }),
};
