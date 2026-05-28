import type { PrismaClient } from '@prisma/client';
import { ApiError } from '../../core/ApiError.js';
import { hashPassword, comparePassword } from '../../utils/password.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt.js';
import { env } from '../../config/env.js';

export class AuthService {
  constructor(private readonly prisma: PrismaClient) {}

  async register(data: {
    organizationName: string;
    name: string;
    email: string;
    password: string;
  }) {
    const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw ApiError.conflict('Email already in use');

    const slug = data.organizationName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const count = await this.prisma.organization.count({ where: { slug } });
    const finalSlug = count > 0 ? `${slug}-${Date.now()}` : slug;

    const passwordHash = await hashPassword(data.password);

    return this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        role: 'ADMIN',
        organization: {
          create: { name: data.organizationName, slug: finalSlug },
        },
      },
      select: { id: true, email: true, name: true, role: true, organizationId: true },
    });
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        organizationId: true,
        passwordHash: true,
      },
    });

    if (!user || !(await comparePassword(password, user.passwordHash))) {
      throw ApiError.unauthorized('Invalid credentials');
    }

    const accessToken = signAccessToken({
      sub: user.id,
      role: user.role,
      orgId: user.organizationId,
    });
    const refreshToken = signRefreshToken(user.id);

    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const { passwordHash: _, ...safeUser } = user;
    return { accessToken, refreshToken, user: safeUser };
  }

  async refresh(token: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token },
      include: { user: { select: { id: true, role: true, organizationId: true } } },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      if (stored && !stored.revokedAt) {
        await this.prisma.refreshToken.updateMany({
          where: { userId: stored.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      throw ApiError.unauthorized('Invalid refresh token');
    }

    try {
      verifyRefreshToken(token);
    } catch {
      throw ApiError.unauthorized('Invalid refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const newRefresh = signRefreshToken(stored.userId);
    await this.prisma.refreshToken.create({
      data: {
        token: newRefresh,
        userId: stored.userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const accessToken = signAccessToken({
      sub: stored.user.id,
      role: stored.user.role,
      orgId: stored.user.organizationId,
    });

    return { accessToken, refreshToken: newRefresh };
  }

  async logout(token: string) {
    await this.prisma.refreshToken.updateMany({
      where: { token, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  refreshCookieOptions() {
    return {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/auth/refresh',
    };
  }
}
