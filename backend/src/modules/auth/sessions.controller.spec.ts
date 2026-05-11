import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { LoginHistoryService } from './login-history.service';
import type { SessionDto } from './dto/responses/session.dto';
import type { LoginHistoryPageDto } from './dto/responses/login-history.dto';

const sample: SessionDto = {
  familyId: 'fam-1',
  deviceLabel: 'Chrome on macOS',
  ipAddress: '203.0.113.7',
  lastUsedAt: '2026-05-12T03:00:00Z',
  createdAt: '2026-05-10T22:00:00Z',
  expiresAt: '2026-05-17T22:00:00Z',
  isCurrent: false,
};

describe('SessionsController', () => {
  let controller: SessionsController;
  let sessionsService: jest.Mocked<SessionsService>;
  let loginHistoryService: jest.Mocked<LoginHistoryService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SessionsController],
      providers: [
        {
          provide: SessionsService,
          useValue: {
            listActiveSessions: jest.fn(),
            revokeFamily: jest.fn(),
            revokeOtherFamilies: jest.fn(),
          },
        },
        {
          provide: LoginHistoryService,
          useValue: { findForUser: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get(SessionsController);
    sessionsService = module.get(SessionsService);
    loginHistoryService = module.get(LoginHistoryService);
  });

  describe('listSessions', () => {
    it('passes through refreshToken cookie to service', async () => {
      sessionsService.listActiveSessions.mockResolvedValue([sample]);
      const req = { cookies: { refreshToken: 'cookie-val' }, headers: {} };

      const result = await controller.listSessions(
        { sub: 'u' } as never,
        req as never,
      );

      expect(result).toEqual({ data: [sample] });
      expect(sessionsService.listActiveSessions).toHaveBeenCalledWith(
        'u',
        'cookie-val',
      );
    });

    it('forwards null when no refresh cookie', async () => {
      sessionsService.listActiveSessions.mockResolvedValue([]);
      await controller.listSessions(
        { sub: 'u' } as never,
        { cookies: {}, headers: {} } as never,
      );
      expect(sessionsService.listActiveSessions).toHaveBeenCalledWith(
        'u',
        null,
      );
    });
  });

  describe('revokeSession', () => {
    it('passes familyId and ctx to service, then returns refreshed list', async () => {
      sessionsService.revokeFamily.mockResolvedValue();
      sessionsService.listActiveSessions.mockResolvedValue([sample]);
      const req = {
        cookies: { refreshToken: 'cookie-val' },
        headers: {
          'user-agent': 'curl/8.4.0',
          'cf-connecting-ip': '198.51.100.9',
        },
      };

      const result = await controller.revokeSession(
        { sub: 'u' } as never,
        'fam-1',
        { password: 'pw' },
        req as never,
      );

      expect(sessionsService.revokeFamily).toHaveBeenCalledWith(
        'u',
        'fam-1',
        { password: 'pw' },
        expect.objectContaining({
          ip: '198.51.100.9',
          userAgent: 'curl/8.4.0',
        }),
        'cookie-val',
      );
      expect(result).toEqual({ data: [sample] });
    });
  });

  describe('revokeOtherSessions', () => {
    it('throws 400 when no current session cookie', async () => {
      const req = { cookies: {}, headers: {} };
      await expect(
        controller.revokeOtherSessions(
          { sub: 'u' } as never,
          { password: 'pw' },
          req as never,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(sessionsService.revokeOtherFamilies).not.toHaveBeenCalled();
    });

    it('proxies to service when cookie is present', async () => {
      sessionsService.revokeOtherFamilies.mockResolvedValue({ revoked: 2 });
      sessionsService.listActiveSessions.mockResolvedValue([sample]);
      const req = {
        cookies: { refreshToken: 'cookie-val' },
        headers: {},
      };

      await controller.revokeOtherSessions(
        { sub: 'u' } as never,
        { password: 'pw' },
        req as never,
      );

      expect(sessionsService.revokeOtherFamilies).toHaveBeenCalledWith(
        'u',
        'cookie-val',
        { password: 'pw' },
        expect.objectContaining({ ip: null, userAgent: null }),
      );
    });
  });

  describe('getLoginHistory', () => {
    const page: LoginHistoryPageDto = {
      data: [
        {
          id: 'h1',
          event: 'login_success',
          ipAddress: '203.0.113.7',
          deviceLabel: 'Chrome on macOS',
          failureReason: null,
          createdAt: '2026-05-12T03:00:00Z',
        },
      ],
      nextCursor: null,
    };

    it('parses limit/cursor and returns the page directly', async () => {
      loginHistoryService.findForUser.mockResolvedValue(page);
      const result = await controller.getLoginHistory(
        { sub: 'u' } as never,
        '25',
        '2026-04-01T00:00:00Z|abc',
      );
      expect(result).toEqual({ data: page });
      expect(loginHistoryService.findForUser).toHaveBeenCalledWith({
        userId: 'u',
        cursor: '2026-04-01T00:00:00Z|abc',
        limit: 25,
      });
    });

    it('drops malformed limit and defaults via service', async () => {
      loginHistoryService.findForUser.mockResolvedValue(page);
      await controller.getLoginHistory({ sub: 'u' } as never, 'abc');
      expect(loginHistoryService.findForUser).toHaveBeenCalledWith(
        expect.objectContaining({ limit: undefined }),
      );
    });
  });
});
