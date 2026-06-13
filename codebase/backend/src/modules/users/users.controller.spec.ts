import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AUDIT_ACTIONS } from '../audit-logs/audit-action.const';
import { AuthService } from '../auth/auth.service';
import type { JwtPayload } from '../../common/decorators';
import type { User } from './entities/user.entity';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;
  let auditLogsService: AuditLogsService;
  let authService: AuthService;

  const mockUser: Partial<User> = {
    id: 'user-uuid',
    email: 'test@example.com',
    name: 'Test User',
    avatarUrl: undefined,
    locale: 'ko',
    theme: 'light',
    passwordHash: 'hashed-secret',
    twoFactorSecret: 'totp-secret',
  };

  const payload: JwtPayload = {
    sub: 'user-uuid',
    email: 'test@example.com',
    workspaceId: 'ws-uuid',
    role: 'owner',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            findById: jest.fn(),
            update: jest.fn(),
            changePassword: jest.fn(),
          },
        },
        {
          provide: AuditLogsService,
          useValue: { record: jest.fn() },
        },
        {
          provide: AuthService,
          useValue: { rotateSessionAfterPasswordChange: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('') },
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
    auditLogsService = module.get<AuditLogsService>(AuditLogsService);
    authService = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getMe', () => {
    it('should return current user profile', async () => {
      jest.spyOn(service, 'findById').mockResolvedValue(mockUser as User);

      const result = await controller.getMe(payload);
      expect(result).toEqual({
        data: {
          id: 'user-uuid',
          email: 'test@example.com',
          name: 'Test User',
          avatarUrl: undefined,
          locale: 'ko',
          theme: 'light',
        },
      });

      expect(service.findById).toHaveBeenCalledWith('user-uuid');
    });

    it('should not expose sensitive fields', async () => {
      jest.spyOn(service, 'findById').mockResolvedValue(mockUser as User);

      const result = await controller.getMe(payload);
      expect(result.data).not.toHaveProperty('passwordHash');
      expect(result.data).not.toHaveProperty('twoFactorSecret');
    });

    it('should throw NotFoundException when user not found', async () => {
      jest.spyOn(service, 'findById').mockResolvedValue(null);

      await expect(controller.getMe(payload)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should propagate service errors', async () => {
      jest
        .spyOn(service, 'findById')
        .mockRejectedValue(new Error('DB connection error'));

      await expect(controller.getMe(payload)).rejects.toThrow(
        'DB connection error',
      );
    });

    it('should apply default values for locale and theme', async () => {
      const userWithNulls: Partial<User> = {
        ...mockUser,
        locale: undefined,
        theme: undefined,
      };
      jest.spyOn(service, 'findById').mockResolvedValue(userWithNulls as User);

      const result = await controller.getMe(payload);
      expect(result.data.locale).toBe('ko');
      expect(result.data.theme).toBe('light');
    });
  });

  describe('updateMe', () => {
    it('should update name/locale/theme and return updated profile', async () => {
      const updatedUser = {
        ...mockUser,
        name: 'Renamed',
        locale: 'en',
        theme: 'dark',
      } as User;
      jest.spyOn(service, 'findById').mockResolvedValue(mockUser as User);
      jest.spyOn(service, 'update').mockResolvedValue(updatedUser);

      const result = await controller.updateMe(payload, {
        name: 'Renamed',
        locale: 'en',
        theme: 'dark',
      });

      expect(service.update).toHaveBeenCalledWith('user-uuid', {
        name: 'Renamed',
        locale: 'en',
        theme: 'dark',
      });
      expect(result).toEqual({
        data: {
          id: 'user-uuid',
          email: 'test@example.com',
          name: 'Renamed',
          avatarUrl: undefined,
          locale: 'en',
          theme: 'dark',
        },
      });
    });

    it('should not expose sensitive fields on update', async () => {
      jest.spyOn(service, 'findById').mockResolvedValue(mockUser as User);
      jest.spyOn(service, 'update').mockResolvedValue(mockUser as User);

      const result = await controller.updateMe(payload, { name: 'Who' });
      expect(result.data).not.toHaveProperty('passwordHash');
      expect(result.data).not.toHaveProperty('twoFactorSecret');
    });

    it('should throw NotFoundException when user missing', async () => {
      jest.spyOn(service, 'findById').mockResolvedValue(null);

      await expect(
        controller.updateMe(payload, { name: 'Nope' }),
      ).rejects.toThrow(NotFoundException);
      expect(service.update).not.toHaveBeenCalled();
    });

    it('should accept an empty patch as a no-op update', async () => {
      jest.spyOn(service, 'findById').mockResolvedValue(mockUser as User);
      jest.spyOn(service, 'update').mockResolvedValue(mockUser as User);

      await controller.updateMe(payload, {});
      expect(service.update).toHaveBeenCalledWith('user-uuid', {});
    });
  });

  describe('changePassword', () => {
    const strongNewPassword = 'N3wP@ssw0rd!';
    // extractClientIp: CF-신뢰 off 기본이라 X-Forwarded-For 첫 IP 를 읽는다.
    const mockReq = {
      headers: { 'user-agent': 'jest-agent', 'x-forwarded-for': '9.9.9.9' },
      ip: '9.9.9.9',
      socket: {},
    } as never;
    const mockRes = { cookie: jest.fn() } as never;

    beforeEach(() => {
      (mockRes as unknown as { cookie: jest.Mock }).cookie.mockClear();
    });

    it('delegates to UsersService, rotates session, sets cookie, audits with ipAddress, returns accessToken', async () => {
      const changeSpy = jest
        .spyOn(service, 'changePassword')
        .mockResolvedValue(undefined);
      const rotateSpy = jest
        .spyOn(authService, 'rotateSessionAfterPasswordChange')
        .mockResolvedValue({ accessToken: 'new-at', refreshToken: 'new-rt' });

      const result = await controller.changePassword(
        payload,
        { currentPassword: 'OldP@ssw0rd1', newPassword: strongNewPassword },
        mockReq,
        mockRes,
      );

      // 도메인 로직은 service 위임 (refactor 04 B-2)
      expect(changeSpy).toHaveBeenCalledWith(
        'user-uuid',
        'OldP@ssw0rd1',
        strongNewPassword,
      );
      // 세션 회전 위임 (옵션 B, Rationale 2.3.C) — ctx 에 ip·userAgent 전달
      expect(rotateSpy).toHaveBeenCalledWith('user-uuid', {
        ip: '9.9.9.9',
        userAgent: 'jest-agent',
      });
      // refresh 쿠키 회전
      expect(
        (mockRes as unknown as { cookie: jest.Mock }).cookie,
      ).toHaveBeenCalledTimes(1);
      // 새 access token 반환
      expect(result).toEqual({ data: { accessToken: 'new-at' } });

      // [Spec Auth §4.1 / Rationale 4.1.B] 액터 세션 workspaceId 귀속 + ipAddress 동반(B-1)
      expect(auditLogsService.record).toHaveBeenCalledWith({
        workspaceId: 'ws-uuid',
        userId: 'user-uuid',
        action: AUDIT_ACTIONS.USER_PASSWORD_CHANGED,
        resourceType: 'user',
        resourceId: 'user-uuid',
        ipAddress: '9.9.9.9',
      });
    });

    it('does not rotate session or record audit when password change fails', async () => {
      jest
        .spyOn(service, 'changePassword')
        .mockRejectedValue(
          new UnauthorizedException({ code: 'INVALID_PASSWORD' }),
        );
      const rotateSpy = jest.spyOn(
        authService,
        'rotateSessionAfterPasswordChange',
      );

      await expect(
        controller.changePassword(
          payload,
          { currentPassword: 'WrongPass1!', newPassword: strongNewPassword },
          mockReq,
          mockRes,
        ),
      ).rejects.toThrow(UnauthorizedException);

      expect(rotateSpy).not.toHaveBeenCalled();
      expect(auditLogsService.record).not.toHaveBeenCalled();
      expect(
        (mockRes as unknown as { cookie: jest.Mock }).cookie,
      ).not.toHaveBeenCalled();
    });
  });
});
