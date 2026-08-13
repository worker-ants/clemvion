import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { AuthOauthService } from './auth-oauth.service';
import { AuthOAuthState } from './entities/auth-oauth-state.entity';
import { UsersService } from '../users/users.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';

describe('AuthOauthService', () => {
  let service: AuthOauthService;
  let usersService: jest.Mocked<UsersService>;
  let workspacesService: jest.Mocked<WorkspacesService>;
  let authService: jest.Mocked<AuthService>;
  let dataSource: {
    query: jest.Mock;
    transaction: jest.Mock;
    getRepository: jest.Mock;
  };
  let stateRepo: {
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };

  const baseUser: Partial<User> = {
    id: 'user-1',
    email: 'alice@example.com',
    name: 'Alice',
    emailVerified: true,
  };

  const originalEnv = { ...process.env };

  afterAll(() => {
    process.env = originalEnv;
  });

  beforeEach(async () => {
    process.env.OAUTH_STUB_MODE = 'true';
    process.env.GOOGLE_CLIENT_ID = 'test-google-client';
    process.env.GITHUB_CLIENT_ID = 'test-github-client';
    process.env.APP_URL = 'http://localhost:3011';

    stateRepo = {
      create: jest.fn().mockImplementation((data) => data),
      save: jest.fn().mockImplementation((data) => Promise.resolve(data)),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const qbUpdateResult = { execute: jest.fn().mockResolvedValue(undefined) };
    const qbUpdate = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    };
    Object.assign(qbUpdate, qbUpdateResult);
    const userRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(qbUpdate),
    };
    const txnUserRepo = {
      create: jest.fn().mockImplementation((data) => data),
      save: jest
        .fn()
        .mockImplementation((data) =>
          Promise.resolve({ id: 'user-new', ...data }),
        ),
    };
    dataSource = {
      query: jest.fn(),
      getRepository: jest.fn().mockReturnValue(userRepo),
      transaction: jest
        .fn()
        .mockImplementation((cb: (m: unknown) => Promise<unknown>) =>
          cb({ getRepository: jest.fn().mockReturnValue(txnUserRepo) }),
        ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthOauthService,
        {
          provide: getRepositoryToken(AuthOAuthState),
          useValue: stateRepo,
        },
        { provide: DataSource, useValue: dataSource },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('http://localhost:3011'),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findByOauth: jest.fn(),
            findByEmail: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: WorkspacesService,
          useValue: {
            createPersonalWorkspace: jest.fn().mockResolvedValue({
              id: 'ws-1',
            }),
          },
        },
        {
          provide: AuthService,
          useValue: {
            issueTokensForOauthUser: jest.fn().mockResolvedValue({
              accessToken: 'access-token',
              refreshToken: 'refresh-token',
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthOauthService>(AuthOauthService);
    usersService = module.get(UsersService);
    workspacesService = module.get(WorkspacesService);
    authService = module.get(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getEnabledProviders', () => {
    it('returns all providers in stub mode regardless of credentials', () => {
      process.env.OAUTH_STUB_MODE = 'true';
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GITHUB_CLIENT_ID;
      expect(service.getEnabledProviders()).toEqual(['google', 'github']);
    });

    it('returns only providers with CLIENT_ID set when stub mode off', () => {
      process.env.OAUTH_STUB_MODE = 'false';
      process.env.GOOGLE_CLIENT_ID = 'real-google';
      delete process.env.GITHUB_CLIENT_ID;
      expect(service.getEnabledProviders()).toEqual(['google']);
    });

    it('returns empty when stub off and no credentials set', () => {
      process.env.OAUTH_STUB_MODE = 'false';
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GITHUB_CLIENT_ID;
      expect(service.getEnabledProviders()).toEqual([]);
    });
  });

  describe('beginAuth', () => {
    it('persists state and returns Google authorize URL', async () => {
      const { authUrl } = await service.beginAuth('google', {
        mode: 'login',
        rememberMe: false,
      });
      expect(authUrl).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(authUrl).toContain('client_id=test-google-client');
      expect(authUrl).toContain('scope=openid+email+profile');
      expect(stateRepo.save).toHaveBeenCalledTimes(1);
    });

    it('returns GitHub authorize URL', async () => {
      const { authUrl } = await service.beginAuth('github', {
        mode: 'register',
        rememberMe: true,
      });
      expect(authUrl).toContain('https://github.com/login/oauth/authorize');
      expect(authUrl).toContain('client_id=test-github-client');
    });

    it('rejects unknown provider', async () => {
      await expect(
        service.beginAuth('facebook', { mode: 'login', rememberMe: false }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('handleCallback', () => {
    const validState = {
      state: 'abc',
      provider: 'google',
      mode: 'login',
      rememberMe: false,
      expiresAt: new Date(Date.now() + 60000),
    };

    it('throws OAUTH_STATE_MISMATCH when state is missing', async () => {
      dataSource.query.mockResolvedValueOnce([]);
      await expect(
        service.handleCallback('google', 'code', 'missing'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when provider does not match state record', async () => {
      dataSource.query.mockResolvedValueOnce([
        { ...validState, provider: 'github' },
      ]);
      await expect(
        service.handleCallback('google', 'code', 'abc'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when state is expired (filtered out by SQL)', async () => {
      // Expired rows do not satisfy `expires_at > NOW()`, so the atomic
      // DELETE returns zero rows — indistinguishable from unknown state.
      dataSource.query.mockResolvedValueOnce([]);
      await expect(
        service.handleCallback('google', 'code', 'abc'),
      ).rejects.toThrow(BadRequestException);
    });

    /**
     * **드라이버가 실제로 돌려주는 shape 로 콜백을 태운다.**
     *
     * `DELETE … RETURNING *` 은 typeorm 0.3.31 + pg 에서 `[rows, rowCount]` 튜플이다
     * (실측). 그런데 이 스위트의 다른 테스트들은 `[validState]`(행 배열)를 mock 해 왔다.
     * 그 결과:
     *   - `consumed.length === 0` → 항상 2 → **만료·재사용 state 를 못 거절**
     *   - `consumed[0]` → 행이 아니라 **행 배열** → `record.provider` 가 `undefined`
     *   - `undefined !== 'google'` → **모든 정상 콜백이 OAUTH_STATE_MISMATCH 로 실패**
     *
     * 즉 소셜 로그인이 상시 실패한다. 같은 모듈의 `integration-oauth.service.ts` 는
     * 튜플을 명시 타입으로 받아 `queryResult[0]` 으로 꺼내고 있어 대조가 된다.
     */
    it('실측 shape([rows,count])로도 정상 콜백이 성공해야 한다', async () => {
      dataSource.query.mockResolvedValueOnce([[validState], 1]);
      usersService.findByOauth.mockResolvedValue(baseUser as User);

      await expect(
        service.handleCallback('google', 'code', 'abc'),
      ).resolves.toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        rememberMe: false,
      });
    });

    it('실측 shape 에서 0행(만료·재사용)은 여전히 거절돼야 한다', async () => {
      dataSource.query.mockResolvedValueOnce([[], 0]);

      await expect(
        service.handleCallback('google', 'code', 'abc'),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns tokens for existing OAuth user (stub mode)', async () => {
      dataSource.query.mockResolvedValueOnce([validState]);
      usersService.findByOauth.mockResolvedValue(baseUser as User);

      const result = await service.handleCallback('google', 'code', 'abc');

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        rememberMe: false,
      });
      expect(authService.issueTokensForOauthUser).toHaveBeenCalledWith(
        baseUser,
        false,
        expect.any(Object),
      );
      expect(usersService.create).not.toHaveBeenCalled();
      expect(workspacesService.createPersonalWorkspace).not.toHaveBeenCalled();
    });

    it('conditionally links existing email user via queryBuilder', async () => {
      dataSource.query.mockResolvedValueOnce([validState]);
      usersService.findByOauth.mockResolvedValue(null);
      usersService.findByEmail.mockResolvedValue(baseUser as User);
      usersService.findById.mockResolvedValue({
        ...baseUser,
        oauthProvider: 'google',
      } as User);

      await service.handleCallback('google', 'code', 'abc');

      expect(dataSource.getRepository).toHaveBeenCalled();
      expect(usersService.findById).toHaveBeenCalledWith(baseUser.id);
      expect(usersService.create).not.toHaveBeenCalled();
      expect(usersService.update).not.toHaveBeenCalled();
    });

    it('creates new user and personal workspace on first OAuth login', async () => {
      dataSource.query.mockResolvedValueOnce([validState]);
      usersService.findByOauth.mockResolvedValue(null);
      usersService.findByEmail.mockResolvedValue(null);

      await service.handleCallback('google', 'code', 'abc');

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(workspacesService.createPersonalWorkspace).toHaveBeenCalledTimes(
        1,
      );
      expect(authService.issueTokensForOauthUser).toHaveBeenCalled();
    });

    it('recovers from concurrent first-time OAuth (unique violation)', async () => {
      dataSource.query.mockResolvedValueOnce([validState]);
      usersService.findByOauth
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(baseUser as User);
      usersService.findByEmail.mockResolvedValue(null);
      // Simulate the transaction throwing a Postgres unique-violation.
      dataSource.transaction.mockRejectedValueOnce(
        Object.assign(new Error('duplicate key'), { code: '23505' }),
      );

      const result = await service.handleCallback('google', 'code', 'abc');

      expect(result.accessToken).toBe('access-token');
      expect(usersService.findByOauth).toHaveBeenCalledTimes(2);
    });

    it('propagates rememberMe through to token issuance', async () => {
      dataSource.query.mockResolvedValueOnce([
        { ...validState, rememberMe: true },
      ]);
      usersService.findByOauth.mockResolvedValue(baseUser as User);

      const result = await service.handleCallback('google', 'code', 'abc');

      expect(result.rememberMe).toBe(true);
      expect(authService.issueTokensForOauthUser).toHaveBeenCalledWith(
        baseUser,
        true,
        expect.any(Object),
      );
    });
  });
});
