import { BaseApiRoutes } from '../../core/BaseApiRoutes.js';
import { AnalyticsController } from './analytics.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';

export class AnalyticsRouter extends BaseApiRoutes {
  constructor() {
    super('/analytics');
  }

  protected initializeRoutes(): void {
    const controller = new AnalyticsController();

    this.addRoute({
      method: 'get',
      path: `${this.basePath}/overview`,
      handler: controller.overview,
      middleware: [authenticate, requireRole('ADMIN', 'MANAGER')],
    });
  }
}
