import { Router } from 'express';
import type { RequestHandler } from 'express';
import type { ZodSchema } from 'zod';
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

export abstract class BaseRouter {
  readonly router: Router;

  constructor() {
    this.router = Router();
    this.register();
  }

  protected abstract register(): void;

  protected addRoute(def: RouteDefinition) {
    const middlewares: RequestHandler[] = [...(def.middleware ?? [])];
    if (def.schema) {
      middlewares.push(validate(def.schema));
    }
    this.router[def.method](
      def.path,
      ...middlewares,
      asyncHandler(def.handler as Parameters<typeof asyncHandler>[0]),
    );
  }
}
