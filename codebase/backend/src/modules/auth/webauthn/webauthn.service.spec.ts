import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { WebAuthnService } from './webauthn.service';
import { WebAuthnCredential } from './entities/webauthn-credential.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { UsersService } from '../../users/users.service';
import { LoginHistoryService } from '../login-history.service';
import { WebAuthnAuthChallengeService } from './webauthn-auth-challenge.service';

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
const _mockedGenerateAuthOpts = generateAuthenticationOptions as jest.Mock;
const mockedVerifyAuthResp = verifyAuthenticationResponse as jest.Mock;

describe('WebAuthnService', () => {
  let service: WebAuthnService;
  let credentialRepo: jest.Mocked<any>;
  let refreshTokenRepo: jest.Mocked<any>;
  let usersService: jest.Mocked<any>;
  let jwtService: jest.Mocked<JwtService>;
  let loginHistory: jest.Mocked<LoginHistoryService>;
  let authChallenges: { consume: jest.Mock };
  let dataSource: { transaction: jest.Mock };

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
      create: jest
        .fn()
        .mockImplementation((d) => ({ id: 'cred-uuid-1', ...d })),
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

    authChallenges = { consume: jest.fn().mockResolvedValue(true) };

    // 트랜잭션 콜백을 즉시 실행하고, manager.getRepository(Entity) 호출은
    // beforeEach 에서 만든 동일 mock 으로 라우팅한다. 행 잠금과 챌린지 기록의 동시성은
    // 실제 DB · Redis 로 도는 e2e(`test/webauthn-2fa.e2e-spec.ts`)가 검증한다.
    dataSource = {
      transaction: jest
        .fn()
        .mockImplementation(
          (
            cb: (manager: {
              getRepository: (entity: unknown) => unknown;
            }) => Promise<unknown>,
          ) =>
            cb({
              getRepository: (entity: unknown) => {
                if (entity === WebAuthnCredential) return credentialRepo;
                if (entity === RefreshToken) return refreshTokenRepo;
                throw new Error(
                  `unexpected entity in mock manager.getRepository: ${String(entity)}`,
                );
              },
            }),
        ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebAuthnService,
        {
          provide: getRepositoryToken(WebAuthnCredential),
          useValue: credentialRepo,
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: refreshTokenRepo,
        },
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'webauthn') {
                return {
                  enabled: true,
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
        { provide: DataSource, useValue: dataSource },
        { provide: WebAuthnAuthChallengeService, useValue: authChallenges },
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
      await expect(
        service.generateRegistrationOptionsFor(userId),
      ).rejects.toThrow(NotFoundException);
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

    // v14 는 PQC 를 지원하는 런타임에서 기본 목록 맨 앞에 ML-DSA-44(-48)를 넣는다.
    // COSE 번호를 상수가 아닌 값으로 적어 상수 이름이 틀려도 잡히게 한다.
    it('pins supportedAlgorithmIDs to EdDSA, ES256, RS256 (no ML-DSA-44)', async () => {
      mockedGenerateRegOpts.mockResolvedValue({ challenge: 'x' });
      await service.generateRegistrationOptionsFor(userId);
      const args = mockedGenerateRegOpts.mock.calls[0][0];
      expect(args.supportedAlgorithmIDs).toEqual([-8, -7, -257]);
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

    it('verifies against the same pinned algorithm list as the options', async () => {
      credentialRepo.count.mockResolvedValue(0);
      await service.verifyRegistration(
        userId,
        'opts.tok',
        validResponse as never,
        'My Mac',
      );
      const args = mockedVerifyRegResp.mock.calls[0][0];
      expect(args.supportedAlgorithmIDs).toEqual([-8, -7, -257]);
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

    it('saves the client transports unchanged, including values outside the standard list', async () => {
      await service.verifyRegistration(userId, 'opts.tok', {
        ...validResponse,
        response: { transports: ['usb', 'smart-card', 'future-transport'] },
      } as never);
      expect(credentialRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          transports: ['usb', 'smart-card', 'future-transport'],
        }),
      );
    });

    // 필드가 없는 경우와 인증기가 getTransports() 로 빈 배열을 돌려주는 경우 둘 다 정상 등록이다.
    it.each([
      ['sends none', {}],
      ['sends an empty array', { transports: [] }],
    ])(
      'saves an empty transport list when the client %s',
      async (_label, responseBody) => {
        await service.verifyRegistration(userId, 'opts.tok', {
          ...validResponse,
          response: responseBody,
        } as never);
        expect(credentialRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({ transports: [] }),
        );
        expect(credentialRepo.save).toHaveBeenCalledTimes(1);
      },
    );

    it.each([
      ['is omitted', undefined, null],
      ['is empty', '', null],
      ['has only spaces', '   ', null],
      ['has surrounding spaces', '  My Mac  ', 'My Mac'],
    ])(
      'saves a trimmed device name or null when the name %s',
      async (_label, deviceName, stored) => {
        await service.verifyRegistration(
          userId,
          'opts.tok',
          validResponse as never,
          deviceName,
        );
        expect(credentialRepo.create).toHaveBeenCalledWith(
          expect.objectContaining({ deviceName: stored }),
        );
      },
    );

    // 라이브러리는 transports 를 검증하지 않고 그대로 돌려준다. mock 이 아닌 실제 라이브러리와
    // DB 컬럼에서의 동작은 e2e(webauthn-2fa.e2e-spec.ts 케이스 H)가 본다.
    it.each([
      ['a string', 'usb'],
      ['null', null],
      ['an object', { 0: 'usb' }],
      ['an array with a number', ['usb', 1]],
      ['an array with null', ['usb', null]],
      // text[] 컬럼은 NUL 문자를 저장하지 못한다.
      ['an array with a NUL character', ['usb', 'a\u0000b']],
      ['an array with only a NUL character', ['\u0000']],
      ['an array with a leading NUL character', ['\u0000usb']],
    ])(
      'rejects transports that is %s with 400 WEBAUTHN_VERIFY_FAILED and saves nothing',
      async (_label, transports) => {
        const err: unknown = await service
          .verifyRegistration(userId, 'opts.tok', {
            ...validResponse,
            response: { transports },
          } as never)
          .catch((err_: unknown) => err_);
        expect(err).toBeInstanceOf(BadRequestException);
        expect((err as BadRequestException).getResponse()).toMatchObject({
          code: 'WEBAUTHN_VERIFY_FAILED',
        });
        expect(credentialRepo.save).not.toHaveBeenCalled();
        expect(usersService.update).not.toHaveBeenCalled();
      },
    );
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

    const challengeExp = 1_800_000_300;

    beforeEach(() => {
      jwtService.verify = jest.fn().mockReturnValue({
        kind: 'webauthn_auth',
        sub: userId,
        challenge: 'auth-challenge',
        exp: challengeExp,
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

    // 라이브러리는 counter 비교를 서명 검증보다 먼저 한다. 저장값을 넘기면 서명이 틀린
    // 응답도 역행으로 거부되므로 0 을 넘겨 그 비교를 끈다(REQ-SIGNIN-070).
    it('passes counter 0 to the library so its counter check never runs before the signature check', async () => {
      credentialRepo.findOne.mockResolvedValue({
        ...credentialRow,
        counter: '7',
      });
      mockedVerifyAuthResp.mockResolvedValue({
        verified: true,
        authenticationInfo: { newCounter: 8 },
      });
      await service.verifyAuthentication(
        userId,
        'opts.tok',
        validResponse as never,
      );
      expect(mockedVerifyAuthResp).toHaveBeenCalledWith(
        expect.objectContaining({
          credential: expect.objectContaining({ counter: 0 }),
        }),
      );
      // 라이브러리에 0 을 넘겨도 저장값 비교는 서비스가 한다. 7 → 8 은 정상 증가다.
      expect(credentialRepo.update).toHaveBeenCalledWith(
        credentialRow.id,
        expect.objectContaining({ counter: '8' }),
      );
      expect(credentialRepo.delete).not.toHaveBeenCalled();
    });

    describe('signature verified, counter compared by the service', () => {
      it.each([
        ['equal to stored (5 → 5)', '5', 5],
        ['equal to stored (1 → 1)', '1', 1],
        ['lower than stored (5 → 3)', '5', 3],
        ['zero while stored is above zero (5 → 0)', '5', 0],
      ])(
        'deletes credential + revokes all active refresh tokens + records WEBAUTHN_COUNTER_REGRESSION when %s',
        async (_label, stored, newCounter) => {
          credentialRepo.findOne.mockResolvedValue({
            ...credentialRow,
            counter: stored,
          });
          mockedVerifyAuthResp.mockResolvedValue({
            verified: true,
            authenticationInfo: { newCounter },
          });
          await expect(
            service.verifyAuthentication(
              userId,
              'opts.tok',
              validResponse as never,
            ),
          ).rejects.toMatchObject({
            response: expect.objectContaining({
              code: 'WEBAUTHN_COUNTER_REGRESSION',
            }),
          });
          expect(credentialRepo.delete).toHaveBeenCalledWith({
            id: credentialRow.id,
          });
          // 클론 공격 시 기존 활성 세션 즉시 revoke (review C-3)
          expect(refreshTokenRepo.update).toHaveBeenCalledWith(
            { userId, isRevoked: false },
            { isRevoked: true },
          );
          expect(credentialRepo.update).not.toHaveBeenCalled();
          expect(loginHistory.record).toHaveBeenCalledWith(
            expect.objectContaining({
              event: 'webauthn_failed',
              failureReason: 'WEBAUTHN_COUNTER_REGRESSION',
            }),
          );
        },
      );

      // counter 를 쓰지 않는 인증기(대부분의 플랫폼 Passkey)는 늘 0 을 보낸다.
      it('accepts stored 0 and response 0 (authenticator without a counter)', async () => {
        mockedVerifyAuthResp.mockResolvedValue({
          verified: true,
          authenticationInfo: { newCounter: 0 },
        });
        const result = await service.verifyAuthentication(
          userId,
          'opts.tok',
          validResponse as never,
        );
        expect(result.verified).toBe(true);
        expect(credentialRepo.delete).not.toHaveBeenCalled();
        expect(credentialRepo.update).toHaveBeenCalledWith(
          credentialRow.id,
          expect.objectContaining({ counter: '0' }),
        );
      });
    });

    describe('signature not verified', () => {
      // 비밀번호만 아는 사람이 서명 없이 counter 만 낮춘 응답을 보내는 경우다.
      it('rejects with WEBAUTHN_INVALID and keeps the credential and sessions even if the counter went back', async () => {
        credentialRepo.findOne.mockResolvedValue({
          ...credentialRow,
          counter: '5',
        });
        mockedVerifyAuthResp.mockResolvedValue({
          verified: false,
          authenticationInfo: { newCounter: 0 },
        });
        await expect(
          service.verifyAuthentication(
            userId,
            'opts.tok',
            validResponse as never,
          ),
        ).rejects.toMatchObject({
          response: expect.objectContaining({ code: 'WEBAUTHN_INVALID' }),
        });
        expect(credentialRepo.delete).not.toHaveBeenCalled();
        expect(refreshTokenRepo.update).not.toHaveBeenCalled();
        expect(credentialRepo.update).not.toHaveBeenCalled();
        expect(loginHistory.record).toHaveBeenCalledWith(
          expect.objectContaining({
            event: 'webauthn_failed',
            failureReason: 'WEBAUTHN_INVALID',
          }),
        );
      });

      // 라이브러리가 counter 문구로 던져도 서명을 확인하기 전이라 역행으로 보지 않는다.
      // 판정이 에러 문구에 기대지 않는다는 것을 잠근다.
      it('treats a library error mentioning the counter as WEBAUTHN_INVALID, not regression', async () => {
        mockedVerifyAuthResp.mockRejectedValue(
          new Error('Response counter value 0 was lower than expected 5'),
        );
        await expect(
          service.verifyAuthentication(
            userId,
            'opts.tok',
            validResponse as never,
          ),
        ).rejects.toMatchObject({
          response: expect.objectContaining({ code: 'WEBAUTHN_INVALID' }),
        });
        expect(credentialRepo.delete).not.toHaveBeenCalled();
        expect(refreshTokenRepo.update).not.toHaveBeenCalled();
      });
    });

    describe('Passkey authentication challenge single use', () => {
      it('records the challenge and its exp from the verified options token', async () => {
        await service.verifyAuthentication(
          userId,
          'opts.tok',
          validResponse as never,
        );
        expect(authChallenges.consume).toHaveBeenCalledWith(
          'auth-challenge',
          challengeExp,
        );
      });

      // 판정 뒤에 기록하면 동시에 온 두 요청이 모두 판정으로 간다(REQ-SIGNIN-068).
      it('records the challenge before the signature and counter judgment', async () => {
        await service.verifyAuthentication(
          userId,
          'opts.tok',
          validResponse as never,
        );
        expect(authChallenges.consume.mock.invocationCallOrder[0]).toBeLessThan(
          dataSource.transaction.mock.invocationCallOrder[0],
        );
      });

      it('rejects a used challenge with WEBAUTHN_INVALID without touching the credential or sessions', async () => {
        authChallenges.consume.mockResolvedValue(false);
        await expect(
          service.verifyAuthentication(
            userId,
            'opts.tok',
            validResponse as never,
          ),
        ).rejects.toMatchObject({
          status: 401,
          response: expect.objectContaining({ code: 'WEBAUTHN_INVALID' }),
        });
        expect(dataSource.transaction).not.toHaveBeenCalled();
        expect(mockedVerifyAuthResp).not.toHaveBeenCalled();
        expect(credentialRepo.delete).not.toHaveBeenCalled();
        expect(credentialRepo.update).not.toHaveBeenCalled();
        expect(refreshTokenRepo.update).not.toHaveBeenCalled();
        expect(loginHistory.record).toHaveBeenCalledWith(
          expect.objectContaining({
            event: 'webauthn_failed',
            failureReason: 'WEBAUTHN_INVALID',
          }),
        );
      });

      // 기록하지 못하면 한 번만 쓴다는 보장이 없어 판정으로 보내지 않는다(fail-closed).
      it('answers 503 SERVICE_UNAVAILABLE when the challenge cannot be recorded', async () => {
        authChallenges.consume.mockRejectedValue(new Error('connection lost'));
        await expect(
          service.verifyAuthentication(
            userId,
            'opts.tok',
            validResponse as never,
          ),
        ).rejects.toMatchObject({
          status: 503,
          response: expect.objectContaining({
            code: 'SERVICE_UNAVAILABLE',
            message: '서비스를 일시적으로 사용할 수 없습니다.',
          }),
        });
        expect(dataSource.transaction).not.toHaveBeenCalled();
        expect(credentialRepo.delete).not.toHaveBeenCalled();
        expect(refreshTokenRepo.update).not.toHaveBeenCalled();
        expect(loginHistory.record).not.toHaveBeenCalled();
      });

      // 위조 · 만료 · 다른 사용자의 옵션 토큰으로 남의 챌린지를 미리 소진하지 못한다.
      it('does not record anything when the options token is rejected', async () => {
        jwtService.verify = jest.fn().mockReturnValue({
          kind: 'webauthn_auth',
          sub: 'someone-else',
          challenge: 'auth-challenge',
          exp: challengeExp,
        });
        await expect(
          service.verifyAuthentication(
            userId,
            'opts.tok',
            validResponse as never,
          ),
        ).rejects.toMatchObject({
          response: expect.objectContaining({ code: 'INVALID_OPTIONS_TOKEN' }),
        });
        expect(authChallenges.consume).not.toHaveBeenCalled();
      });
    });

    it('records WEBAUTHN_INVALID on generic verify failure', async () => {
      mockedVerifyAuthResp.mockRejectedValue(new Error('signature failed'));
      await expect(
        service.verifyAuthentication(
          userId,
          'opts.tok',
          validResponse as never,
        ),
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
        service.verifyAuthentication(
          userId,
          'opts.tok',
          validResponse as never,
        ),
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
      const result = await service.deleteCredential(userId, 'cred-1');
      expect(usersService.update).toHaveBeenCalledWith(userId, {
        webauthnRecoveryCodes: null,
      });
      // 호출자(controller)가 2fa_disabled 감사 details 에 쓰는 remaining count.
      expect(result).toEqual({ remaining: 0 });
    });

    it('keeps recovery codes when other credentials remain', async () => {
      credentialRepo.findOne.mockResolvedValue({ id: 'cred-1', userId });
      credentialRepo.count.mockResolvedValue(1); // after delete
      const result = await service.deleteCredential(userId, 'cred-1');
      expect(usersService.update).not.toHaveBeenCalled();
      expect(result).toEqual({ remaining: 1 });
    });

    it('throws NotFound for other user credential (enumeration block)', async () => {
      credentialRepo.findOne.mockResolvedValue({
        id: 'cred-1',
        userId: 'someone-else',
      });
      await expect(service.deleteCredential(userId, 'cred-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    /**
     * 동시 삭제 두 건이 `user.2fa_disabled` 감사를 두 번 남기던 결함의 회귀 테스트.
     * 형제 여덟(#1369~#1375)과 같은 클래스의 **아홉 번째이자 마지막** 자리다. 다만 이 자리는
     * 이미 `delete()` 를 쓰고 있었고 **`affected` 를 버렸을 뿐**이며, 감사는 서비스가 아니라
     * 컨트롤러가 남긴다 — 서비스가 던지면 컨트롤러가 감사에 도달하지 않는다
     * (`webauthn.controller.spec.ts` «does not record an audit log when deleteCredential throws»).
     */
    describe('동시 삭제', () => {
      it('소유자로 스코프한 DELETE 를 친다', async () => {
        credentialRepo.findOne.mockResolvedValue({ id: 'cred-1', userId });

        await service.deleteCredential(userId, 'cred-1');

        // `userId` 가 빠지면 소유권이 무락 조회 뒤 JS 비교로만 남는다 — 조건을 통째로 단언한다.
        expect(credentialRepo.delete).toHaveBeenCalledWith({
          id: 'cred-1',
          userId,
        });
      });

      it('진 쪽은 404 이고 남은 개수 조회·복구 코드 쓰기도 타지 않는다', async () => {
        credentialRepo.findOne.mockResolvedValue({ id: 'cred-1', userId });
        // 둘 다 무락 조회·소유권 비교를 통과했지만 DELETE 는 하나만 1행을 지운다.
        credentialRepo.delete.mockResolvedValueOnce({ affected: 0 });

        await expect(
          service.deleteCredential(userId, 'cred-1'),
        ).rejects.toMatchObject({
          response: { code: 'WEBAUTHN_CREDENTIAL_NOT_FOUND' },
        });
        // 진 쪽이 여기까지 오면 `remaining === 0` 일 때 복구 코드를 한 번 더 NULL 화한다.
        expect(credentialRepo.count).not.toHaveBeenCalled();
        expect(usersService.update).not.toHaveBeenCalled();
      });

      /**
       * 판정이 `affected === 0` **명시 비교**인 이유를 붙드는 대조군.
       * `null`·`undefined` 는 드라이버가 «보고하지 않았다» 는 뜻이지 «못 지웠다» 가 아니다 —
       * `!affected` 로 되돌리면 정상 삭제가 404 로 뒤집힌다. #1371 에서 이 대조군이 빠져
       * 같은 뮤턴트가 32건을 통과했다.
       */
      it.each([[undefined], [null]])(
        'affected 가 %p(드라이버 미보고)면 정상 삭제로 취급한다',
        async (affected) => {
          credentialRepo.findOne.mockResolvedValue({ id: 'cred-1', userId });
          credentialRepo.count.mockResolvedValue(1);
          credentialRepo.delete.mockResolvedValueOnce({ affected });

          await expect(
            service.deleteCredential(userId, 'cred-1'),
          ).resolves.toEqual({ remaining: 1 });
        },
      );
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
      await expect(service.regenerateRecoveryCodes(userId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('when feature disabled (env not configured)', () => {
    beforeEach(() => {
      (
        jest.mocked(
          (
            service as unknown as {
              configService: { get: jest.Mock };
            }
          ).configService.get,
        ) as jest.Mock
      ).mockImplementation((key: string) => {
        if (key === 'webauthn') {
          return { enabled: false, rpID: '', rpName: 'Clemvion', origins: [] };
        }
        return undefined;
      });
    });

    it('isEnabled() returns false', () => {
      expect(service.isEnabled()).toBe(false);
    });

    it('listCredentials returns empty array without DB hit', async () => {
      const result = await service.listCredentials(userId);
      expect(result).toEqual([]);
      expect(credentialRepo.find).not.toHaveBeenCalled();
    });

    it('countCredentials returns 0 without DB hit', async () => {
      const result = await service.countCredentials(userId);
      expect(result).toBe(0);
      expect(credentialRepo.count).not.toHaveBeenCalled();
    });

    it.each([
      [
        'generateRegistrationOptionsFor',
        () => service.generateRegistrationOptionsFor(userId),
      ],
      [
        'verifyRegistration',
        () => service.verifyRegistration(userId, 'token', {} as never),
      ],
      [
        'generateAuthenticationOptionsForUser',
        () => service.generateAuthenticationOptionsForUser(userId),
      ],
      [
        'verifyAuthentication',
        () => service.verifyAuthentication(userId, 'token', {} as never),
      ],
      ['verifyRecoveryCode', () => service.verifyRecoveryCode(userId, 'code')],
      [
        'renameCredential',
        () => service.renameCredential(userId, 'cred-1', 'name'),
      ],
      ['deleteCredential', () => service.deleteCredential(userId, 'cred-1')],
      [
        'regenerateRecoveryCodes',
        () => service.regenerateRecoveryCodes(userId),
      ],
    ])(
      '%s throws ServiceUnavailable (WEBAUTHN_DISABLED)',
      async (_name, fn) => {
        await expect(fn()).rejects.toThrow(ServiceUnavailableException);
        expect(authChallenges.consume).not.toHaveBeenCalled();
      },
    );
  });
});
