import type { Request } from 'express';
import { BaseController } from '../../core/BaseController.js';
import { prisma } from '../../config/database.js';

export class ProjectController extends BaseController {
  constructor() {
    super(prisma.project);
  }

  protected getSelect() {
    return {
      id: true,
      name: true,
      description: true,
      createdById: true,
      createdAt: true,
      updatedAt: true,
    };
  }

  protected getSearchableFields() {
    return ['name', 'description'];
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
}
