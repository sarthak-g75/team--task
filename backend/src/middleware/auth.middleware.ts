import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../core/ApiError.js';
import { verifyAccessToken } from '../utils/jwt.js';

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw ApiError.unauthorized();
  }
  const token = header.slice(7);
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    throw ApiError.unauthorized('Invalid or expired token');
  }
}

export function authenticateSse(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const queryToken = req.query['access_token'];
  const token =
    typeof queryToken === 'string'
      ? queryToken
      : header?.startsWith('Bearer ')
        ? header.slice(7)
        : undefined;

  if (!token) {
    throw ApiError.unauthorized();
  }
  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    throw ApiError.unauthorized('Invalid or expired token');
  }
}
