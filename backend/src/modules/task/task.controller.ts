import type { NextFunction, Request, Response } from 'express';
import type { TaskStatus } from '@prisma/client';
import { BaseController } from '../../core/BaseController.js';
import { ApiError } from '../../core/ApiError.js';
import { prisma } from '../../config/database.js';
import { getTaskCache, setTaskCache, invalidateTaskCache } from '../../utils/cache.js';
import { publishTaskEvent } from '../../realtime/taskEvents.js';

const TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  TODO: ['IN_PROGRESS', 'BLOCKED'],
  IN_PROGRESS: ['IN_REVIEW', 'BLOCKED'],
  IN_REVIEW: ['DONE', 'BLOCKED'],
  DONE: [],
  BLOCKED: ['TODO', 'IN_PROGRESS', 'IN_REVIEW'],
};

const TASK_SELECT = {
  id: true,
  title: true,
  description: true,
  priority: true,
  status: true,
  dueDate: true,
  completedAt: true,
  projectId: true,
  assigneeId: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
} as const;

export class TaskController extends BaseController {
  constructor() {
    super(prisma.task);
  }

  protected getSelect() {
    return TASK_SELECT;
  }

  protected getSearchableFields() {
    return ['title', 'description'];
  }

  protected async getWhereConditions(req: Request) {
    const body = req.body as Record<string, unknown>;
    const where: Record<string, unknown> = {};
    if (body['status']) where['status'] = body['status'];
    if (body['priority']) where['priority'] = body['priority'];
    if (body['assigneeId']) where['assigneeId'] = body['assigneeId'];
    if (body['projectId']) where['projectId'] = body['projectId'];
    return where;
  }

  protected async getAccessScope(req: Request) {
    if (req.user!.role === 'MEMBER') {
      return { assigneeId: req.user!.sub };
    }
    return {};
  }

  protected async beforeSave(
    data: Record<string, unknown>,
    method: 'create' | 'update',
    req: Request,
  ) {
    if (
      method === 'update' &&
      req.user!.role === 'MEMBER' &&
      (data['assigneeId'] !== undefined || data['projectId'] !== undefined)
    ) {
      throw ApiError.forbidden('Members cannot reassign or move tasks');
    }

    if (method === 'create' || data['projectId'] !== undefined) {
      const project = await prisma.project.findUnique({
        where: { id: data['projectId'] as string },
        select: { id: true },
      });
      if (!project) throw ApiError.badRequest('projectId does not reference an existing project');
    }
    if (typeof data['assigneeId'] === 'string') {
      const assignee = await prisma.user.findUnique({
        where: { id: data['assigneeId'] },
        select: { id: true },
      });
      if (!assignee) throw ApiError.badRequest('assigneeId does not reference an existing user');
    }
  }

  protected async transformData(
    data: Record<string, unknown>,
    method: 'create' | 'update',
    req: Request,
  ) {
    if (method === 'create') {
      return { ...data, createdById: req.user!.sub };
    }
    return data;
  }

  async index(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const assignee = this.cacheAssignee(req);
      const filters = this.cacheFilters(req);

      if (assignee) {
        const cached = await getTaskCache(assignee, filters);
        if (cached) {
          res.status(200).json(cached);
          return;
        }
      }

      const { data, page, limit, total } = await this.listPage(req);
      const payload = this.paginatedPayload(data, { page, limit, total });

      if (assignee) await setTaskCache(assignee, filters, payload);
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  private cacheAssignee(req: Request): string | null {
    if (req.user!.role === 'MEMBER') return req.user!.sub;
    const filterAssignee = (req.body as Record<string, unknown>)['assigneeId'];
    return typeof filterAssignee === 'string' ? filterAssignee : null;
  }

  private cacheFilters(req: Request): Record<string, unknown> {
    const b = req.body as Record<string, unknown>;
    return {
      page: b['page'] ?? null,
      limit: b['limit'] ?? null,
      status: b['status'] ?? null,
      priority: b['priority'] ?? null,
      projectId: b['projectId'] ?? null,
      search: b['search'] ?? null,
      orderBy: b['orderBy'] ?? null,
      order: b['order'] ?? null,
    };
  }

  protected async afterCreate(record: unknown) {
    await this.invalidateFor(record);
  }

  protected async afterUpdate(record: unknown, _req: Request, previous?: unknown) {
    await this.invalidateFor(record);
    await this.invalidateFor(previous);
  }

  protected async afterDestroy(record: unknown) {
    await this.invalidateFor(record);
  }

  private async invalidateFor(record: unknown) {
    const assigneeId = (record as { assigneeId?: string | null } | null)?.assigneeId;
    if (assigneeId) await invalidateTaskCache(assigneeId);
  }

  updateStatus = async (req: Request, res: Response): Promise<void> => {
    const id = req.params['id'] as string;
    const next = (req.body as { status: TaskStatus }).status;

    const task = await prisma.task.findUnique({
      where: { id },
      select: { id: true, status: true, assigneeId: true },
    });
    if (!task) throw ApiError.notFound('Task');

    const isManager = req.user!.role === 'ADMIN' || req.user!.role === 'MANAGER';
    const isAssignee = task.assigneeId === req.user!.sub;
    if (!isManager && !isAssignee) {
      throw ApiError.forbidden('Only the assignee or a manager can change a task status');
    }

    if (!TRANSITIONS[task.status].includes(next)) {
      throw new ApiError(
        409,
        'INVALID_TRANSITION',
        `Cannot transition task from ${task.status} to ${next}`,
        { from: task.status, to: next, allowed: TRANSITIONS[task.status] },
      );
    }

    const updated = await prisma.task.update({
      where: { id },
      data: { status: next, completedAt: next === 'DONE' ? new Date() : null },
      select: TASK_SELECT,
    });
    await this.invalidateFor(updated);

    await publishTaskEvent(updated.assigneeId, 'task.status', {
      taskId: updated.id,
      title: updated.title,
      from: task.status,
      to: next,
      projectId: updated.projectId,
    });

    this.ok(res, updated);
  };
}
