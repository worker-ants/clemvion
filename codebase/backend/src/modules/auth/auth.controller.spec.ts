import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthOauthService } from './auth-oauth.service';
import { TotpService } from './totp.service';
import { UsersService } from '../users/users.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AUDIT_ACTIONS } from '../audit-logs/audit-action.const';
import type { JwtPayload } from '../../common/decorators';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;
  let oauthService: jest.Mocked<AuthOauthService>;
  let totpService: jest.Mocked<TotpService>;
  let usersService: jest.Mocked<UsersService>;
  let auditLogsService: jest.Mocked<AuditLogsService>;

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
      resendVerification: jest.fn(),
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

    auditLogsService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditLogsService>;

    controller = new AuthController(
      authService,
      mockConfigService,
      oauthService,
      totpService,
      usersService,
      auditLogsService,
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
        // 04 M-5 — path 를 /api/auth 로 축소(표면 한정). sameSite 는 COOKIE_SAMESITE
        // 기본 none.
        expect.objectContaining({
          httpOnly: true,
          path: '/api/auth',
          sameSite: 'none',
        }),
      );
    });

    // 04 M-5 — CSRF: allowlist 외 Origin 의 강제 refresh 는 403 으로 선차단.
    it('rejects refresh from a disallowed Origin (CSRF defense)', async () => {
      const prev = process.env.CORS_ORIGINS;
      process.env.CORS_ORIGINS = 'https://app.example.com';
      try {
        const req = {
          cookies: { refreshToken: 'valid-token' },
          headers: { origin: 'https://evil.example' },
        } as never;
        await expect(controller.refresh(req, mockRes as never)).rejects.toThrow(
          /Origin not allowed/,
        );
        // 인증 로직 진입 전에 차단되어야 한다.
        expect(authService.refresh).not.toHaveBeenCalled();
      } finally {
        if (prev === undefined) delete process.env.CORS_ORIGINS;
        else process.env.CORS_ORIGINS = prev;
      }
    });

    // 04 후속 — 불투명 'null' Origin(sandbox iframe 등)은 wildcard 모드에서도 거부.
    it('rejects refresh from a null origin (sandbox iframe CSRF)', async () => {
      const prev = process.env.CORS_ORIGINS;
      delete process.env.CORS_ORIGINS; // wildcard 모드라도 'null' 은 거부돼야 함
      const prevFe = process.env.FRONTEND_URL;
      delete process.env.FRONTEND_URL;
      try {
        const req = {
          cookies: { refreshToken: 'valid-token' },
          headers: { origin: 'null' },
        } as never;
        await expect(controller.refresh(req, mockRes as never)).rejects.toThrow(
          /Origin not allowed/,
        );
        expect(authService.refresh).not.toHaveBeenCalled();
      } finally {
        if (prev === undefined) delete process.env.CORS_ORIGINS;
        else process.env.CORS_ORIGINS = prev;
        if (prevFe === undefined) delete process.env.FRONTEND_URL;
        else process.env.FRONTEND_URL = prevFe;
      }
    });

    // 04 M-5 — allowlist 내 Origin 은 정상 통과.
    it('allows refresh from an allowlisted Origin', async () => {
      const prev = process.env.CORS_ORIGINS;
      process.env.CORS_ORIGINS = 'https://app.example.com';
      try {
        authService.refresh.mockResolvedValue({
          accessToken: 'a',
          refreshToken: 'r',
        });
        const req = {
          cookies: { refreshToken: 'valid-token' },
          headers: { origin: 'https://app.example.com' },
        } as never;
        const result = await controller.refresh(req, mockRes as never);
        expect(result).toEqual({ data: { accessToken: 'a' } });
      } finally {
        if (prev === undefined) delete process.env.CORS_ORIGINS;
        else process.env.CORS_ORIGINS = prev;
      }
    });
  });

  describe('resendVerification', () => {
    it('should delegate to authService and wrap the generic message', async () => {
      authService.resendVerification.mockResolvedValue({
        message: 'If an account exists and is not yet verified, ...',
      });

      const result = await controller.resendVerification({
        email: 'user@example.com',
      });

      expect(authService.resendVerification).toHaveBeenCalledWith(
        'user@example.com',
      );
      expect(result).toEqual({
        data: {
          message: 'If an account exists and is not yet verified, ...',
        },
      });
    });
  });

  describe('logout', () => {
    it('should clear cookie with path option', async () => {
      const req = { cookies: { refreshToken: 'token' } } as never;
      authService.logout.mockResolvedValue(undefined);

      await controller.logout(req, mockRes as never);

      expect(mockRes.clearCookie).toHaveBeenCalledWith('refreshToken', {
        path: '/api/auth',
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

  // [Spec Auth §4.1 / Rationale 4.1.B] 2FA enable/disable 감사 — 액터의 현재
  // 세션 workspaceId 에 귀속.
  describe('2FA audit logging', () => {
    const payload: JwtPayload = {
      sub: 'user-uuid',
      email: 'u@example.com',
      workspaceId: 'ws-uuid',
      role: 'owner',
    };

    it('records user.2fa_enabled on verify2fa', async () => {
      totpService.verifyAndEnable.mockResolvedValue({
        recoveryCodes: ['a', 'b'],
      });

      await controller.verify2fa(payload, { code: '123456' });

      expect(totpService.verifyAndEnable).toHaveBeenCalledWith(
        'user-uuid',
        '123456',
      );
      expect(auditLogsService.record).toHaveBeenCalledWith({
        workspaceId: 'ws-uuid',
        userId: 'user-uuid',
        action: AUDIT_ACTIONS.USER_2FA_ENABLED,
        resourceType: 'user',
        resourceId: 'user-uuid',
        details: { method: 'totp' },
      });
    });

    it('does not record an audit log when verify2fa code is invalid', async () => {
      totpService.verifyAndEnable.mockRejectedValue(
        new UnauthorizedException('TOTP_INVALID'),
      );

      await expect(
        controller.verify2fa(payload, { code: '000000' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(auditLogsService.record).not.toHaveBeenCalled();
    });

    it('records user.2fa_disabled on disable2fa after password reconfirm', async () => {
      usersService.findById.mockResolvedValue({
        id: 'user-uuid',
        passwordHash: await bcrypt.hash('OldP@ssw0rd1', 4),
      } as never);
      totpService.disable.mockResolvedValue(undefined);

      await controller.disable2fa(payload, { password: 'OldP@ssw0rd1' });

      expect(totpService.disable).toHaveBeenCalledWith('user-uuid');
      expect(auditLogsService.record).toHaveBeenCalledWith({
        workspaceId: 'ws-uuid',
        userId: 'user-uuid',
        action: AUDIT_ACTIONS.USER_2FA_DISABLED,
        resourceType: 'user',
        resourceId: 'user-uuid',
        details: { method: 'totp' },
      });
    });

    it('does not record an audit log when disable2fa password is wrong', async () => {
      usersService.findById.mockResolvedValue({
        id: 'user-uuid',
        passwordHash: await bcrypt.hash('OldP@ssw0rd1', 4),
      } as never);

      await expect(
        controller.disable2fa(payload, { password: 'WrongPass!' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(totpService.disable).not.toHaveBeenCalled();
      expect(auditLogsService.record).not.toHaveBeenCalled();
    });
  });
});
