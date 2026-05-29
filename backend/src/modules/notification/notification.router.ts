import { BaseApiRoutes } from '../../core/BaseApiRoutes.js';
import { NotificationController } from './notification.controller.js';
import { authenticateSse } from '../../middleware/auth.middleware.js';

export class NotificationRouter extends BaseApiRoutes {
  constructor() {
    super('/notifications');
  }

  protected initializeRoutes(): void {
    const controller = new NotificationController();

    this.addRoute({
      method: 'get',
      path: `${this.basePath}/stream`,
      handler: controller.stream,
      middleware: [authenticateSse],
    });
  }
}
