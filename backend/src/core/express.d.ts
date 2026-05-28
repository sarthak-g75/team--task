import type { JwtPayload } from './types.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: JwtPayload;
    id?: string;
  }
}
