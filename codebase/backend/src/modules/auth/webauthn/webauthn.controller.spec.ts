import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebAuthnController } from './webauthn.controller';
import { WebAuthnService } from './webauthn.service';
import { AuthService } from '../auth.service';
import { UsersService } from '../../users/users.service';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';
import { AUDIT_ACTIONS } from '../../audit-logs/audit-action.const';
import type { JwtPayload } from '../../../common/decorators';

describe('WebAuthnController (audit)', () => {
  let controller: WebAuthnController;
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

    webauthnService = {
      verifyRegistration: jest.fn(),
      deleteCredential: jest.fn(),
    } as unknown as jest.Mocked<WebAuthnService>;

    auditLogsService = {
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditLogsService>;

    const configService = {
      get: jest.fn().mockReturnValue(''),
    } as unknown as ConfigService;

    controller = new WebAuthnController(
      {} as unknown as AuthService,
      webauthnService,
      {} as unknown as UsersService,
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
});
