import type { Application } from 'express';
import { Router as ExpressRouter } from 'express';
import type { BaseApiRoutes } from './BaseApiRoutes.js';

export class Router {
  private readonly router: ExpressRouter;

  constructor(private readonly routes: BaseApiRoutes[]) {
    this.router = ExpressRouter();
    for (const route of routes) {
      this.router.use(route.router);
    }
  }

  mount(app: Application, prefix: string): void {
    app.use(prefix, this.router);
  }
}
