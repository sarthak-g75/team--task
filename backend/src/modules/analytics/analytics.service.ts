import { prisma } from '../../config/database.js';

interface CompletionAgg {
  userId: string;
  completed: number;
  avgCompletionSeconds: number;
}

export interface OverduePerUser {
  userId: string;
  name: string;
  email: string;
  overdueCount: number;
}

export interface CompletionPerUser {
  userId: string;
  name: string;
  email: string;
  completed: number;
  avgCompletionSeconds: number;
}

export async function getAnalyticsOverview() {
  const now = new Date();

  const overdueGroups = await prisma.task.groupBy({
    by: ['assigneeId'],
    where: { status: { not: 'DONE' }, dueDate: { lt: now }, assigneeId: { not: null } },
    _count: { _all: true },
  });

  const completionGroups = await prisma.$queryRaw<CompletionAgg[]>`
    SELECT "assigneeId" AS "userId",
           COUNT(*)::int AS completed,
           AVG(EXTRACT(EPOCH FROM ("completedAt" - "createdAt")))::float AS "avgCompletionSeconds"
    FROM "Task"
    WHERE status = 'DONE' AND "completedAt" IS NOT NULL AND "assigneeId" IS NOT NULL
    GROUP BY "assigneeId"`;

  const overallRows = await prisma.$queryRaw<{ completed: number; avgCompletionSeconds: number | null }[]>`
    SELECT COUNT(*)::int AS completed,
           AVG(EXTRACT(EPOCH FROM ("completedAt" - "createdAt")))::float AS "avgCompletionSeconds"
    FROM "Task"
    WHERE status = 'DONE' AND "completedAt" IS NOT NULL`;

  const ids = new Set<string>();
  overdueGroups.forEach((g) => g.assigneeId && ids.add(g.assigneeId));
  completionGroups.forEach((g) => ids.add(g.userId));

  const users = await prisma.user.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, name: true, email: true },
  });
  const userById = new Map(users.map((u) => [u.id, u]));

  const overduePerUser: OverduePerUser[] = overdueGroups
    .filter((g) => g.assigneeId)
    .map((g) => {
      const u = userById.get(g.assigneeId as string);
      return {
        userId: g.assigneeId as string,
        name: u?.name ?? 'Unknown',
        email: u?.email ?? '',
        overdueCount: g._count._all,
      };
    })
    .sort((a, b) => b.overdueCount - a.overdueCount);

  const completionPerUser: CompletionPerUser[] = completionGroups
    .map((g) => {
      const u = userById.get(g.userId);
      return {
        userId: g.userId,
        name: u?.name ?? 'Unknown',
        email: u?.email ?? '',
        completed: g.completed,
        avgCompletionSeconds: Math.round(g.avgCompletionSeconds),
      };
    })
    .sort((a, b) => a.avgCompletionSeconds - b.avgCompletionSeconds);

  const overall = overallRows[0];

  return {
    overduePerUser,
    completion: {
      overall: {
        completed: overall?.completed ?? 0,
        avgCompletionSeconds: overall?.avgCompletionSeconds
          ? Math.round(overall.avgCompletionSeconds)
          : null,
      },
      perUser: completionPerUser,
    },
  };
}
