import { Router } from 'express';
import type { Request, Response } from 'express';
import { prisma } from '../config/database.js';
import { redis } from '../config/redis.js';

export const healthRouter = Router();

healthRouter.get('/', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

healthRouter.get('/ready', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await redis.ping();
    res.status(200).json({ status: 'ready', postgres: 'up', redis: 'up' });
  } catch (err) {
    res.status(503).json({ status: 'not ready', error: String(err) });
  }
});
