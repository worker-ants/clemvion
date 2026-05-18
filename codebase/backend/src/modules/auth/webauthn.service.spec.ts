import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { WebAuthnService } from './webauthn.service';
import { WebAuthnCredential } from './entities/webauthn-credential.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { UsersService } from '../users/users.service';
import { LoginHistoryService } from './login-history.service';

jest.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: jest.fn(),
  verifyRegistrationResponse: jest.fn(),
  generateAuthenticationOptions: jest.fn(),
  verifyAuthenticationResponse: jest.fn(),
}));

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';

const mockedGenerateRegOpts = generateRegistrationOptions as jest.Mock;
const mockedVerifyRegResp = verifyRegistrationResponse as jest.Mock;
const mockedGenerateAuthOpts = generateAuthenticationOptions as jest.Mock;
const mockedVerifyAuthResp = verifyAuthenticationResponse as jest.Mock;

describe('WebAuthnService', () => {
  let service: WebAuthnService;
  let credentialRepo: jest.Mocked<any>;
  let refreshTokenRepo: jest.Mocked<any>;
  let usersService: jest.Mocked<any>;
  let jwtService: jest.Mocked<JwtService>;
  let loginHistory: jest.Mocked<LoginHistoryService>;

  const userId = 'user-uuid-1';
  const mockUser = {
    id: userId,
    email: 'test@example.com',
    name: 'Test User',
    webauthnRecoveryCodes: null as string[] | null,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    credentialRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation((d) => ({ id: 'cred-uuid-1', ...d })),
      save: jest.fn().mockImplementation((d) => Promise.resolve(d)),
      update: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    refreshTokenRepo = {
      update: jest.fn().mockResolvedValue({ affected: 0 }),
    };

    usersService = {
      findById: jest.fn().mockResolvedValue(mockUser),
      update: jest.fn().mockResolvedValue(undefined),
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mock.options.token'),
      verify: jest.fn().mockReturnValue({
        kind: 'webauthn_register',
        sub: userId,
        challenge: 'abc',
      }),
    } as unknown as jest.Mocked<JwtService>;

    loginHistory = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<LoginHistoryService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebAuthnService,
        { provide: getRepositoryToken(WebAuthnCredential), useValue: credentialRepo },
        { provide: getRepositoryToken(RefreshToken), useValue: refreshTokenRepo },
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'webauthn') {
                return {
                  rpID: 'localhost',
                  rpName: 'Clemvion',
                  origins: ['http://localhost:3012'],
                };
              }
              return undefined;
            }),
          },
        },
        { provide: LoginHistoryService, useValue: loginHistory },
      ],
    }).compile();

    service = module.get<WebAuthnService>(WebAuthnService);
  });

  describe('generateRegistrationOptionsFor', () => {
    it('returns options + optionsToken (kind=webauthn_register)', async () => {
      mockedGenerateRegOpts.mockResolvedValue({
        challenge: 'reg-challenge',
        user: { id: 'u', name: 't', displayName: 'Test User' },
      });
      const result = await service.generateRegistrationOptionsFor(userId);
      expect(result.publicKey).toBeDefined();
      expect(result.optionsToken).toBe('mock.options.token');
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'webauthn_register',
          sub: userId,
          challenge: 'reg-challenge',
        }),
        expect.objectContaining({ expiresIn: 300 }),
      );
    });

    it('throws when user not found', async () => {
      usersService.findById.mockResolvedValue(null);
      await expect(service.generateRegistrationOptionsFor(userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('passes excludeCredentials of existing registrations', async () => {
      credentialRepo.find.mockResolvedValue([
        { credentialId: 'cid1', transports: ['internal'] },
        { credentialId: 'cid2', transports: ['usb'] },
      ]);
      mockedGenerateRegOpts.mockResolvedValue({ challenge: 'x' });
      await service.generateRegistrationOptionsFor(userId);
      const args = mockedGenerateRegOpts.mock.calls[0][0];
      expect(args.excludeCredentials).toHaveLength(2);
      expect(args.excludeCredentials[0].id).toBe('cid1');
    });
  });

  describe('verifyRegistration', () => {
    const validResponse = {
      id: 'cred-base64url',
      rawId: 'cred-base64url',
      response: { transports: ['usb'] },
      type: 'public-key',
      clientExtensionResults: {},
    };

    beforeEach(() => {
      jwtService.verify = jest.fn().mockReturnValue({
        kind: 'webauthn_register',
        sub: userId,
        challenge: 'reg-challenge',
      });
      mockedVerifyRegResp.mockResolvedValue({
        verified: true,
        registrationInfo: {
          credential: {
            id: 'cred-base64url',
            publicKey: new Uint8Array([1, 2, 3]),
            counter: 0,
          },
          aaguid: '00000000-0000-0000-0000-000000000000',
        },
      });
    });

    it('saves credential + returns recovery codes on first registration', async () => {
      credentialRepo.count.mockResolvedValue(0); // before insert
      const result = await service.verifyRegistration(
        userId,
        'opts.tok',
        validResponse as never,
        'My Mac',
      );
      expect(result.verified).toBe(true);
      expect(result.credentialUuid).toBe('cred-uuid-1');
      expect(result.webauthnRecoveryCodes).toHaveLength(10);
      expect(usersService.update).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          webauthnRecoveryCodes: expect.any(Array),
        }),
      );
      const codes = (usersService.update as jest.Mock).mock.calls[0][1]
        .webauthnRecoveryCodes;
      // Verify codes are hashed (64-char hex)
      expect(codes[0]).toMatch(/^[a-f0-9]{64}$/);
    });

    it('does not regenerate recovery codes on subsequent registration', async () => {
      credentialRepo.count.mockResolvedValue(2);
      const result = await service.verifyRegistration(
        userId,
        'opts.tok',
        validResponse as never,
      );
      expect(result.webauthnRecoveryCodes).toHaveLength(0);
      expect(usersService.update).not.toHaveBeenCalled();
    });

    it('rejects mismatched optionsToken kind', async () => {
      jwtService.verify = jest.fn().mockReturnValue({
        kind: 'webauthn_auth',
        sub: userId,
        challenge: 'x',
      });
      await expect(
        service.verifyRegistration(userId, 'opts.tok', validResponse as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects optionsToken sub mismatch (cross-user)', async () => {
      jwtService.verify = jest.fn().mockReturnValue({
        kind: 'webauthn_register',
        sub: 'other-user',
        challenge: 'x',
      });
      await expect(
        service.verifyRegistration(userId, 'opts.tok', validResponse as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when @simplewebauthn rejects verification', async () => {
      mockedVerifyRegResp.mockResolvedValue({ verified: false });
      await expect(
        service.verifyRegistration(userId, 'opts.tok', validResponse as never),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws conflict on duplicate credentialId', async () => {
      credentialRepo.findOne.mockResolvedValueOnce({
        id: 'existing',
        credentialId: 'cred-base64url',
      });
      await expect(
        service.verifyRegistration(userId, 'opts.tok', validResponse as never),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('verifyAuthentication', () => {
    const credentialRow = {
      id: 'cred-uuid-1',
      userId,
      credentialId: 'cred-base64url',
      publicKey: Buffer.from([1, 2, 3]),
      counter: '0',
      transports: ['usb'],
    };
    const validResponse = {
      id: 'cred-base64url',
      rawId: 'cred-base64url',
      response: {},
      type: 'public-key',
      clientExtensionResults: {},
    };

    beforeEach(() => {
      jwtService.verify = jest.fn().mockReturnValue({
        kind: 'webauthn_auth',
        sub: userId,
        challenge: 'auth-challenge',
      });
      credentialRepo.findOne.mockResolvedValue(credentialRow);
      mockedVerifyAuthResp.mockResolvedValue({
        verified: true,
        authenticationInfo: { newCounter: 5 },
      });
    });

    it('updates counter + lastUsedAt on success', async () => {
      const result = await service.verifyAuthentication(
        userId,
        'opts.tok',
        validResponse as never,
      );
      expect(result.verified).toBe(true);
      expect(credentialRepo.update).toHaveBeenCalledWith(
        credentialRow.id,
        expect.objectContaining({
          counter: '5',
          lastUsedAt: expect.any(Date),
        }),
      );
    });

    it('deletes credential + revokes all active refresh tokens + records WEBAUTHN_COUNTER_REGRESSION on counter regression', async () => {
      mockedVerifyAuthResp.mockRejectedValue(
        new Error('Response counter value 0 is less than or equal to current counter 5'),
      );
      await expect(
        service.verifyAuthentication(userId, 'opts.tok', validResponse as never),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'WEBAUTHN_COUNTER_REGRESSION' }),
      });
      expect(credentialRepo.delete).toHaveBeenCalledWith({ id: credentialRow.id });
      // 클론 공격 시 기존 활성 세션 즉시 revoke (review C-3)
      expect(refreshTokenRepo.update).toHaveBeenCalledWith(
        { userId, isRevoked: false },
        { isRevoked: true },
      );
      expect(loginHistory.record).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'webauthn_failed',
          failureReason: 'WEBAUTHN_COUNTER_REGRESSION',
        }),
      );
    });

    it('records WEBAUTHN_INVALID on generic verify failure', async () => {
      mockedVerifyAuthResp.mockRejectedValue(new Error('signature failed'));
      await expect(
        service.verifyAuthentication(userId, 'opts.tok', validResponse as never),
      ).rejects.toThrow(UnauthorizedException);
      expect(loginHistory.record).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'webauthn_failed',
          failureReason: 'WEBAUTHN_INVALID',
        }),
      );
      expect(credentialRepo.delete).not.toHaveBeenCalled();
    });

    it('throws when credential not found', async () => {
      credentialRepo.findOne.mockResolvedValue(null);
      await expect(
        service.verifyAuthentication(userId, 'opts.tok', validResponse as never),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('verifyRecoveryCode', () => {
    it('returns true and removes code on match', async () => {
      const code = 'aaaa-bbbb-cccc';
      const hash = createHash('sha256').update(code).digest('hex');
      usersService.findById.mockResolvedValue({
        ...mockUser,
        webauthnRecoveryCodes: [hash, 'other-hash'],
      });
      const ok = await service.verifyRecoveryCode(userId, code);
      expect(ok).toBe(true);
      expect(usersService.update).toHaveBeenCalledWith(userId, {
        webauthnRecoveryCodes: ['other-hash'],
      });
    });

    it('returns false on mismatch', async () => {
      usersService.findById.mockResolvedValue({
        ...mockUser,
        webauthnRecoveryCodes: ['something-else'],
      });
      const ok = await service.verifyRecoveryCode(userId, 'nope');
      expect(ok).toBe(false);
    });

    it('nulls out codes column when last code used', async () => {
      const code = 'last-code-aa';
      const hash = createHash('sha256').update(code).digest('hex');
      usersService.findById.mockResolvedValue({
        ...mockUser,
        webauthnRecoveryCodes: [hash],
      });
      await service.verifyRecoveryCode(userId, code);
      expect(usersService.update).toHaveBeenCalledWith(userId, {
        webauthnRecoveryCodes: null,
      });
    });
  });

  describe('deleteCredential', () => {
    it('nulls webauthn_recovery_codes when last credential removed', async () => {
      credentialRepo.findOne.mockResolvedValue({ id: 'cred-1', userId });
      credentialRepo.count.mockResolvedValue(0); // after delete
      await service.deleteCredential(userId, 'cred-1');
      expect(usersService.update).toHaveBeenCalledWith(userId, {
        webauthnRecoveryCodes: null,
      });
    });

    it('keeps recovery codes when other credentials remain', async () => {
      credentialRepo.findOne.mockResolvedValue({ id: 'cred-1', userId });
      credentialRepo.count.mockResolvedValue(1); // after delete
      await service.deleteCredential(userId, 'cred-1');
      expect(usersService.update).not.toHaveBeenCalled();
    });

    it('throws NotFound for other user credential (enumeration block)', async () => {
      credentialRepo.findOne.mockResolvedValue({
        id: 'cred-1',
        userId: 'someone-else',
      });
      await expect(
        service.deleteCredential(userId, 'cred-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('renameCredential', () => {
    it('updates device_name when caller owns the credential', async () => {
      credentialRepo.findOne.mockResolvedValue({
        id: 'cred-1',
        userId,
        deviceName: 'old',
      });
      await service.renameCredential(userId, 'cred-1', '  My Yubikey  ');
      expect(credentialRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ deviceName: 'My Yubikey' }),
      );
    });

    it('throws NotFound for other user credential', async () => {
      credentialRepo.findOne.mockResolvedValue({
        id: 'cred-1',
        userId: 'someone-else',
      });
      await expect(
        service.renameCredential(userId, 'cred-1', 'name'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('regenerateRecoveryCodes', () => {
    it('returns 10 fresh codes when credentials registered', async () => {
      credentialRepo.count.mockResolvedValue(1);
      const codes = await service.regenerateRecoveryCodes(userId);
      expect(codes).toHaveLength(10);
      expect(usersService.update).toHaveBeenCalled();
    });

    it('rejects when no credentials registered', async () => {
      credentialRepo.count.mockResolvedValue(0);
      await expect(
        service.regenerateRecoveryCodes(userId),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
