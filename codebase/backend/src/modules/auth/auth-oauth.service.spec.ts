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
    /**
     * **raw `.query()` 가 실제로 돌려주는 shape** — ORM 매핑을 안 타므로 컬럼명이
     * DB 그대로 snake_case 다.
     *
     * 이 fixture 는 원래 `rememberMe`/`expiresAt`(entity 형태)였다. 그래서 코드가
     * `record.rememberMe` 를 읽어도 초록이었고, **"로그인 유지" 가 통째로 무시되는
     * 결함을 이 스위트가 4개월간 통과시켰다**. 튜플 shape 과 같은 함정이 컬럼명 축에서
     * 한 번 더 반복된 것이다.
     */
    const validState = {
      state: 'abc',
      provider: 'google',
      mode: 'login',
      remember_me: false,
      expires_at: new Date(Date.now() + 60000),
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

    /**
     * 예외 **클래스**만 보면 이 테스트는 판별력이 없다 — 튜플을 행 배열로 오인해도
     * (`[[],0].length === 2 ≠ 0`) `record` 가 `[]` 라 `provider` 불일치 분기가 대신
     * 같은 `BadRequestException` 을 던져 우연히 통과한다 (`00_20_21` testing W3).
     * 그래서 **어느 분기가 던졌는지** 를 message 로 못박는다.
     */
    it('실측 shape 에서 0행(만료·재사용)은 "0행" 분기가 거절해야 한다', async () => {
      dataSource.query.mockResolvedValueOnce([[], 0]);

      await expect(
        service.handleCallback('google', 'code', 'abc'),
      ).rejects.toMatchObject({
        response: {
          code: 'OAUTH_STATE_MISMATCH',
          message: 'Invalid, expired, or already consumed OAuth state',
        },
      });
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

    /**
     * **이 테스트는 정확히 이 결함을 잡으라고 만들어졌는데, 4개월간 놓쳤다.**
     *
     * mock 이 `[{ …, rememberMe: true }]` 였다 — 행 배열(튜플 아님) + camelCase.
     * 코드도 같은 두 오해를 갖고 있어서 **mock 과 코드가 서로를 검증해 주고** 초록이었다.
     * 실제 raw 행은 `[[{ …, remember_me: true }], 1]` 이고, 이 형태로 바꾸면 즉시 RED 다
     * (`00_20_21` requirement CRITICAL).
     *
     * `true` 인 게 중요하다 — `false` 면 정답(`false`)과 버그(`undefined`)가
     * `rememberMe ? 30 : 7` 에서 같은 값을 내 **분기가 갈리지 않는다.**
     */
    it('propagates rememberMe through to token issuance', async () => {
      dataSource.query.mockResolvedValueOnce([
        [{ ...validState, remember_me: true }],
        1,
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
