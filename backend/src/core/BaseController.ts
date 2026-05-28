import type { NextFunction, Request, Response } from 'express';

export abstract class BaseController {
  index(_req: Request, _res: Response, _next: NextFunction): void {
    _next(new Error('index not implemented'));
  }

  show(_req: Request, _res: Response, _next: NextFunction): void {
    _next(new Error('show not implemented'));
  }

  create(_req: Request, _res: Response, _next: NextFunction): void {
    _next(new Error('create not implemented'));
  }

  update(_req: Request, _res: Response, _next: NextFunction): void {
    _next(new Error('update not implemented'));
  }

  destroy(_req: Request, _res: Response, _next: NextFunction): void {
    _next(new Error('destroy not implemented'));
  }

  protected ok<T>(res: Response, data: T) {
    return res.status(200).json({ status: 200, data });
  }

  protected created<T>(res: Response, data: T) {
    return res.status(201).json({ status: 201, data });
  }

  protected noContent(res: Response) {
    return res.status(204).send();
  }

  protected paginated<T>(
    res: Response,
    data: T[],
    meta: { page: number; limit: number; total: number },
  ) {
    return res.status(200).json({
      status: 200,
      data,
      meta: {
        ...meta,
        totalPages: Math.ceil(meta.total / meta.limit),
        hasNext: meta.page * meta.limit < meta.total,
        hasPrev: meta.page > 1,
      },
    });
  }
}
