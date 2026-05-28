import { redis } from '../config/redis.js';
import { createHash } from 'crypto';

const TASK_VERSION_PREFIX = 'tasks:assignee:version:';
const TASK_CACHE_PREFIX = 'tasks:assignee:';
const CACHE_TTL = 600;

function filterHash(filters: Record<string, unknown>) {
  return createHash('sha1').update(JSON.stringify(filters)).digest('hex').slice(0, 8);
}

async function getAssigneeVersion(userId: string) {
  const key = `${TASK_VERSION_PREFIX}${userId}`;
  const v = await redis.get(key);
  return v ?? '0';
}

export async function invalidateTaskCache(userId: string) {
  await redis.incr(`${TASK_VERSION_PREFIX}${userId}`);
}

export async function getTaskCache<T>(
  userId: string,
  filters: Record<string, unknown>,
): Promise<T | null> {
  const version = await getAssigneeVersion(userId);
  const key = `${TASK_CACHE_PREFIX}${userId}:v${version}:${filterHash(filters)}`;
  const raw = await redis.get(key);
  if (!raw) return null;
  return JSON.parse(raw) as T;
}

export async function setTaskCache(
  userId: string,
  filters: Record<string, unknown>,
  data: unknown,
) {
  const version = await getAssigneeVersion(userId);
  const key = `${TASK_CACHE_PREFIX}${userId}:v${version}:${filterHash(filters)}`;
  await redis.set(key, JSON.stringify(data), 'EX', CACHE_TTL);
}
