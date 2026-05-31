import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthOauthService } from './auth-oauth.service';
import { TotpService } from './totp.service';
import { UsersService } from '../users/users.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;
  let oauthService: jest.Mocked<AuthOauthService>;
  let totpService: jest.Mocked<TotpService>;
  let usersService: jest.Mocked<UsersService>;

  const mockRes = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
    redirect: jest.fn(),
    setHeader: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'app.frontendUrl') return 'http://frontend.test';
      return '';
    }),
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    authService = {
      refresh: jest.fn(),
      logout: jest.fn(),
    } as unknown as jest.Mocked<AuthService>;

    oauthService = {
      beginAuth: jest.fn(),
      handleCallback: jest.fn(),
      getEnabledProviders: jest.fn(),
    } as unknown as jest.Mocked<AuthOauthService>;

    totpService = {
      setup: jest.fn(),
      verifyAndEnable: jest.fn(),
      verifyForLogin: jest.fn(),
      disable: jest.fn(),
    } as unknown as jest.Mocked<TotpService>;

    usersService = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    controller = new AuthController(
      authService,
      mockConfigService,
      oauthService,
      totpService,
      usersService,
    );
  });

  describe('refresh', () => {
    it('should throw UnauthorizedException when no cookie token provided', async () => {
      const req = { cookies: {} } as never;
      await expect(controller.refresh(req, mockRes as never)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when cookies object is missing', async () => {
      const req = {} as never;
      await expect(controller.refresh(req, mockRes as never)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should refresh tokens when cookie contains valid token', async () => {
      const req = { cookies: { refreshToken: 'valid-token' } } as never;
      authService.refresh.mockResolvedValue({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
      });

      const result = await controller.refresh(req, mockRes as never);

      expect(authService.refresh).toHaveBeenCalledWith(
        'valid-token',
        expect.objectContaining({ ip: null, userAgent: null }),
      );
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

  describe('getOauthProviders', () => {
    // Cache-Control header is applied via @Header() decorator and verified
    // implicitly by NestJS — controller method just returns the payload.
    it('returns enabled providers', () => {
      oauthService.getEnabledProviders.mockReturnValue(['google']);
      expect(controller.getOauthProviders()).toEqual({
        data: { providers: ['google'] },
      });
    });

    it('returns empty list when no providers are configured', () => {
      oauthService.getEnabledProviders.mockReturnValue([]);
      expect(controller.getOauthProviders()).toEqual({
        data: { providers: [] },
      });
    });
  });

  describe('beginOauth', () => {
    it('redirects to the provider authorize URL', async () => {
      oauthService.beginAuth.mockResolvedValue({
        authUrl: 'https://provider/auth',
      });
      await controller.beginOauth(
        'google',
        'register',
        'true',
        mockRes as never,
      );
      expect(oauthService.beginAuth).toHaveBeenCalledWith('google', {
        mode: 'register',
        rememberMe: true,
      });
      expect(mockRes.redirect).toHaveBeenCalledWith('https://provider/auth');
    });

    it('defaults mode and rememberMe correctly', async () => {
      oauthService.beginAuth.mockResolvedValue({ authUrl: 'https://p' });
      await controller.beginOauth(
        'github',
        undefined,
        undefined,
        mockRes as never,
      );
      expect(oauthService.beginAuth).toHaveBeenCalledWith('github', {
        mode: 'login',
        rememberMe: false,
      });
    });
  });

  describe('oauthCallback', () => {
    it('redirects with success + token and sets refresh cookie', async () => {
      oauthService.handleCallback.mockResolvedValue({
        accessToken: 'A',
        refreshToken: 'R',
        rememberMe: false,
      });
      await controller.oauthCallback(
        'google',
        'code-1',
        'state-1',
        undefined,
        {} as never,
        mockRes as never,
      );
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'R',
        expect.objectContaining({ httpOnly: true }),
      );
      // decision A — access token 은 URL 에 싣지 않는다. refresh 쿠키만 설정하고
      // 프론트가 /auth/refresh 로 access token 을 발급받는다.
      expect(mockRes.redirect).toHaveBeenCalledWith(
        'http://frontend.test/callback?success=true',
      );
    });

    it('redirects with invalid_state when state or code missing', async () => {
      await controller.oauthCallback(
        'google',
        undefined,
        undefined,
        undefined,
        {} as never,
        mockRes as never,
      );
      expect(mockRes.redirect).toHaveBeenCalledWith(
        'http://frontend.test/callback?error=invalid_state',
      );
    });

    it('redirects with token_exchange_failed when provider returned error', async () => {
      await controller.oauthCallback(
        'google',
        undefined,
        undefined,
        'access_denied',
        {} as never,
        mockRes as never,
      );
      expect(mockRes.redirect).toHaveBeenCalledWith(
        'http://frontend.test/callback?error=token_exchange_failed',
      );
    });

    it('maps OAUTH_EMAIL_REQUIRED to email_required', async () => {
      const err = Object.assign(new Error('x'), {
        response: { code: 'OAUTH_EMAIL_REQUIRED' },
      });
      oauthService.handleCallback.mockRejectedValue(err);
      await controller.oauthCallback(
        'github',
        'c',
        's',
        undefined,
        {} as never,
        mockRes as never,
      );
      expect(mockRes.redirect).toHaveBeenCalledWith(
        'http://frontend.test/callback?error=email_required',
      );
    });

    it('maps OAUTH_STATE_MISMATCH to invalid_state', async () => {
      const err = Object.assign(new Error('x'), {
        response: { code: 'OAUTH_STATE_MISMATCH' },
      });
      oauthService.handleCallback.mockRejectedValue(err);
      await controller.oauthCallback(
        'google',
        'c',
        's',
        undefined,
        {} as never,
        mockRes as never,
      );
      expect(mockRes.redirect).toHaveBeenCalledWith(
        'http://frontend.test/callback?error=invalid_state',
      );
    });

    it('falls back to server_error for unknown errors', async () => {
      oauthService.handleCallback.mockRejectedValue(new Error('boom'));
      await controller.oauthCallback(
        'google',
        'c',
        's',
        undefined,
        {} as never,
        mockRes as never,
      );
      expect(mockRes.redirect).toHaveBeenCalledWith(
        'http://frontend.test/callback?error=server_error',
      );
    });
  });
});
