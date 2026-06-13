import { createHash } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { WebAuthnService } from './webauthn/webauthn.service';
import { UsersService } from '../users/users.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { WorkspaceInvitationsService } from '../workspaces/workspace-invitations.service';
import { MailService } from '../mail/mail.service';
import { User } from '../users/entities/user.entity';
import { LoginHistoryService } from './login-history.service';
import { SessionsService } from './sessions.service';

function sha256(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let workspacesService: jest.Mocked<WorkspacesService>;
  let invitationsService: jest.Mocked<WorkspaceInvitationsService>;
  let mailService: jest.Mocked<MailService>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let jwtService: jest.Mocked<JwtService>;
  let refreshTokenRepo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    manager: { getRepository: jest.Mock };
  };
  let mockDataSource: { transaction: jest.Mock };
  let loginHistoryService: { record: jest.Mock; findForUser: jest.Mock };
  let sessionsService: { revokeAllFamilies: jest.Mock };

  const mockUser: Partial<User> = {
    id: 'user-uuid-1',
    email: 'test@example.com',
    name: 'Test User',
    passwordHash: '',
    emailVerified: true,
    loginAttempts: 0,
    lockedUntil: null as unknown as Date,
  };

  beforeEach(async () => {
    const mockRefreshTokenRepo = {
      create: jest.fn().mockImplementation((data) => data),
      save: jest.fn().mockImplementation((data) => Promise.resolve(data)),
      findOne: jest.fn(),
      // 05 C-1 — refresh 회전의 조건부 UPDATE 가 `result.affected` 를 읽으므로
      // 기본값을 affected:1(성공) 로 둔다. affected:0(이중 회전) 케이스는 테스트에서 오버라이드.
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      manager: {
        getRepository: jest.fn().mockReturnValue({
          findOne: jest.fn(),
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-access-token'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-value'),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            emailExists: jest.fn(),
            incrementLoginAttempts: jest.fn(),
            resetLoginAttempts: jest.fn(),
            isLocked: jest.fn().mockResolvedValue(false),
          },
        },
        {
          provide: WorkspacesService,
          useValue: {
            findPersonalWorkspace: jest.fn().mockResolvedValue({
              id: 'ws-uuid-1',
            }),
            createPersonalWorkspace: jest.fn().mockResolvedValue({
              id: 'ws-uuid-1',
            }),
            findOrCreatePersonalWorkspace: jest.fn().mockResolvedValue({
              id: 'ws-uuid-1',
            }),
            listForUser: jest.fn().mockResolvedValue([]),
            getMemberRole: jest.fn().mockResolvedValue('owner'),
          },
        },
        {
          provide: WorkspaceInvitationsService,
          useValue: {
            getMetaByToken: jest.fn(),
            consumeForRegistration: jest.fn(),
          },
        },
        {
          provide: MailService,
          useValue: {
            sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
            sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: mockRefreshTokenRepo,
        },
        {
          provide: WebAuthnService,
          useValue: {
            countCredentials: jest.fn().mockResolvedValue(0),
            isEnabled: jest.fn().mockReturnValue(false),
          },
        },
        {
          // 주의: 아래 DataSource.transaction mock 은 위 `mockRefreshTokenRepo` 를
          // 클로저로 캡처한다 — 반드시 그 const 선언보다 나중에 와야 한다(선언 순서 결합).
          provide: DataSource,
          useValue: {
            transaction: jest
              .fn()
              .mockImplementation((cb: (manager: unknown) => Promise<void>) => {
                const mockManager = {
                  // 05 C-1 — refresh 회전이 트랜잭션 안에서 RefreshToken repo 로
                  // revoke(update) + INSERT(create/save) 한다. RefreshToken 은
                  // 외부 단언과 동일한 mock 으로 라우팅하고, 그 외(User 등)는 generic.
                  getRepository: jest
                    .fn()
                    .mockImplementation((entity: unknown) =>
                      entity === RefreshToken
                        ? mockRefreshTokenRepo
                        : {
                            update: jest.fn().mockResolvedValue(undefined),
                          },
                    ),
                };
                return cb(mockManager);
              }),
          },
        },
        {
          provide: LoginHistoryService,
          useValue: {
            record: jest.fn().mockResolvedValue(undefined),
            findForUser: jest.fn().mockResolvedValue({
              data: [],
              nextCursor: null,
            }),
            pruneOlderThanRetention: jest.fn().mockResolvedValue(0),
          },
        },
        {
          // refactor 04 A-1 — AuthService.rotateSessionAfterPasswordChange 가 위임.
          provide: SessionsService,
          useValue: {
            revokeAllFamilies: jest.fn().mockResolvedValue({ revoked: 0 }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    workspacesService = module.get(WorkspacesService);
    invitationsService = module.get(WorkspaceInvitationsService);
    mailService = module.get(MailService);
    jwtService = module.get(JwtService);
    refreshTokenRepo = module.get(getRepositoryToken(RefreshToken));
    mockDataSource = module.get(DataSource);
    loginHistoryService = module.get(LoginHistoryService);
    sessionsService = module.get(SessionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user and send verification email', async () => {
      usersService.emailExists.mockResolvedValue(false);
      usersService.create.mockResolvedValue(mockUser as User);

      const result = await service.register({
        name: 'Test',
        email: 'test@example.com',
        password: 'Test123!@#',
      });

      expect(result.message).toContain('verify your email');
      expect(usersService.create).toHaveBeenCalled();
      expect(mailService.sendVerificationEmail).toHaveBeenCalledWith(
        'test@example.com',
        'Test',
        expect.any(String),
      );
    });

    it('stores hashed emailVerifyToken in DB and emails the raw token (register round-trip)', async () => {
      usersService.emailExists.mockResolvedValue(false);
      usersService.create.mockResolvedValue(mockUser as User);

      await service.register({
        name: 'Test',
        email: 'test@example.com',
        password: 'Test123!@#',
      });

      const [createArg] = usersService.create.mock.calls[0] as [
        { emailVerifyToken: string },
      ];
      const mailedToken = (
        mailService.sendVerificationEmail.mock.calls[0] as [
          string,
          string,
          string,
        ]
      )[2];

      // DB stores SHA-256 hash (64-char hex), not the raw UUID.
      expect(createArg.emailVerifyToken).toMatch(/^[0-9a-f]{64}$/);
      // The mailed token hashes to the stored token — verify round-trip integrity.
      expect(sha256(mailedToken)).toBe(createArg.emailVerifyToken);
    });

    it('should throw ConflictException for duplicate email', async () => {
      usersService.emailExists.mockResolvedValue(true);

      await expect(
        service.register({
          name: 'Test',
          email: 'test@example.com',
          password: 'Test123!@#',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException for weak password', async () => {
      usersService.emailExists.mockResolvedValue(false);

      await expect(
        service.register({
          name: 'Test',
          email: 'test@example.com',
          password: 'short',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw for password with insufficient character types', async () => {
      usersService.emailExists.mockResolvedValue(false);

      await expect(
        service.register({
          name: 'Test',
          email: 'test@example.com',
          password: 'alllowercase',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('register (with invitationToken)', () => {
    function stubInvitationFriendlyDataSource() {
      mockDataSource.transaction.mockImplementation(
        async (cb: (manager: unknown) => Promise<unknown>) => {
          const mockManager = {
            getRepository: jest.fn().mockReturnValue({
              create: jest.fn().mockImplementation((data) => data),
              save: jest.fn().mockImplementation((data) =>
                Promise.resolve({
                  ...data,
                  id: 'user-uuid-new',
                  emailVerified: true,
                }),
              ),
              update: jest.fn().mockResolvedValue(undefined),
            }),
          };
          return cb(mockManager);
        },
      );
    }

    beforeEach(() => {
      stubInvitationFriendlyDataSource();
      // Invitation-token sign-ups land into the team workspace; no personal
      // workspace exists yet, but they ARE a member, so resolveTokenWorkspaceContext
      // should pick that one.
      workspacesService.findPersonalWorkspace.mockResolvedValue(null);
      workspacesService.listForUser.mockResolvedValue([
        {
          id: 'team-ws-1',
          name: 'Team',
          role: 'editor',
        } as never,
      ]);
    });

    it('rejects when invitation email does not match register email', async () => {
      usersService.emailExists.mockResolvedValue(false);
      invitationsService.getMetaByToken.mockResolvedValue({
        workspaceName: 'Team',
        invitedByName: 'Alice',
        email: 'invited@example.com',
        role: 'editor',
        expiresAt: new Date(Date.now() + 60_000),
      });

      await expect(
        service.register({
          name: 'Test',
          email: 'someone-else@example.com',
          password: 'Test123!@#',
          invitationToken: 'a'.repeat(64),
        }),
      ).rejects.toThrow(BadRequestException);

      expect(usersService.create).not.toHaveBeenCalled();
      expect(mailService.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('creates user inside transaction, consumes invitation, auto-logs in, no verification email', async () => {
      usersService.emailExists.mockResolvedValue(false);
      invitationsService.getMetaByToken.mockResolvedValue({
        workspaceName: 'Team',
        invitedByName: 'Alice',
        email: 'invited@example.com',
        role: 'editor',
        expiresAt: new Date(Date.now() + 60_000),
      });
      invitationsService.consumeForRegistration.mockResolvedValue({
        workspaceId: 'team-ws-1',
        role: 'editor',
        email: 'invited@example.com',
      });

      const result = await service.register({
        name: 'Invitee',
        email: 'invited@example.com',
        password: 'Test123!@#',
        invitationToken: 'a'.repeat(64),
      });

      if (!('accessToken' in result)) {
        throw new Error('expected accessToken in invitation-flow response');
      }
      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBeDefined();

      // Verification email must NOT be sent (token proves email ownership).
      expect(mailService.sendVerificationEmail).not.toHaveBeenCalled();
      // usersService.create (which is the no-invitation path) is bypassed.
      expect(usersService.create).not.toHaveBeenCalled();
      // Transaction wrapped the user creation + invitation consumption.
      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(invitationsService.consumeForRegistration).toHaveBeenCalledWith(
        expect.anything(),
        'a'.repeat(64),
        'user-uuid-new',
      );
      // No personal workspace was created — generateTokens used the existing
      // team membership.
      expect(
        workspacesService.findOrCreatePersonalWorkspace,
      ).not.toHaveBeenCalled();
      expect(workspacesService.createPersonalWorkspace).not.toHaveBeenCalled();
    });

    it('propagates GoneException when token is already consumed (transaction rolls back)', async () => {
      usersService.emailExists.mockResolvedValue(false);
      invitationsService.getMetaByToken.mockRejectedValue(
        Object.assign(new Error('used'), { status: 410 }),
      );

      await expect(
        service.register({
          name: 'Test',
          email: 'invited@example.com',
          password: 'Test123!@#',
          invitationToken: 'a'.repeat(64),
        }),
      ).rejects.toBeDefined();

      expect(usersService.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should login with valid credentials', async () => {
      const hash = await bcrypt.hash('Test123!@#', 12);
      usersService.findByEmail.mockResolvedValue({
        ...mockUser,
        passwordHash: hash,
      } as User);

      const result = await service.login({
        email: 'test@example.com',
        password: 'Test123!@#',
      });

      if ('requires2fa' in result) {
        throw new Error('expected token result, got 2FA challenge');
      }
      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBeDefined();
      expect(usersService.resetLoginAttempts).toHaveBeenCalled();
    });

    it('should throw for invalid email', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'wrong@example.com',
          password: 'Test123!@#',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw for invalid password', async () => {
      const hash = await bcrypt.hash('correct-password', 12);
      usersService.findByEmail.mockResolvedValue({
        ...mockUser,
        passwordHash: hash,
      } as User);

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'wrong-password',
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(usersService.incrementLoginAttempts).toHaveBeenCalled();
    });

    it('should throw for locked account', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as User);
      usersService.isLocked.mockResolvedValue(true);

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'Test123!@#',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw for unverified email', async () => {
      usersService.findByEmail.mockResolvedValue({
        ...mockUser,
        emailVerified: false,
      } as User);

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'Test123!@#',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    // regression: void → await race (fix-login-history-race).
    // login() 응답이 loginHistory.record() 의 INSERT 완료를 기다리지 않으면, 곧바로 이어지는
    // GET /api/users/me/login-history 가 새 row 를 못 보고 끝난다. 같은 핸들러 내에서
    // sequencing 을 검증해 두면, 미래에 누군가 다시 `void` 로 되돌릴 때 즉시 잡힌다.
    it('await contract: returns only after loginHistory.record resolves', async () => {
      const hash = await bcrypt.hash('Test123!@#', 12);
      usersService.findByEmail.mockResolvedValue({
        ...mockUser,
        passwordHash: hash,
      } as User);

      let recordResolved = false;
      loginHistoryService.record.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            setTimeout(() => {
              recordResolved = true;
              resolve();
            }, 30);
          }),
      );

      await service.login({
        email: 'test@example.com',
        password: 'Test123!@#',
      });
      expect(recordResolved).toBe(true);
    });

    // 회귀 가드: 성공 경로에서 login_success 이벤트가 기록되는지 — 미래에 record 호출
    // 자체가 사라지면 audit 가 조용히 깨지는 위험을 차단한다.
    it('records login_success on successful login', async () => {
      const hash = await bcrypt.hash('Test123!@#', 12);
      usersService.findByEmail.mockResolvedValue({
        ...mockUser,
        passwordHash: hash,
      } as User);

      await service.login({
        email: 'test@example.com',
        password: 'Test123!@#',
      });

      expect(loginHistoryService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          email: mockUser.email,
          event: 'login_success',
        }),
      );
    });
  });

  describe('refresh', () => {
    it('should refresh tokens with valid refresh token', async () => {
      refreshTokenRepo.findOne.mockResolvedValue({
        id: 'rt-1',
        userId: mockUser.id,
        familyId: 'family-1',
        isRevoked: false,
        expiresAt: new Date(Date.now() + 86400000),
        user: mockUser,
      });

      const result = await service.refresh('valid-refresh-token');
      expect(result.accessToken).toBe('mock-access-token');
      expect(refreshTokenRepo.update).toHaveBeenCalled();
    });

    it('rotates revoke + issue inside a single transaction (05 C-1 atomicity)', async () => {
      // 05 C-1 회귀 가드: 회전이 단일 트랜잭션 안에서 조건부 revoke + INSERT 로 일어난다.
      refreshTokenRepo.findOne.mockResolvedValue({
        id: 'rt-1',
        userId: mockUser.id,
        familyId: 'family-1',
        isRevoked: false,
        expiresAt: new Date(Date.now() + 86400000),
        user: mockUser,
      });

      await service.refresh('valid-refresh-token');

      // revoke(조건부 UPDATE) 와 신규 토큰 INSERT 는 dataSource.transaction 안에서 일어난다.
      expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
      // revoke 는 id + is_revoked=false + expires_at>now 조건부 UPDATE (TOCTOU 차단).
      expect(refreshTokenRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'rt-1', isRevoked: false }),
        expect.objectContaining({
          isRevoked: true,
          lastUsedAt: expect.any(Date),
          lastUsedIp: null,
        }),
      );
      expect(refreshTokenRepo.save).toHaveBeenCalled();
    });

    it('rejects without issuing a token when the conditional revoke matches 0 rows (concurrent rotation)', async () => {
      // 05 C-1 회귀 가드: 동시 refresh 로 이미 회전된 토큰 — affected=0 이면 신규 토큰을
      // 발급하지 않고 TOKEN_INVALID 로 거부한다 (이중 회전 차단).
      refreshTokenRepo.findOne.mockResolvedValue({
        id: 'rt-1',
        userId: mockUser.id,
        familyId: 'family-1',
        isRevoked: false,
        expiresAt: new Date(Date.now() + 86400000),
        user: mockUser,
      });
      refreshTokenRepo.update.mockResolvedValueOnce({ affected: 0 });

      await expect(service.refresh('raced-refresh-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(refreshTokenRepo.save).not.toHaveBeenCalled();
    });

    it('does not open a transaction for an expired refresh token', async () => {
      // 05 C-1 회귀 가드: 단순 만료는 트랜잭션 진입 전에 401 TOKEN_EXPIRED 로 끝난다.
      refreshTokenRepo.findOne.mockResolvedValue({
        id: 'rt-1',
        userId: mockUser.id,
        familyId: 'family-1',
        isRevoked: false,
        expiresAt: new Date(Date.now() - 1000),
        user: mockUser,
      });

      await expect(service.refresh('expired-refresh-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it('propagates failure when issuing the new token fails (real DB rollback verified by e2e)', async () => {
      // 05 C-1 회귀 가드: INSERT(신규 토큰 save) 실패 시 트랜잭션이 reject 된다.
      // 단위 mock 은 실제 DB 롤백을 재현하지 못하므로 여기선 에러 전파만 검증하고,
      // revoke+INSERT 가 한 트랜잭션 안에 있어 롤백된다는 사실은 dockerized e2e 로 보장한다.
      refreshTokenRepo.findOne.mockResolvedValue({
        id: 'rt-1',
        userId: mockUser.id,
        familyId: 'family-1',
        isRevoked: false,
        expiresAt: new Date(Date.now() + 86400000),
        user: mockUser,
      });
      refreshTokenRepo.save.mockRejectedValueOnce(new Error('insert failed'));

      await expect(service.refresh('valid-refresh-token')).rejects.toThrow(
        'insert failed',
      );
      expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
      // revoke 는 시도됐으나(조건부 UPDATE) INSERT 실패로 트랜잭션 전체가 reject —
      // 실 DB 에선 이 revoke 도 롤백된다(단위 mock 은 롤백 미재현).
      expect(refreshTokenRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'rt-1', isRevoked: false }),
        expect.objectContaining({ isRevoked: true }),
      );
    });

    it('should revoke family on reuse detection', async () => {
      refreshTokenRepo.findOne.mockResolvedValue({
        id: 'rt-1',
        userId: mockUser.id,
        familyId: 'family-1',
        isRevoked: true,
        expiresAt: new Date(Date.now() + 86400000),
        user: mockUser,
      });

      await expect(service.refresh('reused-refresh-token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(refreshTokenRepo.update).toHaveBeenCalledWith(
        { familyId: 'family-1' },
        { isRevoked: true },
      );
      // reuse 감지는 보안 이벤트로 LoginHistory 에 반드시 기록되어야 한다.
      const loginHistoryRecord = (
        service as unknown as {
          loginHistory: { record: jest.Mock };
        }
      ).loginHistory.record;
      expect(loginHistoryRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'token_reuse_detected',
          familyId: 'family-1',
        }),
      );
    });
  });

  describe('checkEmail', () => {
    it('should return available: true for new email', async () => {
      usersService.emailExists.mockResolvedValue(false);
      const result = await service.checkEmail('new@example.com');
      expect(result.available).toBe(true);
    });

    it('should return available: false for existing email', async () => {
      usersService.emailExists.mockResolvedValue(true);
      const result = await service.checkEmail('existing@example.com');
      expect(result.available).toBe(false);
    });
  });

  describe('resendVerification', () => {
    it('should return the same message regardless of email existence', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      const result = await service.resendVerification(
        'nonexistent@example.com',
      );
      expect(result.message).toContain('If an account exists');
      expect(mailService.sendVerificationEmail).not.toHaveBeenCalled();
      expect(usersService.update).not.toHaveBeenCalled();
    });

    it('should re-issue a token and mail it for an unverified account', async () => {
      usersService.findByEmail.mockResolvedValue({
        ...mockUser,
        emailVerified: false,
      } as User);

      const result = await service.resendVerification('test@example.com');

      expect(result.message).toContain('If an account exists');
      expect(usersService.update).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({
          emailVerifyToken: expect.any(String),
          emailVerifyExpiresAt: expect.any(Date),
        }),
      );
      const mailCall = mailService.sendVerificationEmail.mock.calls[0];
      expect(mailCall[0]).toBe(mockUser.email);
      expect(mailCall[1]).toBe(mockUser.name);
      const [, patch] = usersService.update.mock.calls[0] as [
        string,
        { emailVerifyToken: string; emailVerifyExpiresAt: Date },
      ];
      // DB stores SHA-256 hash; email carries the raw UUID.
      // The raw token (mailed) must hash to the stored token.
      expect(patch.emailVerifyToken).toMatch(/^[0-9a-f]{64}$/);
      expect(sha256(mailCall[2])).toBe(patch.emailVerifyToken);
    });

    it('should NOT re-issue for an already-verified account', async () => {
      usersService.findByEmail.mockResolvedValue({
        ...mockUser,
        emailVerified: true,
      } as User);

      const result = await service.resendVerification('test@example.com');

      expect(result.message).toContain('If an account exists');
      expect(usersService.update).not.toHaveBeenCalled();
      expect(mailService.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('should return the same message even if mail dispatch fails', async () => {
      usersService.findByEmail.mockResolvedValue({
        ...mockUser,
        emailVerified: false,
      } as User);
      mailService.sendVerificationEmail.mockRejectedValueOnce(
        new Error('SMTP error'),
      );

      const result = await service.resendVerification('test@example.com');

      expect(result.message).toContain('If an account exists');
    });
  });

  describe('forgotPassword', () => {
    it('should always return same message regardless of email existence', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      const result = await service.forgotPassword('nonexistent@example.com');
      expect(result.message).toContain('If an account exists');
      expect(mailService.sendPasswordResetEmail).not.toHaveBeenCalled();
      expect(usersService.update).not.toHaveBeenCalled();
    });

    it('should persist a hashed token and mail the raw token to the user', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as User);
      const before = Date.now();

      const result = await service.forgotPassword('test@example.com');
      const after = Date.now();

      expect(result.message).toContain('If an account exists');
      expect(usersService.update).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({
          passwordResetToken: expect.any(String),
          passwordResetExpiresAt: expect.any(Date),
        }),
      );
      const [, patch] = usersService.update.mock.calls[0] as [
        string,
        { passwordResetToken: string; passwordResetExpiresAt: Date },
      ];

      // Token persisted to DB must be a SHA-256 hex (64 chars), not the raw UUID.
      expect(patch.passwordResetToken).toMatch(/^[0-9a-f]{64}$/);

      // Expiry must be ~30 minutes from now.
      const expiresAt = patch.passwordResetExpiresAt.getTime();
      expect(expiresAt - before).toBeGreaterThanOrEqual(29 * 60 * 1000);
      expect(expiresAt - after).toBeLessThanOrEqual(30 * 60 * 1000 + 1000);

      // Mail call must receive the RAW token (not the DB-persisted hash),
      // otherwise the reset link in the user's inbox would be unusable.
      const mailCall = mailService.sendPasswordResetEmail.mock.calls[0];
      expect(mailCall[0]).toBe(mockUser.email);
      expect(mailCall[1]).toBe(mockUser.name);
      expect(mailCall[2]).not.toBe(patch.passwordResetToken);
      expect(mailCall[2]).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it('should return the same message even if mail dispatch fails', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as User);
      mailService.sendPasswordResetEmail.mockRejectedValueOnce(
        new Error('SMTP error'),
      );

      const result = await service.forgotPassword('test@example.com');

      expect(result.message).toContain('If an account exists');
      expect(usersService.update).toHaveBeenCalled();
      expect(mailService.sendPasswordResetEmail).toHaveBeenCalled();
    });

    it('should return the same message even if the DB update fails', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as User);
      usersService.update.mockRejectedValueOnce(new Error('DB down'));

      const result = await service.forgotPassword('test@example.com');

      expect(result.message).toContain('If an account exists');
      expect(mailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    // forgot-password 흐름은 로그인 이력 이벤트를 남기지 않는다 (spec/5-system/1-auth.md §4.3
    // 의 이벤트 enum 에 forgot/reset 이 빠진 의도된 설계). 회귀로 "기록 누락처럼 보여" 잘못
    // 채워 넣는 일이 없도록 명시한다.
    it('does not record a login-history event', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser as User);
      await service.forgotPassword('test@example.com');
      expect(loginHistoryService.record).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword (token hashing)', () => {
    it('should look up the user by hashed token (not the raw value)', async () => {
      const rawToken = '11111111-2222-3333-4444-555555555555';
      const userRepoFindOne = jest.fn().mockResolvedValue(null);
      refreshTokenRepo.manager.getRepository.mockReturnValue({
        findOne: userRepoFindOne,
      });

      await expect(
        service.resetPassword(rawToken, 'NewPass123!@#'),
      ).rejects.toThrow(BadRequestException);

      // The raw UUID must never appear in the DB query — only its SHA-256 hash.
      const whereClause = userRepoFindOne.mock.calls[0][0].where as unknown as {
        passwordResetToken: string;
      };
      expect(whereClause.passwordResetToken).not.toBe(rawToken);
      expect(whereClause.passwordResetToken).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('generateTokens (via login)', () => {
    it('should create personal workspace as fallback when user has no memberships', async () => {
      const hash = await bcrypt.hash('Test123!@#', 12);
      usersService.findByEmail.mockResolvedValue({
        ...mockUser,
        passwordHash: hash,
      } as User);

      // resolveTokenWorkspaceContext order: findPersonalWorkspace → listForUser → fallback create.
      workspacesService.findPersonalWorkspace.mockResolvedValue(null);
      workspacesService.listForUser.mockResolvedValue([]);
      workspacesService.findOrCreatePersonalWorkspace.mockResolvedValue({
        id: 'new-ws-uuid',
      } as never);

      const result = await service.login({
        email: 'test@example.com',
        password: 'Test123!@#',
      });

      if ('requires2fa' in result) {
        throw new Error('expected token result, got 2FA challenge');
      }
      expect(result.accessToken).toBe('mock-access-token');
      expect(
        workspacesService.findOrCreatePersonalWorkspace,
      ).toHaveBeenCalledWith('user-uuid-1', 'Test User', 'test@example.com');
    });

    it('uses existing membership over creating a personal workspace', async () => {
      const hash = await bcrypt.hash('Test123!@#', 12);
      usersService.findByEmail.mockResolvedValue({
        ...mockUser,
        passwordHash: hash,
      } as User);

      // Invitation-token sign-up scenario: no personal workspace, but a team
      // membership exists — generateTokens must not auto-create personal.
      workspacesService.findPersonalWorkspace.mockResolvedValue(null);
      workspacesService.listForUser.mockResolvedValue([
        { id: 'team-ws-1', name: 'Team', role: 'editor' } as never,
      ]);

      const result = await service.login({
        email: 'test@example.com',
        password: 'Test123!@#',
      });

      if ('requires2fa' in result) {
        throw new Error('expected token result, got 2FA challenge');
      }
      expect(result.accessToken).toBe('mock-access-token');
      expect(
        workspacesService.findOrCreatePersonalWorkspace,
      ).not.toHaveBeenCalled();
      expect(workspacesService.createPersonalWorkspace).not.toHaveBeenCalled();
    });
  });

  describe('verifyEmail', () => {
    it('should verify email and create workspace in transaction', async () => {
      const unverifiedUser = {
        ...mockUser,
        emailVerified: false,
        emailVerifyToken: 'valid-token',
        emailVerifyExpiresAt: new Date(Date.now() + 86400000),
      } as User;

      usersService.findByEmail.mockResolvedValue(null);
      jest
        .spyOn(service as never, 'findUserByVerifyToken' as never)
        .mockResolvedValue(unverifiedUser as never);

      const result = await service.verifyEmail('valid-token');

      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBeDefined();
    });

    it('should throw for invalid verification token', async () => {
      jest
        .spyOn(service as never, 'findUserByVerifyToken' as never)
        .mockResolvedValue(null as never);

      await expect(service.verifyEmail('invalid-token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw for expired verification token', async () => {
      const expiredUser = {
        ...mockUser,
        emailVerified: false,
        emailVerifyToken: 'expired-token',
        emailVerifyExpiresAt: new Date(Date.now() - 86400000),
      } as User;

      jest
        .spyOn(service as never, 'findUserByVerifyToken' as never)
        .mockResolvedValue(expiredUser as never);

      await expect(service.verifyEmail('expired-token')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('rotateSessionAfterPasswordChange (refactor 04 A-1 — 옵션 B)', () => {
    it('revokes all families then issues a fresh session for the current device', async () => {
      usersService.findById.mockResolvedValue({
        ...mockUser,
        id: 'user-uuid-1',
      } as User);
      const ctx = { ip: '9.9.9.9', userAgent: 'agent-x' };

      const tokens = await service.rotateSessionAfterPasswordChange(
        'user-uuid-1',
        ctx,
      );

      expect(sessionsService.revokeAllFamilies).toHaveBeenCalledWith(
        'user-uuid-1',
        ctx,
      );
      expect(tokens.accessToken).toBe('mock-access-token');
      expect(tokens.refreshToken).toBeDefined();

      // 순서 불변식(옵션 B 보안 핵심): 전 family revoke 가 새 토큰 발급보다 **먼저** 일어나야
      // 한다. 순서가 뒤집히면 방금 발급한 새 family 까지 revoke 돼 현재 디바이스가 끊긴다.
      const revokeOrder = (sessionsService.revokeAllFamilies as jest.Mock).mock
        .invocationCallOrder[0];
      const signOrder = (jwtService.sign as jest.Mock).mock
        .invocationCallOrder[0];
      expect(revokeOrder).toBeLessThan(signOrder);
    });

    it('throws UnauthorizedException when the user is missing', async () => {
      usersService.findById.mockResolvedValue(null);
      await expect(
        service.rotateSessionAfterPasswordChange('ghost', {}),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
