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
import { UsersService } from '../users/users.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { WorkspaceInvitationsService } from '../workspaces/workspace-invitations.service';
import { MailService } from '../mail/mail.service';
import { User } from '../users/entities/user.entity';
import { LoginHistoryService } from './login-history.service';

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
      update: jest.fn().mockResolvedValue(undefined),
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
          provide: DataSource,
          useValue: {
            transaction: jest
              .fn()
              .mockImplementation((cb: (manager: unknown) => Promise<void>) => {
                const mockManager = {
                  getRepository: jest.fn().mockReturnValue({
                    update: jest.fn().mockResolvedValue(undefined),
                  }),
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

      if ('requiresTotp' in result) {
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

      if ('requiresTotp' in result) {
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

      if ('requiresTotp' in result) {
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
});
