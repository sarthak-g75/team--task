import { Redis } from 'ioredis';
import type { Response } from 'express';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { redis } from '../config/redis.js';

const CHANNEL = 'task-events';

interface TaskEventMessage {
  userId: string;
  event: string;
  data: unknown;
}

const clients = new Map<string, Set<Response>>();

let subscriber: Redis | null = null;

export async function initTaskEvents(): Promise<void> {
  subscriber = new Redis(env.REDIS_URL, { lazyConnect: true });
  subscriber.on('error', (err: Error) => logger.error({ err }, 'sse subscriber redis error'));
  await subscriber.connect();
  await subscriber.subscribe(CHANNEL);
  subscriber.on('message', (_channel: string, message: string) => {
    try {
      const { userId, event, data } = JSON.parse(message) as TaskEventMessage;
      fanout(userId, event, data);
    } catch (err) {
      logger.error({ err }, 'failed to handle task-event message');
    }
  });
  logger.info('task events subscriber ready');
}

export async function closeTaskEvents(): Promise<void> {
  if (subscriber) await subscriber.quit();
}

export function addClient(userId: string, res: Response): () => void {
  let set = clients.get(userId);
  if (!set) {
    set = new Set();
    clients.set(userId, set);
  }
  set.add(res);

  return () => {
    const current = clients.get(userId);
    if (!current) return;
    current.delete(res);
    if (current.size === 0) clients.delete(userId);
  };
}

export async function publishTaskEvent(
  userId: string,
  event: string,
  data: unknown,
): Promise<void> {
  const message: TaskEventMessage = { userId, event, data };
  await redis.publish(CHANNEL, JSON.stringify(message));
}

function fanout(userId: string, event: string, data: unknown): void {
  const set = clients.get(userId);
  if (!set) return;
  const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) res.write(frame);
}
