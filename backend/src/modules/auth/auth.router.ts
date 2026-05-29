import { BaseApiRoutes } from '../../core/BaseApiRoutes.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { prisma } from '../../config/database.js';
import { loginSchema, registerSchema } from './auth.validator.js';

export class AuthRouter extends BaseApiRoutes {
  constructor() {
    super('/auth');
  }

  protected initializeRoutes(): void {
    const controller = new AuthController(new AuthService(prisma));

    this.addRoute({
      method: 'post',
      path: `${this.basePath}/register`,
      handler: controller.register,
      schema: registerSchema,
    });

    this.addRoute({
      method: 'post',
      path: `${this.basePath}/login`,
      handler: controller.login,
      schema: loginSchema,
    });

    this.addRoute({
      method: 'post',
      path: `${this.basePath}/refresh`,
      handler: controller.refresh,
    });

    this.addRoute({
      method: 'post',
      path: `${this.basePath}/logout`,
      handler: controller.logout,
      middleware: [authenticate],
    });
  }
}
