import type { NextFunction, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

export function requestId(req: Request, res: Response, next: NextFunction) {
  const id = (req.headers['x-request-id'] as string | undefined) ?? uuidv4();
  req.id = id;
  res.setHeader('x-request-id', id);
  next();
}
