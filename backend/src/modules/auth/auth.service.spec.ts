/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
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
import { User } from '../users/entities/user.entity';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let workspacesService: jest.Mocked<WorkspacesService>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let jwtService: jest.Mocked<JwtService>;
  let refreshTokenRepo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    manager: { getRepository: jest.Mock };
  };

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
            getMemberRole: jest.fn().mockResolvedValue('owner'),
          },
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: mockRefreshTokenRepo,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    workspacesService = module.get(WorkspacesService);
    jwtService = module.get(JwtService);
    refreshTokenRepo = module.get(getRepositoryToken(RefreshToken));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should register a new user', async () => {
      usersService.emailExists.mockResolvedValue(false);
      usersService.create.mockResolvedValue(mockUser as User);

      const result = await service.register({
        name: 'Test',
        email: 'test@example.com',
        password: 'Test123!@#',
      });

      expect(result.message).toContain('verify your email');
      expect(usersService.create).toHaveBeenCalled();
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
    });
  });
});
