import type { Role } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  role: Role;
  orgId: string;
  iat?: number;
  exp?: number;
}

export type AuthenticatedRequest = import('express').Request & {
  user: JwtPayload;
};
