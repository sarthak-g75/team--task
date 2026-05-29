import type { Request } from 'express';
import type { Role } from '@prisma/client';
import { BaseController } from '../../core/BaseController.js';
import { ApiError } from '../../core/ApiError.js';
import { hashPassword } from '../../utils/password.js';
import { prisma } from '../../config/database.js';

export class UserController extends BaseController {
  constructor() {
    super(prisma.user);
  }

  protected getSelect() {
    return { id: true, name: true, email: true, role: true, createdAt: true };
  }

  protected getSearchableFields() {
    return ['name', 'email'];
  }

  protected async getWhereConditions(req: Request) {
    const role = (req.body as Record<string, unknown>)['role'] as Role | undefined;
    return role !== undefined ? { role } : {};
  }

  protected async beforeSave(data: Record<string, unknown>, method: 'create' | 'update') {
    if (method === 'create') {
      const existing = await this.model!.findUnique({ where: { email: data['email'] } });
      if (existing) throw ApiError.conflict('Email already in use');
    }
  }

  protected async transformData(data: Record<string, unknown>, method: 'create' | 'update') {
    const hasPassword = typeof data['password'] === 'string' && data['password'].length > 0;
    if (method === 'create' || (method === 'update' && hasPassword)) {
      const { password, ...rest } = data;
      return { ...rest, passwordHash: await hashPassword(password as string) };
    }
    return data;
  }
}
