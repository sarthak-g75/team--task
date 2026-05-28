import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { logger } from './logger.js';

const adapter = new PrismaPg({
  connectionString: process.env['DATABASE_URL'],
});

export const prisma = new PrismaClient({
  adapter,
  log:
    process.env['NODE_ENV'] === 'development'
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'stdout', level: 'error' },
        ]
      : [{ emit: 'stdout', level: 'error' }],
});

prisma.$on('query' as never, (e: { query: string; duration: number }) => {
  logger.debug({ query: e.query, duration: e.duration }, 'prisma query');
});
