import { BaseApiRoutes } from '../../core/BaseApiRoutes.js';
import { TaskController } from './task.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import {
  createTaskSchema,
  updateTaskSchema,
  listTaskSchema,
  transitionStatusSchema,
} from './task.validator.js';

export class TaskRouter extends BaseApiRoutes {
  constructor() {
    super('/tasks');
  }

  protected initializeRoutes(): void {
    const controller = new TaskController();

    this.addRestRoutes(controller, {
      index: [authenticate, validate(listTaskSchema)],
      show: [authenticate],
      create: [authenticate, requireRole('ADMIN', 'MANAGER'), validate(createTaskSchema)],
      update: [authenticate, validate(updateTaskSchema)],
      destroy: [authenticate, requireRole('ADMIN', 'MANAGER')],
    });

    this.addRoute({
      method: 'patch',
      path: `${this.basePath}/:id/status`,
      handler: controller.updateStatus,
      middleware: [authenticate],
      schema: transitionStatusSchema,
    });
  }
}
