import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebAuthnController } from './webauthn.controller';
import { WebAuthnService } from './webauthn.service';
import { AuthService } from '../auth.service';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';
import { AUDIT_ACTIONS } from '../../audit-logs/audit-action.const';
import type { JwtPayload } from '../../../common/decorators';

describe('WebAuthnController (audit)', () => {
  let controller: WebAuthnController;
  let authService: jest.Mocked<AuthService>;
  let webauthnService: jest.Mocked<WebAuthnService>;
  let auditLogsService: jest.Mocked<AuditLogsService>;

  const payload: JwtPayload = {
    sub: 'user-uuid',
    email: 'u@example.com',
    workspaceId: 'ws-uuid',
    role: 'owner',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // 테스트 격리: CF 신뢰 env leak 시 extractClientIp 가 cf-connecting-ip 를 우선해
    // ipAddress 단언이 깨질 수 있으므로 off(부재) 상태로 고정한다.
    delete process.env.TRUST_CF_CONNECTING_IP;

    authService = {
      verifyPasswordForUser: jest.fn(),
    } as unknown as jest.Mocked<AuthService>;

    webauthnService = {
      verifyRegistration: jest.fn(),
      deleteCredential: jest.fn(),
      regenerateRecoveryCodes: jest.fn(),
      listCredentials: jest.fn(),
    } as unknown as jest.Mocked<WebAuthnService>;

    auditLogsService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditLogsService>;

    const configService = {
      get: jest.fn().mockReturnValue(''),
    } as unknown as ConfigService;

    controller = new WebAuthnController(
      authService,
      webauthnService,
      configService,
      auditLogsService,
    );
  });

  // extractClientIp: CF-신뢰 off 기본 → X-Forwarded-For 첫 IP.
  const mockReq = {
    headers: { 'x-forwarded-for': '7.7.7.7' },
    ip: '7.7.7.7',
    socket: {},
  } as never;

  // credential 목록 응답 shape 고정 — `{ data: { items: [] } }` 는 sessions·webauthn 양쪽의
  // 백엔드·프런트가 의존하는 load-bearing 계약이라 bare array 로 낮추면 안 된다
  // (spec `5-system/2-api-convention.md §5.2`, `5-system/1-auth.md`). `SessionsController.listSessions`
  // 는 `sessions.controller.spec.ts` 가 동형으로 고정 중 — 그 대칭을 맞춘다.
  describe('webauthnList', () => {
    it('returns { data: { items } } envelope with mapped credentials', async () => {
      const lastUsedAt = new Date('2026-07-01T00:00:00.000Z');
      const createdAt = new Date('2026-06-01T00:00:00.000Z');
      webauthnService.listCredentials.mockResolvedValue([
        {
          id: 'cred-1',
          deviceName: 'YubiKey',
          transports: ['usb'],
          lastUsedAt,
          createdAt,
        },
      ] as never);

      const result = await controller.webauthnList(payload);

      expect(result).toEqual({
        data: {
          items: [
            {
              id: 'cred-1',
              deviceName: 'YubiKey',
              transports: ['usb'],
              lastUsedAt: lastUsedAt.toISOString(),
              createdAt: createdAt.toISOString(),
            },
          ],
        },
      });
      expect(webauthnService.listCredentials).toHaveBeenCalledWith(payload.sub);
    });

    it('keeps the { data: { items } } envelope when there are no credentials', async () => {
      webauthnService.listCredentials.mockResolvedValue([]);

      const result = await controller.webauthnList(payload);

      // 빈 목록이어도 envelope 을 유지한다(bare array/null 로 축약 금지).
      expect(result).toEqual({ data: { items: [] } });
    });
  });

  describe('webauthnRegisterVerify', () => {
    // [Spec Auth §4.1 / Rationale 4.1.B] credential 등록 = user.2fa_enabled.
    it('records user.2fa_enabled with firstCredential=true (and ipAddress) on first registration', async () => {
      webauthnService.verifyRegistration.mockResolvedValue({
        verified: true,
        credentialUuid: 'cred-uuid',
        webauthnRecoveryCodes: ['a', 'b', 'c'],
      });

      await controller.webauthnRegisterVerify(
        payload,
        {
          optionsToken: 'tok',
          response: {} as never,
          deviceName: 'Yubikey',
        } as never,
        mockReq,
      );

      expect(auditLogsService.record).toHaveBeenCalledWith({
        workspaceId: 'ws-uuid',
        userId: 'user-uuid',
        action: AUDIT_ACTIONS.USER_2FA_ENABLED,
        resourceType: 'user',
        resourceId: 'user-uuid',
        details: {
          method: 'webauthn',
          credentialId: 'cred-uuid',
          firstCredential: true,
        },
        ipAddress: '7.7.7.7',
      });
    });

    it('records firstCredential=false when adding an additional authenticator', async () => {
      webauthnService.verifyRegistration.mockResolvedValue({
        verified: true,
        credentialUuid: 'cred-uuid-2',
        webauthnRecoveryCodes: [],
      });

      await controller.webauthnRegisterVerify(
        payload,
        {
          optionsToken: 'tok',
          response: {} as never,
        } as never,
        mockReq,
      );

      expect(auditLogsService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AUDIT_ACTIONS.USER_2FA_ENABLED,
          details: expect.objectContaining({ firstCredential: false }),
        }),
      );
    });

    it('does not record an audit log when verifyRegistration throws', async () => {
      webauthnService.verifyRegistration.mockRejectedValue(
        new BadRequestException('WEBAUTHN_VERIFY_FAILED'),
      );

      await expect(
        controller.webauthnRegisterVerify(
          payload,
          {
            optionsToken: 'tok',
            response: {} as never,
          } as never,
          mockReq,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(auditLogsService.record).not.toHaveBeenCalled();
    });
  });

  describe('webauthnDelete', () => {
    // [Spec Auth §4.1 / Rationale 4.1.B] credential 삭제 = user.2fa_disabled.
    it('records user.2fa_disabled with remaining count', async () => {
      webauthnService.deleteCredential.mockResolvedValue({ remaining: 0 });

      await controller.webauthnDelete(payload, 'cred-uuid', mockReq);

      expect(webauthnService.deleteCredential).toHaveBeenCalledWith(
        'user-uuid',
        'cred-uuid',
      );
      expect(auditLogsService.record).toHaveBeenCalledWith({
        workspaceId: 'ws-uuid',
        userId: 'user-uuid',
        action: AUDIT_ACTIONS.USER_2FA_DISABLED,
        resourceType: 'user',
        resourceId: 'user-uuid',
        details: {
          method: 'webauthn',
          credentialId: 'cred-uuid',
          remainingCredentials: 0,
        },
        ipAddress: '7.7.7.7',
      });
    });

    it('reports remaining authenticators when others persist', async () => {
      webauthnService.deleteCredential.mockResolvedValue({ remaining: 2 });

      await controller.webauthnDelete(payload, 'cred-uuid', mockReq);

      expect(auditLogsService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AUDIT_ACTIONS.USER_2FA_DISABLED,
          details: expect.objectContaining({ remainingCredentials: 2 }),
        }),
      );
    });

    it('does not record an audit log when deleteCredential throws', async () => {
      webauthnService.deleteCredential.mockRejectedValue(
        new NotFoundException('WEBAUTHN_CREDENTIAL_NOT_FOUND'),
      );

      await expect(
        controller.webauthnDelete(payload, 'cred-uuid', mockReq),
      ).rejects.toThrow(NotFoundException);
      expect(auditLogsService.record).not.toHaveBeenCalled();
    });
  });

  describe('webauthnRegenerateRecovery', () => {
    // [refactor 02 C-3 §3] delegates password reverification to
    // authService.verifyPasswordForUser — controller raw bcrypt removed (layer
    // alignment). Guards the delegation + regenerate flow. The error message
    // contract is owned by AuthService.verifyPasswordForUser (asserted in
    // auth.service.spec); here we verify the delegation + regenerate wiring only.
    it('regenerates recovery codes after the password is verified', async () => {
      authService.verifyPasswordForUser.mockResolvedValue(undefined);
      webauthnService.regenerateRecoveryCodes.mockResolvedValue(['x', 'y']);

      const res = await controller.webauthnRegenerateRecovery(payload, {
        password: 'OldP@ssw0rd1',
      } as never);

      expect(authService.verifyPasswordForUser).toHaveBeenCalledWith(
        'user-uuid',
        'OldP@ssw0rd1',
      );
      expect(webauthnService.regenerateRecoveryCodes).toHaveBeenCalledWith(
        'user-uuid',
      );
      expect(res).toEqual({ data: { webauthnRecoveryCodes: ['x', 'y'] } });
    });

    it('throws and does not regenerate when the password is wrong', async () => {
      authService.verifyPasswordForUser.mockRejectedValue(
        new UnauthorizedException({ code: 'PASSWORD_INVALID' }),
      );

      await expect(
        controller.webauthnRegenerateRecovery(payload, {
          password: 'WrongPass!',
        } as never),
      ).rejects.toThrow(UnauthorizedException);
      expect(webauthnService.regenerateRecoveryCodes).not.toHaveBeenCalled();
    });
  });
});
