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

  protected async beforeAll(req: Request): Promise<void> {
    if (req.method !== 'DELETE') return;
    const id = req.params['id'] as string;
    if (!id) return;

    if (id === req.user?.sub) {
      throw ApiError.badRequest('You cannot delete your own account');
    }

    const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (!target) return;

    if (target.role === 'ADMIN') {
      const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
      if (adminCount <= 1) {
        throw ApiError.badRequest('Cannot delete the last admin account');
      }
    }

    const projectCount = await prisma.project.count({ where: { createdById: id } });
    if (projectCount > 0) {
      throw ApiError.conflict(
        `This user owns ${projectCount} project(s). Reassign or delete them first.`,
      );
    }
  }

  protected async afterDestroy(record: unknown): Promise<void> {
    const { id } = record as { id: string };
    await prisma.refreshToken.updateMany({
      where: { userId: id },
      data: { revokedAt: new Date() },
    });
  }

  protected async beforeSave(
    data: Record<string, unknown>,
    _method: 'create' | 'update',
    req: Request,
  ) {
    if (typeof data['email'] === 'string') {
      const existing = await prisma.user.findUnique({
        where: { email: data['email'] as string },
        select: { id: true },
      });
      const targetId = req.params['id'] as string | undefined;
      if (existing && existing.id !== targetId) {
        throw ApiError.conflict('Email already in use');
      }
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
