import type { Request, Response } from 'express';
import { BaseController } from '../../core/BaseController.js';
import { AuthService } from './auth.service.js';
import { ApiError } from '../../core/ApiError.js';

export class AuthController extends BaseController {
  constructor(private readonly authService: AuthService) {
    super();
  }

  register = async (req: Request, res: Response) => {
    const user = await this.authService.register(req.body);
    return this.created(res, { user });
  };

  login = async (req: Request, res: Response) => {
    const { accessToken, refreshToken, user } = await this.authService.login(
      req.body.email,
      req.body.password,
    );
    res.cookie('refreshToken', refreshToken, this.authService.refreshCookieOptions());
    return this.ok(res, { accessToken, user });
  };

  refresh = async (req: Request, res: Response) => {
    const token = req.cookies['refreshToken'] as string | undefined;
    if (!token) throw ApiError.unauthorized('No refresh token');
    const { accessToken, refreshToken } = await this.authService.refresh(token);
    res.cookie('refreshToken', refreshToken, this.authService.refreshCookieOptions());
    return this.ok(res, { accessToken });
  };

  logout = async (req: Request, res: Response) => {
    const token = req.cookies['refreshToken'] as string | undefined;
    if (token) await this.authService.logout(token);
    res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
    return this.noContent(res);
  };
}
