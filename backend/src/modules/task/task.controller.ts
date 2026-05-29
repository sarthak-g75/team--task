import type { Request, Response } from 'express';
import type { TaskStatus } from '@prisma/client';
import { BaseController } from '../../core/BaseController.js';
import { ApiError } from '../../core/ApiError.js';
import { prisma } from '../../config/database.js';

// Allowed status transitions. The happy path is linear
// (TODO → IN_PROGRESS → IN_REVIEW → DONE); BLOCKED is reachable from any
// active state and resumes back into one. DONE is terminal.
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

  /** List filters (status/priority/assignee/project) for the index endpoint. */
  protected async getWhereConditions(req: Request) {
    const body = req.body as Record<string, unknown>;
    const where: Record<string, unknown> = {};
    if (body['status']) where['status'] = body['status'];
    if (body['priority']) where['priority'] = body['priority'];
    if (body['assigneeId']) where['assigneeId'] = body['assigneeId'];
    if (body['projectId']) where['projectId'] = body['projectId'];
    return where;
  }

  /** MEMBERs may only see or mutate tasks assigned to them. */
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
    // MEMBERs may edit their task's details but cannot reassign or move it.
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

  /**
   * PATCH /tasks/:id/status — advance a task through the state machine.
   * Only the assignee or a MANAGER/ADMIN may change a task's status, and only
   * along an allowed transition.
   */
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
      data: { status: next },
      select: TASK_SELECT,
    });
    this.ok(res, updated);
  };
}
