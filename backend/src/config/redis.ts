import { Redis } from 'ioredis';
import { env } from './env.js';
import { logger } from './logger.js';

export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
});

redis.on('error', (err: Error) => logger.error({ err }, 'redis error'));
redis.on('connect', () => logger.info('redis connected'));
