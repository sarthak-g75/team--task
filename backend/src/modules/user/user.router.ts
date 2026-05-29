import { BaseApiRoutes } from '../../core/BaseApiRoutes.js';
import { UserController } from './user.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { createUserSchema, updateUserSchema, listUserSchema } from './user.validator.js';

export class UserRouter extends BaseApiRoutes {
  constructor() {
    super('/users');
  }

  protected initializeRoutes(): void {
    const controller = new UserController();

    this.addRestRoutes(controller, {
      index: [authenticate, requireRole('ADMIN'), validate(listUserSchema)],
      show: [authenticate, requireRole('ADMIN', 'MANAGER')],
      create: [authenticate, requireRole('ADMIN'), validate(createUserSchema)],
      update: [authenticate, requireRole('ADMIN'), validate(updateUserSchema)],
      destroy: [authenticate, requireRole('ADMIN')],
    });
  }
}
