import type { NextFunction, Request, Response } from 'express';
import { ApiError } from './ApiError.js';

interface PrismaDelegate {
  findMany(args?: Record<string, unknown>): Promise<unknown[]>;
  count(args?: Record<string, unknown>): Promise<number>;
  findUnique(args: Record<string, unknown>): Promise<unknown | null>;
  create(args: Record<string, unknown>): Promise<unknown>;
  update(args: Record<string, unknown>): Promise<unknown>;
  delete(args: Record<string, unknown>): Promise<unknown>;
}

export abstract class BaseController {
  constructor(protected readonly model?: PrismaDelegate) {}

  // ─── Lifecycle hooks (override in subclasses) ────────────────────────────

  protected async beforeAll(_req: Request): Promise<void> {}

  protected async beforeSave(_data: unknown, _method: 'create' | 'update', _req: Request): Promise<void> {}

  protected async afterCreate(_record: unknown, _req: Request): Promise<void> {}

  protected async afterUpdate(_record: unknown, _req: Request): Promise<void> {}

  // ─── Override points ─────────────────────────────────────────────────────

  /** Fields to return. Return undefined for all fields. */
  protected getSelect(): Record<string, boolean> | undefined {
    return undefined;
  }

  /** Prisma include for relations. */
  protected getInclude(): Record<string, boolean> | undefined {
    return undefined;
  }

  /** Fields that support full-text search (req.body.search). */
  protected getSearchableFields(): string[] {
    return [];
  }

  /** Default sort applied when the request does not specify one. */
  protected getDefaultOrderBy(): Record<string, 'asc' | 'desc'> {
    return { createdAt: 'desc' };
  }

  /**
   * Build the Prisma `where` object from the request.
   * Called automatically by index/show/update/destroy.
   * Override to add scoping (e.g. filter by authenticated user, status, etc.)
   */
  protected async getWhereConditions(_req: Request): Promise<Record<string, unknown>> {
    return {};
  }

  /**
   * Transform incoming body before a create or update.
   * Override to hash passwords, set computed fields, etc.
   */
  protected async transformData(
    data: Record<string, unknown>,
    _method: 'create' | 'update',
    _req: Request,
  ): Promise<Record<string, unknown>> {
    return data;
  }

  // ─── Fully-implemented CRUD ───────────────────────────────────────────────

  async index(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!this.model) return next(new Error('index: no model provided'));
    try {
      await this.beforeAll(req);
      const { page, limit, skip } = this.parsePagination(req.body);
      const baseWhere = await this.getWhereConditions(req);
      const search = req.body.search as string | undefined;
      const orderBy = this.parseOrderBy(req) ?? this.getDefaultOrderBy();
      const select = this.getSelect();
      const include = this.getInclude();

      const where = this.buildSearchWhere(baseWhere, search);
      const queryArgs: Record<string, unknown> = { where, skip, take: limit, orderBy };
      if (select) queryArgs['select'] = select;
      if (include && !select) queryArgs['include'] = include;

      const [data, total] = await Promise.all([
        this.model.findMany(queryArgs),
        this.model.count({ where }),
      ]);

      this.paginated(res, data as unknown[], { page, limit, total });
    } catch (err) {
      next(err);
    }
  }

  async show(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!this.model) return next(new Error('show: no model provided'));
    try {
      await this.beforeAll(req);
      const id = req.params['id'] as string;
      const select = this.getSelect();
      const include = this.getInclude();

      const args: Record<string, unknown> = { where: { id } };
      if (select) args['select'] = select;
      if (include && !select) args['include'] = include;

      const record = await this.model.findUnique(args);
      if (!record) throw ApiError.notFound();

      this.ok(res, record);
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!this.model) return next(new Error('create: no model provided'));
    try {
      await this.beforeAll(req);
      const body = req.body as Record<string, unknown>;
      await this.beforeSave(body, 'create', req);
      const data = await this.transformData(body, 'create', req);
      const select = this.getSelect();
      const include = this.getInclude();

      const args: Record<string, unknown> = { data };
      if (select) args['select'] = select;
      if (include && !select) args['include'] = include;

      const record = await this.model.create(args);
      await this.afterCreate(record, req);

      this.created(res, record);
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!this.model) return next(new Error('update: no model provided'));
    try {
      await this.beforeAll(req);
      const id = req.params['id'] as string;
      const existing = await this.model.findUnique({ where: { id } });
      if (!existing) throw ApiError.notFound();

      const body = req.body as Record<string, unknown>;
      await this.beforeSave(body, 'update', req);
      const data = await this.transformData(body, 'update', req);
      const select = this.getSelect();
      const include = this.getInclude();

      const args: Record<string, unknown> = { where: { id }, data };
      if (select) args['select'] = select;
      if (include && !select) args['include'] = include;

      const record = await this.model.update(args);
      await this.afterUpdate(record, req);

      this.ok(res, record);
    } catch (err) {
      next(err);
    }
  }

  async destroy(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!this.model) return next(new Error('destroy: no model provided'));
    try {
      await this.beforeAll(req);
      const id = req.params['id'] as string;
      const existing = await this.model.findUnique({ where: { id } });
      if (!existing) throw ApiError.notFound();

      await this.model.delete({ where: { id } });

      this.noContent(res);
    } catch (err) {
      next(err);
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  protected parsePagination(body: Record<string, unknown>, maxLimit = 100) {
    const page = Math.max(1, Number(body['page']) || 1);
    const limit = Math.min(maxLimit, Math.max(1, Number(body['limit']) || 20));
    const skip = (page - 1) * limit;
    return { page, limit, skip };
  }

  protected parseOrderBy(req: Request): Record<string, 'asc' | 'desc'> | undefined {
    const raw = (req.body as Record<string, unknown>)?.['orderBy'];
    const dir = ((req.body as Record<string, unknown>)?.['order'] as string) === 'asc' ? 'asc' : 'desc';

    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const result: Record<string, 'asc' | 'desc'> = {};
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        result[k] = v === 'asc' ? 'asc' : 'desc';
      }
      return result;
    }

    if (typeof raw === 'string') return { [raw]: dir };

    return undefined;
  }

  private buildSearchWhere(
    base: Record<string, unknown>,
    search?: string,
  ): Record<string, unknown> {
    const fields = this.getSearchableFields();
    if (!search || fields.length === 0) return base;

    return {
      ...base,
      OR: fields.map((f) => ({ [f]: { contains: search, mode: 'insensitive' } })),
    };
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
