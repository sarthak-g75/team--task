import { BaseApiRoutes } from '../../core/BaseApiRoutes.js';
import { ProjectController } from './project.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { createProjectSchema, updateProjectSchema, listProjectSchema } from './project.validator.js';

export class ProjectRouter extends BaseApiRoutes {
  constructor() {
    super('/projects');
  }

  protected initializeRoutes(): void {
    const controller = new ProjectController();

    this.addRestRoutes(controller, {
      index: [authenticate, validate(listProjectSchema)],
      show: [authenticate],
      create: [authenticate, requireRole('ADMIN', 'MANAGER'), validate(createProjectSchema)],
      update: [authenticate, requireRole('ADMIN', 'MANAGER'), validate(updateProjectSchema)],
      destroy: [authenticate, requireRole('ADMIN', 'MANAGER')],
    });
  }
}
