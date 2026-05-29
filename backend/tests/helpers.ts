import supertest from 'supertest';
import type { Role } from '@prisma/client';
import { app } from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { redis } from '../src/config/redis.js';
import { hashPassword } from '../src/utils/password.js';

export const api = supertest(app);

const PASSWORD = 'Passw0rd!';

export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "Task","Project","RefreshToken","User" RESTART IDENTITY CASCADE',
  );
}

export async function createUser(role: Role, email: string) {
  return prisma.user.create({
    data: { name: email, email, role, passwordHash: await hashPassword(PASSWORD) },
  });
}

export async function login(email: string, password: string = PASSWORD): Promise<string> {
  const res = await api.post('/api/auth/login').send({ email, password });
  return res.body.data.accessToken as string;
}

export function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function teardown(): Promise<void> {
  await prisma.$disconnect();
  if (redis.status !== 'end') await redis.quit();
}
