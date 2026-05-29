import { Redis } from 'ioredis';
import type { Response } from 'express';
import type { Role } from '@prisma/client';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { redis } from '../config/redis.js';

const CHANNEL = 'task-events';

interface TaskEventMessage {
  assigneeId: string | null;
  event: string;
  data: unknown;
}

interface SseClient {
  res: Response;
  userId: string;
  role: Role;
}

const clients = new Set<SseClient>();

let subscriber: Redis | null = null;

export async function initTaskEvents(): Promise<void> {
  subscriber = new Redis(env.REDIS_URL, { lazyConnect: true });
  subscriber.on('error', (err: Error) => logger.error({ err }, 'sse subscriber redis error'));
  await subscriber.connect();
  await subscriber.subscribe(CHANNEL);
  subscriber.on('message', (_channel: string, message: string) => {
    try {
      const { assigneeId, event, data } = JSON.parse(message) as TaskEventMessage;
      fanout(assigneeId, event, data);
    } catch (err) {
      logger.error({ err }, 'failed to handle task-event message');
    }
  });
  logger.info('task events subscriber ready');
}

export async function closeTaskEvents(): Promise<void> {
  if (subscriber) await subscriber.quit();
}

export function addClient(userId: string, role: Role, res: Response): () => void {
  const client: SseClient = { res, userId, role };
  clients.add(client);
  return () => {
    clients.delete(client);
  };
}

export async function publishTaskEvent(
  assigneeId: string | null,
  event: string,
  data: unknown,
): Promise<void> {
  const message: TaskEventMessage = { assigneeId, event, data };
  await redis.publish(CHANNEL, JSON.stringify(message));
}

function fanout(assigneeId: string | null, event: string, data: unknown): void {
  const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    const isManager = client.role === 'ADMIN' || client.role === 'MANAGER';
    if (isManager || client.userId === assigneeId) {
      client.res.write(frame);
    }
  }
}
