import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const mockRes = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  };

  beforeEach(() => {
    authService = {
      refresh: jest.fn(),
      logout: jest.fn(),
    } as unknown as jest.Mocked<AuthService>;

    controller = new AuthController(authService);
  });

  describe('refresh', () => {
    it('should throw UnauthorizedException when no cookie token provided', async () => {
      const req = { cookies: {} } as never;
      await expect(
        controller.refresh(req, mockRes as never),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when cookies object is missing', async () => {
      const req = {} as never;
      await expect(
        controller.refresh(req, mockRes as never),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should refresh tokens when cookie contains valid token', async () => {
      const req = { cookies: { refreshToken: 'valid-token' } } as never;
      authService.refresh.mockResolvedValue({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
      });

      const result = await controller.refresh(req, mockRes as never);

      expect(authService.refresh).toHaveBeenCalledWith('valid-token');
      expect(result).toEqual({
        data: { accessToken: 'new-access' },
      });
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'new-refresh',
        expect.objectContaining({ httpOnly: true, path: '/' }),
      );
    });
  });

  describe('logout', () => {
    it('should clear cookie with path option', async () => {
      const req = { cookies: { refreshToken: 'token' } } as never;
      authService.logout.mockResolvedValue(undefined);

      await controller.logout(req, mockRes as never);

      expect(mockRes.clearCookie).toHaveBeenCalledWith('refreshToken', {
        path: '/',
      });
    });
  });
});
