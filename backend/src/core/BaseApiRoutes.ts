import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { ZodSchema } from 'zod';
import type { BaseController } from './BaseController.js';
import { asyncHandler } from './asyncHandler.js';
import { validate } from '../middleware/validate.middleware.js';

interface RouteValidation {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

interface RouteDefinition {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  handler: RequestHandler;
  middleware?: RequestHandler[];
  schema?: RouteValidation;
}

type CrudMiddlewares = Partial<
  Record<'index' | 'show' | 'create' | 'update' | 'destroy', RequestHandler[]>
>;

export abstract class BaseApiRoutes {
  public readonly router: Router;
  protected readonly basePath: string;

  constructor(basePath: string) {
    this.router = Router({ mergeParams: true });
    this.basePath = basePath;
    this.initializeRoutes();
  }

  protected abstract initializeRoutes(): void;

  protected addRestRoutes(controller: BaseController, middlewares: CrudMiddlewares = {}): void {
    if (middlewares.index) {
      this.router.post(
        `${this.basePath}/all`,
        ...middlewares.index,
        asyncHandler(controller.index.bind(controller)),
      );
    }

    if (middlewares.show) {
      this.router.get(
        `${this.basePath}/:id`,
        ...middlewares.show,
        asyncHandler(controller.show.bind(controller)),
      );
    }

    if (middlewares.create) {
      this.router.post(
        this.basePath,
        ...middlewares.create,
        asyncHandler(controller.create.bind(controller)),
      );
    }

    if (middlewares.update) {
      this.router.put(
        `${this.basePath}/:id`,
        ...middlewares.update,
        asyncHandler(controller.update.bind(controller)),
      );
    }

    if (middlewares.destroy) {
      this.router.delete(
        `${this.basePath}/:id`,
        ...middlewares.destroy,
        asyncHandler(controller.destroy.bind(controller)),
      );
    }
  }

  protected addRoute(def: RouteDefinition): void {
    const middlewares: RequestHandler[] = [...(def.middleware ?? [])];
    if (def.schema) middlewares.push(validate(def.schema));
    this.router[def.method](
      def.path,
      ...middlewares,
      asyncHandler(def.handler),
    );
  }
}
