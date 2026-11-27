import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  IntegrationOAuthService,
  LAST_ERROR_MESSAGE_MAX_LEN,
  attachCallbackContext,
  callbackContextOf,
  sanitizeLastErrorMessage,
} from './integration-oauth.service';
import { createIntegrationOAuthService } from './__test-utils__/integration-oauth-service.factory';
import { makeOAuthConfigMock } from './__test-utils__/oauth-config-mock';
import { integrationNotFoundError } from './integration-visibility';

type Mock = jest.Mock;

function makeRepo(): Record<string, Mock> {
  return {
    create: jest.fn().mockImplementation((data: unknown) => data),
    save: jest
      .fn()
      .mockImplementation((entity: unknown) => Promise.resolve(entity)),
    findOne: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue(undefined),
  };
}

describe('IntegrationOAuthService', () => {
  let service: IntegrationOAuthService;
  let oauthMock: ReturnType<typeof makeOAuthConfigMock>;
  // review W2: OAUTH_STUB_MODE 초기값 보존 — suite 진입 전 설정돼 있던 값을 afterEach 에서 원복.
  let savedOAuthStub: string | undefined;
  let integrationRepo: Record<string, Mock>;
  let stateRepo: Record<string, Mock>;
  let previewRepo: Record<string, Mock>;
  let dataSource: {
    query: Mock;
    transaction: Mock;
  };
  let actionRequiredNotifier: { notify: Mock };

  /** 이 spec 의 대역으로 서비스를 만든다. 바꿀 협력 객체만 덮어 넘긴다(`createIntegrationOAuthService`). */
  const serviceDeps = () => ({
    integrationRepo,
    stateRepo,
    previewRepo,
    dataSource,
    actionRequiredNotifier,
    configService: oauthMock.configService,
  });

  beforeEach(() => {
    integrationRepo = makeRepo();
    stateRepo = makeRepo();
    previewRepo = makeRepo();
    actionRequiredNotifier = { notify: jest.fn().mockResolvedValue(undefined) };
    dataSource = {
      query: jest.fn().mockResolvedValue([]),
      transaction: jest
        .fn()
        .mockImplementation(
          async (cb: (manager: { getRepository: Mock }) => Promise<void>) => {
            await cb({
              getRepository: jest.fn().mockReturnValue(integrationRepo),
            });
          },
        ),
    };

    savedOAuthStub = process.env.OAUTH_STUB_MODE;
    process.env.OAUTH_STUB_MODE = 'true';
    // refactor M-6: provider 자격증명은 `oauth` namespace 로 이전 — config mock 으로 제공.
    oauthMock = makeOAuthConfigMock();

    service = createIntegrationOAuthService(serviceDeps());
  });

  /** 콜백의 커밋 직전 재판정을 통과하는 요청자(편집자) — 재인증 · scope 추가 콜백의 성공 경로가 쓴다. */
  const serviceAsEditor = () =>
    createIntegrationOAuthService({
      ...serviceDeps(),
      workspacesService: { getMemberRole: jest.fn(async () => 'editor') },
    });

  afterEach(() => {
    if (savedOAuthStub === undefined) delete process.env.OAUTH_STUB_MODE;
    else process.env.OAUTH_STUB_MODE = savedOAuthStub;
  });

  describe('begin', () => {
    it('throws when service is not OAuth-capable', async () => {
      await expect(
        service.begin({
          workspaceId: 'ws-1',
          userId: 'u-1',
          service: 'http',
          scopes: [],
          mode: 'new',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws InternalServerError when CLIENT_ID env var is missing', async () => {
      oauthMock.env.google.clientId = '';
      await expect(
        service.begin({
          workspaceId: 'ws-1',
          userId: 'u-1',
          service: 'google',
          scopes: ['https://www.googleapis.com/auth/drive'],
          mode: 'new',
        }),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('returns authUrl and persists state for new mode', async () => {
      oauthMock.env.google.clientId = 'cid-123';
      const result = await service.begin({
        workspaceId: 'ws-1',
        userId: 'u-1',
        service: 'google',
        scopes: [
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/calendar',
        ],
        mode: 'new',
      });
      expect(result.authUrl).toContain('client_id=cid-123');
      expect(result.authUrl).toContain('https');
      expect(result.state).toHaveLength(48);
      expect(stateRepo.save).toHaveBeenCalled();
    });

    // CLE-T-HBDGPZ — `new` 는 새 통합을 만드는 흐름이라 대상 통합이 없다. 요청 본문의 `integrationId` 를 state 에 실으면
    // 콜백 실패가 그 행(남의 개인 통합 포함)에 기록되고 알림이 나가므로 무시한다.
    it('mode=new 는 요청의 integrationId 를 state 에 싣지 않는다', async () => {
      oauthMock.env.google.clientId = 'cid-123';
      await service.begin({
        workspaceId: 'ws-1',
        userId: 'u-1',
        service: 'google',
        scopes: ['https://www.googleapis.com/auth/drive'],
        mode: 'new',
        integrationId: 'other-integration',
      });
      expect(stateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'new', integrationId: null }),
      );
    });

    // REQ-INTOAUTH-064 — `new` 는 통합 생성과 같은 인가를 받는다. 컨트롤러가 먼저 보지만 서비스도 다시 본다(Task
    // CLE-T-JDQYT8). 역할이 없으면 관리자 미만으로 본다.
    describe('new 모드의 생성 인가', () => {
      const params = (
        overrides: Partial<Parameters<IntegrationOAuthService['begin']>[0]>,
      ) => ({
        workspaceId: 'ws-1',
        userId: 'u-1',
        service: 'google',
        scopes: ['https://www.googleapis.com/auth/drive'],
        mode: 'new' as const,
        ...overrides,
      });

      it.each([
        ['역할이 없으면', undefined],
        ['역할이 null 이면', null],
        ['편집자면', 'editor'],
      ])(
        '%s 조직 범위는 403 ADMIN_REQUIRED 이고 state 를 만들지 않는다',
        async (_label, requesterRole) => {
          oauthMock.env.google.clientId = 'cid-123';
          const error = (await service
            .begin(params({ scope: 'organization', requesterRole }))
            .catch((err: unknown) => err)) as ForbiddenException;
          expect(error).toBeInstanceOf(ForbiddenException);
          expect(error.getResponse()).toMatchObject({ code: 'ADMIN_REQUIRED' });
          expect(stateRepo.save).not.toHaveBeenCalled();
          expect(dataSource.transaction).not.toHaveBeenCalled();
        },
      );

      it('관리자는 조직 범위로 시작한다', async () => {
        oauthMock.env.google.clientId = 'cid-123';
        await service.begin(
          params({ scope: 'organization', requesterRole: 'admin' }),
        );
        expect(stateRepo.save).toHaveBeenCalled();
      });

      it('개인 범위와 범위 생략은 역할 없이도 막지 않는다', async () => {
        oauthMock.env.google.clientId = 'cid-123';
        await service.begin(params({ scope: 'personal' }));
        await service.begin(params({}));
        expect(stateRepo.save).toHaveBeenCalledTimes(2);
      });

      it('Cafe24 Private 조직 범위도 역할이 없으면 설치 대기 행을 쓰기 전에 거절한다', async () => {
        const error = (await service
          .begin(
            params({
              service: 'cafe24',
              scopes: ['mall.read_product'],
              scope: 'organization',
              providerMeta: {
                mall_id: 'priv-shop',
                app_type: 'private',
                client_id: 'cid',
                client_secret: 'csec',
              },
            }),
          )
          .catch((err: unknown) => err)) as ForbiddenException;
        expect(error.getResponse()).toMatchObject({ code: 'ADMIN_REQUIRED' });
        expect(dataSource.transaction).not.toHaveBeenCalled();
      });
    });

    // REQ-INTOAUTH-071 — `new` 가 아닌 모드는 본문의 서비스가 대상 통합의 서비스 유형과 같아야 state 를 만든다. 다르면
    // 콜백이 다른 서비스의 토큰을 대상 통합에 쓴다(CLE-T-9J6W7H).
    describe('new 가 아닌 모드의 대상 통합 대조', () => {
      const MODES = ['reauthorize', 'request_scopes'] as const;
      const params = (mode: (typeof MODES)[number]) => ({
        workspaceId: 'ws-1',
        userId: 'u-1',
        service: 'google',
        scopes: ['https://www.googleapis.com/auth/drive'],
        mode,
        integrationId: 'target',
      });

      beforeEach(() => {
        oauthMock.env.google.clientId = 'cid-123';
      });

      it.each(MODES)(
        'mode=%s — 대상 통합의 서비스 유형이 다르면 400 OAUTH_TARGET_MISMATCH 로 거절하고 state 를 만들지 않는다',
        async (mode) => {
          integrationRepo.findOne.mockResolvedValue({
            id: 'target',
            workspaceId: 'ws-1',
            serviceType: 'github',
            credentials: { access_token: 'gh' },
          });

          const error = await service
            .begin(params(mode))
            .catch((err: Error) => err);

          expect(error).toBeInstanceOf(BadRequestException);
          expect(
            (error as { response?: Record<string, unknown> }).response,
          ).toEqual({
            code: 'OAUTH_TARGET_MISMATCH',
            message: expect.any(String),
          });
          expect(integrationRepo.findOne).toHaveBeenCalledWith({
            where: { id: 'target', workspaceId: 'ws-1' },
          });
          expect(stateRepo.save).not.toHaveBeenCalled();
        },
      );

      it.each(MODES)(
        'mode=%s — 대상 통합과 서비스 유형이 같으면 state 를 만든다',
        async (mode) => {
          integrationRepo.findOne.mockResolvedValue({
            id: 'target',
            workspaceId: 'ws-1',
            serviceType: 'google',
            credentials: { access_token: 'g' },
          });

          const result = await service.begin(params(mode));

          expect(result).toEqual(
            expect.objectContaining({
              authUrl: expect.stringContaining('client_id=cid-123'),
            }),
          );
          expect(stateRepo.create).toHaveBeenCalledWith(
            expect.objectContaining({ mode, integrationId: 'target' }),
          );
          expect(stateRepo.save).toHaveBeenCalledTimes(1);
        },
      );

      it('대상 통합이 없으면 404 RESOURCE_NOT_FOUND 로 거절하고 state 를 만들지 않는다', async () => {
        integrationRepo.findOne.mockResolvedValue(null);

        const error = await service
          .begin(params('reauthorize'))
          .catch((err: Error) => err);

        expect(error).toBeInstanceOf(NotFoundException);
        expect((error as { response?: { code?: string } }).response?.code).toBe(
          'RESOURCE_NOT_FOUND',
        );
        expect(stateRepo.save).not.toHaveBeenCalled();
      });

      // 판정은 state 를 만들기 직전이다. 서버 설정이 없으면 지금처럼 500 이 먼저다.
      it('OAuth 앱 설정이 없으면 대조 전에 500 OAUTH_CONFIG_MISSING', async () => {
        oauthMock.env.google.clientId = '';

        await expect(service.begin(params('reauthorize'))).rejects.toThrow(
          InternalServerErrorException,
        );
        expect(integrationRepo.findOne).not.toHaveBeenCalled();
      });
    });
  });

  describe('handleCallback', () => {
    it('rejects unknown provider', async () => {
      await expect(
        service.handleCallback('evil', { code: 'x', state: 'y' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects on error param', async () => {
      await expect(
        service.handleCallback('google', { error: 'access_denied' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects on missing state', async () => {
      await expect(
        service.handleCallback('google', { code: 'x' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects on missing code', async () => {
      await expect(
        service.handleCallback('google', { state: 'y' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects already-consumed state', async () => {
      dataSource.query.mockResolvedValue([[], 0]);
      await expect(
        service.handleCallback('google', { code: 'x', state: 'y' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects expired state', async () => {
      dataSource.query.mockResolvedValue([
        [
          {
            provider: 'google',
            serviceType: 'google',
            mode: 'new',
            workspaceId: 'ws-1',
            userId: 'u-1',
            requestedScopes: ['https://www.googleapis.com/auth/drive'],
            integrationId: null,
            expiresAt: new Date(Date.now() - 60_000),
          },
        ],
        1,
      ]);
      await expect(
        service.handleCallback('google', { code: 'x', state: 'y' }),
      ).rejects.toThrow(BadRequestException);
    });

    // B-5-7: provider_mismatch — state.provider 가 callback 경로의 provider 와
    // 다르면 BadRequestException. 옛 회귀에서 같은 state 가 잘못된 provider
    // 콜백을 통과해 다른 서비스로 코드 교환을 시도하는 시나리오 차단.
    it('rejects provider mismatch (state.provider !== route.provider)', async () => {
      dataSource.query.mockResolvedValue([
        [
          {
            provider: 'google',
            serviceType: 'google',
            mode: 'new',
            workspaceId: 'ws-1',
            userId: 'u-1',
            requestedScopes: ['https://www.googleapis.com/auth/drive'],
            integrationId: null,
            expiresAt: new Date(Date.now() + 60_000),
          },
        ],
        1,
      ]);
      await expect(
        service.handleCallback('github', { code: 'x', state: 'y' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns previewToken for new mode', async () => {
      dataSource.query.mockResolvedValue([
        [
          {
            provider: 'google',
            serviceType: 'google',
            mode: 'new',
            workspaceId: 'ws-1',
            userId: 'u-1',
            requestedScopes: ['https://www.googleapis.com/auth/drive'],
            integrationId: null,
            expiresAt: new Date(Date.now() + 60_000),
          },
        ],
        1,
      ]);
      const result = await service.handleCallback('google', {
        code: 'code-xyz',
        state: 'abc',
      });
      expect(result.mode).toBe('new');
      expect(result.previewToken).toMatch(/^tmp_/);
      expect(previewRepo.save).toHaveBeenCalled();
    });

    it('updates integration for reauthorize mode', async () => {
      dataSource.query.mockResolvedValue([
        [
          {
            provider: 'google',
            serviceType: 'google',
            mode: 'reauthorize',
            workspaceId: 'ws-1',
            userId: 'u-1',
            requestedScopes: ['https://www.googleapis.com/auth/drive'],
            integrationId: 'int-1',
            expiresAt: new Date(Date.now() + 60_000),
          },
        ],
        1,
      ]);
      integrationRepo.findOne.mockResolvedValue({
        id: 'int-1',
        workspaceId: 'ws-1',
        credentials: { access_token: 'old' },
        status: 'error',
        scope: 'personal',
        createdBy: 'u-1',
      });
      const result = await serviceAsEditor().handleCallback('google', {
        code: 'code',
        state: 'abc',
      });
      expect(result.mode).toBe('reauthorize');
      expect(result.integrationId).toBe('int-1');
      expect(integrationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'connected', statusReason: null }),
      );
    });

    it('merges scopes for request_scopes mode', async () => {
      dataSource.query.mockResolvedValue([
        [
          {
            provider: 'google',
            serviceType: 'google',
            mode: 'request_scopes',
            workspaceId: 'ws-1',
            userId: 'u-1',
            requestedScopes: [
              'https://www.googleapis.com/auth/drive',
              'https://www.googleapis.com/auth/gmail.send',
            ],
            integrationId: 'int-1',
            expiresAt: new Date(Date.now() + 60_000),
          },
        ],
        1,
      ]);
      integrationRepo.findOne.mockResolvedValue({
        id: 'int-1',
        workspaceId: 'ws-1',
        credentials: {
          access_token: 'old',
          scopes: ['https://www.googleapis.com/auth/drive'],
        },
        status: 'error',
        scope: 'personal',
        createdBy: 'u-1',
      });
      const result = await serviceAsEditor().handleCallback('google', {
        code: 'code',
        state: 'abc',
      });
      expect(result.mode).toBe('request_scopes');
      const saved = integrationRepo.save.mock.calls[0][0] as {
        credentials: { scopes: string[] };
      };
      expect(saved.credentials.scopes).toEqual(
        expect.arrayContaining([
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/gmail.send',
        ]),
      );
    });
  });

  /**
   * 콜백은 자격 증명을 덮어쓴다 — begin 시점의 판정만으로는 모자라 커밋 직전(락 안)에 다시 본다(spec 통합 §8). begin 과
   * 콜백 사이(state TTL)에 요청자가 강등됐거나 통합이 남의 personal 로 바뀌었을 수 있다.
   */
  describe('handleCallback — 사용자가 시작한 재인증 · scope 추가는 커밋 직전에 인가를 다시 본다', () => {
    const stateOf = (mode: string) => [
      [
        {
          provider: 'google',
          serviceType: 'google',
          mode,
          workspaceId: 'ws-1',
          userId: 'u-1',
          requestedScopes: ['s'],
          integrationId: 'int-1',
          expiresAt: new Date(Date.now() + 60_000),
        },
      ],
      1,
    ];
    const rowOf = (overrides: Record<string, unknown>) => ({
      id: 'int-1',
      workspaceId: 'ws-1',
      credentials: { access_token: 'old', scopes: ['s0'] },
      status: 'connected',
      scope: 'organization',
      createdBy: 'u-9',
      ...overrides,
    });
    let getMemberRole: Mock;
    const serviceWithRole = (role: string | null) => {
      getMemberRole = jest.fn(async () => role);
      return createIntegrationOAuthService({
        ...serviceDeps(),
        workspacesService: { getMemberRole },
      });
    };

    it.each(['reauthorize', 'request_scopes'])(
      '%s — 통합이 그 사이 남의 personal 이 됐으면 404 · 자격 증명을 쓰지 않는다',
      async (mode) => {
        dataSource.query.mockResolvedValue(stateOf(mode));
        integrationRepo.findOne.mockResolvedValue(
          rowOf({ scope: 'personal', createdBy: 'u-2' }),
        );
        await expect(
          serviceWithRole('owner').handleCallback('google', {
            code: 'code',
            state: 'abc',
          }),
        ).rejects.toMatchObject({ response: { code: 'RESOURCE_NOT_FOUND' } });
        expect(integrationRepo.save).not.toHaveBeenCalled();
      },
    );

    it.each([['editor'], ['viewer'], [null]])(
      'Organization 통합 — 요청자가 그 사이 %s 가 됐으면 403 ADMIN_REQUIRED · 쓰지 않는다',
      async (role) => {
        dataSource.query.mockResolvedValue(stateOf('reauthorize'));
        integrationRepo.findOne.mockResolvedValue(rowOf({}));
        await expect(
          serviceWithRole(role).handleCallback('google', {
            code: 'code',
            state: 'abc',
          }),
        ).rejects.toMatchObject({ response: { code: 'ADMIN_REQUIRED' } });
        // 행 락을 쥔 트랜잭션의 커넥션(매니저)으로 읽는다 — 풀에서 두 번째 커넥션을 빌리지 않는다.
        expect(getMemberRole).toHaveBeenCalledWith(
          'ws-1',
          'u-1',
          expect.objectContaining({ getRepository: expect.any(Function) }),
        );
        expect(integrationRepo.save).not.toHaveBeenCalled();
      },
    );

    it.each([
      ['reauthorize', 'reauthorize an Organization integration'],
      ['request_scopes', 'add scopes to an Organization integration'],
    ])('%s — 거부 문구는 그 동작을 말한다(«%s …»)', async (mode, phrase) => {
      dataSource.query.mockResolvedValue(stateOf(mode));
      integrationRepo.findOne.mockResolvedValue(rowOf({}));
      await expect(
        serviceWithRole('editor').handleCallback('google', {
          code: 'code',
          state: 'abc',
        }),
      ).rejects.toMatchObject({
        response: {
          code: 'ADMIN_REQUIRED',
          message: `Admin role or higher is required to ${phrase}.`,
        },
      });
      expect(integrationRepo.save).not.toHaveBeenCalled();
    });

    it.each(['owner', 'admin'])(
      'Organization 통합 — 요청자가 %s 면 커밋한다',
      async (role) => {
        dataSource.query.mockResolvedValue(stateOf('reauthorize'));
        integrationRepo.findOne.mockResolvedValue(rowOf({}));
        await serviceWithRole(role).handleCallback('google', {
          code: 'code',
          state: 'abc',
        });
        expect(integrationRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'connected' }),
        );
      },
    );

    // REQ-INTOAUTH-026 — begin 은 라우트 가드가 뷰어를 막지만 시작과 콜백 사이에 뷰어로 강등된 요청자는 콜백에서 막아야 한다.
    it.each([
      ['reauthorize', 'viewer'],
      ['request_scopes', 'viewer'],
      ['reauthorize', null],
    ])(
      '%s — 본인 personal 이라도 요청자가 그 사이 %s 가 됐으면 403 EDITOR_REQUIRED · 쓰지 않는다',
      async (mode, role) => {
        dataSource.query.mockResolvedValue(stateOf(mode));
        integrationRepo.findOne.mockResolvedValue(
          rowOf({ scope: 'personal', createdBy: 'u-1' }),
        );
        await expect(
          serviceWithRole(role).handleCallback('google', {
            code: 'code',
            state: 'abc',
          }),
        ).rejects.toMatchObject({
          response: {
            code: 'EDITOR_REQUIRED',
            message: 'Editor role or higher is required.',
          },
        });
        expect(getMemberRole).toHaveBeenCalledWith(
          'ws-1',
          'u-1',
          expect.objectContaining({ getRepository: expect.any(Function) }),
        );
        expect(integrationRepo.save).not.toHaveBeenCalled();
      },
    );

    it.each(['editor', 'admin', 'owner'])(
      '본인 personal — 요청자가 %s 면 커밋한다',
      async (role) => {
        dataSource.query.mockResolvedValue(stateOf('reauthorize'));
        integrationRepo.findOne.mockResolvedValue(
          rowOf({ scope: 'personal', createdBy: 'u-1' }),
        );
        await serviceWithRole(role).handleCallback('google', {
          code: 'code',
          state: 'abc',
        });
        expect(integrationRepo.save).toHaveBeenCalledTimes(1);
      },
    );

    /**
     * 재판정 실패를 행의 `last_error` 에 남기는가. 요청자에게 보이는 행의 역할 거절(`EDITOR_REQUIRED` · `ADMIN_REQUIRED`)은
     * 남긴다. 요청자가 더는 볼 수 없는 행(`RESOURCE_NOT_FOUND`)에는 쓰지 않는다 — 남의 개인 통합에 그 사람이 모르는 오류를
     * 남기게 된다. 거절은 요청자의 응답으로만 알린다.
     */
    describe('재판정 실패의 기록 (handleCallbackWithErrorCapture)', () => {
      const capture = async (
        role: string | null,
        row: Record<string, unknown>,
      ) => {
        const svc = serviceWithRole(role);
        const mark = jest
          .spyOn(svc, 'markIntegrationCallbackError')
          .mockResolvedValue(undefined);
        dataSource.query.mockResolvedValue(stateOf('reauthorize'));
        integrationRepo.findOne.mockResolvedValue(rowOf(row));
        const thrown: unknown = await svc
          .handleCallbackWithErrorCapture('google', {
            code: 'code',
            state: 'abc',
          })
          .catch((err: unknown) => err);
        return { err: thrown, calls: [...mark.mock.calls] };
      };

      it('남의 personal 이 됐으면 404 만 내고 last_error 를 쓰지 않는다', async () => {
        const { err, calls } = await capture('owner', {
          scope: 'personal',
          createdBy: 'u-2',
        });
        expect(err).toMatchObject({
          response: { code: 'RESOURCE_NOT_FOUND' },
        });
        expect(calls).toEqual([]);
      });

      it.each([
        ['EDITOR_REQUIRED', 'viewer', { scope: 'personal', createdBy: 'u-1' }],
        ['ADMIN_REQUIRED', 'editor', { scope: 'organization' }],
      ])(
        '보이는 행의 역할 거절(%s)은 last_error 에 남긴다',
        async (code, role, row) => {
          const { err, calls } = await capture(role, row);
          expect(err).toMatchObject({ response: { code } });
          expect(calls).toEqual([
            ['int-1', 'ws-1', code, expect.any(String), undefined],
          ]);
        },
      );

      it('신호 없는 404 는 기록한다 — 기록을 건너뛰는 판정은 오류 코드가 아니라 `recordable: false` 다', async () => {
        const svc = serviceWithRole('owner');
        const mark = jest
          .spyOn(svc, 'markIntegrationCallbackError')
          .mockResolvedValue(undefined);
        jest.spyOn(svc, 'handleCallback').mockRejectedValue(
          attachCallbackContext(integrationNotFoundError(), {
            integrationId: 'int-1',
            workspaceId: 'ws-1',
            mode: 'reauthorize',
          }),
        );
        const err: unknown = await svc
          .handleCallbackWithErrorCapture('google', {
            code: 'code',
            state: 'abc',
          })
          .catch((err_: unknown) => err_);
        expect(err).toMatchObject({
          response: { code: 'RESOURCE_NOT_FOUND' },
        });
        expect([...mark.mock.calls]).toEqual([
          [
            'int-1',
            'ws-1',
            'RESOURCE_NOT_FOUND',
            expect.any(String),
            undefined,
          ],
        ]);
      });
    });

    /**
     * 콜백 트랜잭션의 첫 단계만 떼어 본다. state 소비 · 코드 교환을 거치지 않고 거절의 종류와, 그 거절을 행에 남길지 정하는
     * 신호(`CallbackContext.recordable`)를 확인한다.
     */
    describe('lockAndRejudgeCallbackTarget — 잠근 행의 재판정', () => {
      type Rejudge = {
        lockAndRejudgeCallbackTarget(
          manager: unknown,
          record: { workspaceId: string; userId: string; mode: string },
          context: { integrationId: string; workspaceId: string; mode: string },
        ): Promise<unknown>;
      };
      const record = {
        workspaceId: 'ws-1',
        userId: 'u-1',
        mode: 'reauthorize',
      };
      const context = {
        integrationId: 'int-1',
        workspaceId: 'ws-1',
        mode: 'reauthorize',
      };
      const rejudge = (role: string | null): Promise<unknown> =>
        (
          serviceWithRole(role) as unknown as Rejudge
        ).lockAndRejudgeCallbackTarget(
          { getRepository: jest.fn().mockReturnValue(integrationRepo) },
          record,
          context,
        );
      const rejectionOf = (role: string | null): Promise<unknown> =>
        rejudge(role).then(
          () => {
            throw new Error('재판정이 거절하지 않았다');
          },
          (err: unknown) => err,
        );

      it('통과하면 행 락으로 읽은 그 행을 돌려준다', async () => {
        const row = rowOf({});
        integrationRepo.findOne.mockResolvedValue(row);

        await expect(rejudge('admin')).resolves.toBe(row);
        expect(integrationRepo.findOne).toHaveBeenCalledWith({
          where: { id: 'int-1', workspaceId: 'ws-1' },
          lock: { mode: 'pessimistic_write' },
        });
      });

      it('행이 없으면 404 이고 그 거절은 기록하지 않는다고 표시한다', async () => {
        integrationRepo.findOne.mockResolvedValue(null);

        const err = await rejectionOf('owner');

        expect(err).toMatchObject({ response: { code: 'RESOURCE_NOT_FOUND' } });
        expect(callbackContextOf(err)).toEqual({
          ...context,
          recordable: false,
        });
      });

      it('남의 personal 이 됐으면 404 이고 그 거절은 기록하지 않는다고 표시한다', async () => {
        integrationRepo.findOne.mockResolvedValue(
          rowOf({ scope: 'personal', createdBy: 'u-2' }),
        );

        const err = await rejectionOf('owner');

        expect(err).toMatchObject({ response: { code: 'RESOURCE_NOT_FOUND' } });
        expect(callbackContextOf(err)).toEqual({
          ...context,
          recordable: false,
        });
      });

      it('보이는 행의 역할 거절에는 표시를 붙이지 않는다 — 기록 여부는 바깥 컨텍스트가 정한다', async () => {
        integrationRepo.findOne.mockResolvedValue(rowOf({}));

        const err = await rejectionOf('editor');

        expect(err).toMatchObject({ response: { code: 'ADMIN_REQUIRED' } });
        expect(callbackContextOf(err)).toBeUndefined();
      });

      it('설치 기한이 지나 만료된 행은 INTEGRATION_INSTALL_EXPIRED 로 끝낸다', async () => {
        integrationRepo.findOne.mockResolvedValue(
          rowOf({ status: 'expired', statusReason: 'install_timeout' }),
        );

        const err = await rejectionOf('owner');

        expect(err).toBeInstanceOf(BadRequestException);
        expect(err).toMatchObject({
          response: { code: 'INTEGRATION_INSTALL_EXPIRED' },
        });
        expect(callbackContextOf(err)).toBeUndefined();
      });

      it('만료 판정은 요청자 판정 뒤다 — 볼 수 없는 만료 행은 404 를 받는다', async () => {
        integrationRepo.findOne.mockResolvedValue(
          rowOf({
            scope: 'personal',
            createdBy: 'u-2',
            status: 'expired',
            statusReason: 'install_timeout',
          }),
        );

        const err = await rejectionOf('owner');

        expect(err).toMatchObject({ response: { code: 'RESOURCE_NOT_FOUND' } });
      });
    });

    it('pending_install 행(설치 흐름)은 재판정하지 않는다 — state 의 userId 가 요청자가 아니라 생성자다', async () => {
      dataSource.query.mockResolvedValue(stateOf('reauthorize'));
      integrationRepo.findOne.mockResolvedValue(
        rowOf({ status: 'pending_install', createdBy: 'u-2' }),
      );
      await serviceWithRole('viewer').handleCallback('google', {
        code: 'code',
        state: 'abc',
      });
      expect(getMemberRole).not.toHaveBeenCalled();
      expect(integrationRepo.save).toHaveBeenCalledTimes(1);
    });

    // CLE-T-NNENG8 — 재설치 대기 표시로 재판정을 건너뛰는 것은 Cafe24 Private 행뿐이고 표시가 유효한 24시간 동안만이다.
    // 표시를 남기는 입구가 Cafe24 Private 뿐이라 다른 행에 표시가 있으면 우회 시도로 보고 다시 본다.
    describe('재설치 대기 표시 — Cafe24 Private 행에 한정하고 24시간 안에서만 건너뛴다', () => {
      type Allowed = {
        assertRequesterStillAllowed(
          integration: unknown,
          record: { workspaceId: string; userId: string; mode: string },
          manager: unknown,
        ): Promise<void>;
      };
      const HOUR = 60 * 60 * 1000;
      const MINUTE = 60 * 1000;
      const record = {
        workspaceId: 'ws-1',
        userId: 'u-1',
        mode: 'reauthorize',
      };
      const run = (
        role: string | null,
        integration: Record<string, unknown>,
      ): Promise<void> =>
        (
          serviceWithRole(role) as unknown as Allowed
        ).assertRequesterStillAllowed(integration, record, {});
      /** Organization · 남이 만든 행 — 요청자(u-1, viewer)가 재판정을 받으면 ADMIN_REQUIRED 로 막힌다. */
      const orgRow = (overrides: Record<string, unknown>) =>
        rowOf({
          scope: 'organization',
          createdBy: 'u-2',
          serviceType: 'cafe24',
          credentials: { app_type: 'private' },
          ...overrides,
        });
      const rejectsAdminRequired = (p: Promise<void>) =>
        expect(p).rejects.toMatchObject({
          response: { code: 'ADMIN_REQUIRED' },
        });

      it('Cafe24 Private 행의 유효한 표시(23시간 59분)는 재판정하지 않는다 — 인가는 표시를 남길 때 봤고 커밋은 App URL 의 HMAC 이 인가한다', async () => {
        await expect(
          run(
            'viewer',
            orgRow({
              reinstallRequestedAt: new Date(Date.now() - (24 * HOUR - MINUTE)),
            }),
          ),
        ).resolves.toBeUndefined();
        expect(getMemberRole).not.toHaveBeenCalled();
      });

      it('Cafe24 Private 행이라도 표시가 24시간을 넘었으면 다시 본다', async () => {
        await rejectsAdminRequired(
          run(
            'viewer',
            orgRow({
              reinstallRequestedAt: new Date(Date.now() - (24 * HOUR + MINUTE)),
            }),
          ),
        );
        expect(getMemberRole).toHaveBeenCalled();
      });

      it('표시가 없는 Cafe24 Private 행은 다시 본다', async () => {
        await rejectsAdminRequired(
          run('viewer', orgRow({ reinstallRequestedAt: null })),
        );
      });

      it.each([
        [
          'Cafe24 Public',
          { serviceType: 'cafe24', credentials: { app_type: 'public' } },
        ],
        ['MakeShop', { serviceType: 'makeshop', credentials: {} }],
        ['Google', { serviceType: 'google', credentials: {} }],
      ])('%s 행은 유효한 표시가 있어도 다시 본다', async (_name, overrides) => {
        await rejectsAdminRequired(
          run(
            'viewer',
            orgRow({
              ...overrides,
              reinstallRequestedAt: new Date(Date.now() - HOUR),
            }),
          ),
        );
        expect(getMemberRole).toHaveBeenCalled();
      });

      it('표시가 있는 Google 행의 콜백도 커밋하지 않는다(handleCallback 경유)', async () => {
        dataSource.query.mockResolvedValue(stateOf('reauthorize'));
        integrationRepo.findOne.mockResolvedValue(
          rowOf({
            createdBy: 'u-2',
            reinstallRequestedAt: new Date(Date.now() - HOUR),
          }),
        );
        await expect(
          serviceWithRole('viewer').handleCallback('google', {
            code: 'code',
            state: 'abc',
          }),
        ).rejects.toMatchObject({ response: { code: 'ADMIN_REQUIRED' } });
        expect(integrationRepo.save).not.toHaveBeenCalled();
      });
    });

    it.each([
      ['Organization', {}, 'ADMIN_REQUIRED'],
      [
        '본인 personal',
        { scope: 'personal', createdBy: 'u-1' },
        'EDITOR_REQUIRED',
      ],
    ])(
      '역할을 조회할 수 없으면(WorkspacesService 미주입) %s 재판정은 거부한다 — fail-closed',
      async (_name, row, code) => {
        dataSource.query.mockResolvedValue(stateOf('reauthorize'));
        integrationRepo.findOne.mockResolvedValue(rowOf(row));
        await expect(
          service.handleCallback('google', { code: 'code', state: 'abc' }),
        ).rejects.toMatchObject({ response: { code } });
        expect(integrationRepo.save).not.toHaveBeenCalled();
      },
    );
  });

  describe('handleCallback — failure observability', () => {
    // After OAuth state is consumed, any thrown exception must carry
    // { integrationId, workspaceId, mode } context so the controller can
    // surface the diagnostic on the integration row.

    it('attaches callback context when state expired', async () => {
      dataSource.query.mockResolvedValue([
        [
          {
            provider: 'google',
            serviceType: 'google',
            mode: 'reauthorize',
            workspaceId: 'ws-1',
            userId: 'u-1',
            requestedScopes: ['scope-1'],
            integrationId: 'int-42',
            expiresAt: new Date(Date.now() - 60_000),
          },
        ],
        1,
      ]);
      const error = await service
        .handleCallback('google', { code: 'code', state: 'abc' })
        .catch((err: Error) => err);
      expect(error).toBeInstanceOf(BadRequestException);
      const ctx = (error as { context?: unknown }).context as
        | { integrationId?: string; workspaceId?: string; mode?: string }
        | undefined;
      expect(ctx).toEqual({
        integrationId: 'int-42',
        workspaceId: 'ws-1',
        mode: 'reauthorize',
      });
    });

    it('attaches callback context when row is missing (resource_not_found)', async () => {
      dataSource.query.mockResolvedValue([
        [
          {
            provider: 'google',
            serviceType: 'google',
            mode: 'reauthorize',
            workspaceId: 'ws-1',
            userId: 'u-1',
            requestedScopes: ['scope-1'],
            integrationId: 'int-vanished',
            expiresAt: new Date(Date.now() + 60_000),
          },
        ],
        1,
      ]);
      integrationRepo.findOne.mockResolvedValue(null);
      const error = await service
        .handleCallback('google', { code: 'code', state: 'abc' })
        .catch((err: Error) => err);
      // findOne -> null inside transaction throws NotFoundException
      const ctx = (error as { context?: unknown }).context as
        { integrationId?: string } | undefined;
      expect(ctx?.integrationId).toBe('int-vanished');
    });

    it('does NOT attach context for state-mismatch (pre-consumption — no integrationId known)', async () => {
      dataSource.query.mockResolvedValue([[], 0]); // DELETE…RETURNING returned 0 rows
      const error = await service
        .handleCallback('google', { code: 'code', state: 'abc' })
        .catch((err: Error) => err);
      expect(error).toBeInstanceOf(BadRequestException);
      const ctx = (error as { context?: unknown }).context;
      expect(ctx).toBeUndefined();
    });

    it('attaches callback context on token exchange failure', async () => {
      // Run without OAUTH_STUB_MODE so exchangeCodeForToken does a real fetch
      // which we intercept globally to force a 401.
      delete process.env.OAUTH_STUB_MODE;
      oauthMock.env.google = { clientId: 'cid', clientSecret: 'csec' };
      const originalFetch = global.fetch;
      (global as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => 'unauthorized',
      });
      try {
        dataSource.query.mockResolvedValue([
          [
            {
              provider: 'google',
              serviceType: 'google',
              mode: 'reauthorize',
              workspaceId: 'ws-1',
              userId: 'u-1',
              requestedScopes: ['scope-1'],
              integrationId: 'int-token-fail',
              expiresAt: new Date(Date.now() + 60_000),
            },
          ],
          1,
        ]);
        const error = await service
          .handleCallback('google', { code: 'bad-code', state: 'abc' })
          .catch((err: Error) => err);
        expect(error).toBeInstanceOf(BadRequestException);
        const ctx = (error as { context?: unknown }).context as
          | { integrationId?: string; workspaceId?: string; mode?: string }
          | undefined;
        expect(ctx).toEqual({
          integrationId: 'int-token-fail',
          workspaceId: 'ws-1',
          mode: 'reauthorize',
        });
        // Sanity: the underlying code was OAUTH_TOKEN_EXCHANGE_FAILED so the
        // controller can transition `connected` rows to error(auth_failed).
        const code = (error as { response?: { code?: string } }).response?.code;
        expect(code).toBe('OAUTH_TOKEN_EXCHANGE_FAILED');
      } finally {
        global.fetch = originalFetch;
        process.env.OAUTH_STUB_MODE = 'true';
      }
    });

    it('surfaces token exchange timeout (AbortError) as OAUTH_TOKEN_EXCHANGE_FAILED', async () => {
      // 토큰 endpoint hang → AbortController 가 fetch 를 abort. AbortError 가
      // BadRequestException(OAUTH_TOKEN_EXCHANGE_FAILED) 로 surface 돼야 한다.
      delete process.env.OAUTH_STUB_MODE;
      oauthMock.env.google = { clientId: 'cid', clientSecret: 'csec' };
      const originalFetch = global.fetch;
      const abortErr = new Error('The operation was aborted');
      abortErr.name = 'AbortError';
      (global as { fetch: jest.Mock }).fetch = jest
        .fn()
        .mockRejectedValue(abortErr);
      try {
        dataSource.query.mockResolvedValue([
          [
            {
              provider: 'google',
              serviceType: 'google',
              mode: 'new',
              workspaceId: 'ws-1',
              userId: 'u-1',
              requestedScopes: ['scope-1'],
              integrationId: null,
              expiresAt: new Date(Date.now() + 60_000),
            },
          ],
          1,
        ]);
        const error = await service
          .handleCallback('google', { code: 'slow-code', state: 'abc' })
          .catch((err: Error) => err);
        expect(error).toBeInstanceOf(BadRequestException);
        const code = (error as { response?: { code?: string } }).response?.code;
        expect(code).toBe('OAUTH_TOKEN_EXCHANGE_FAILED');
      } finally {
        global.fetch = originalFetch;
        process.env.OAUTH_STUB_MODE = 'true';
      }
    });
  });

  // CLE-T-81270P: Google · GitHub 의 토큰 응답에는 계정 식별자(`account_email` · `login`)가 없다. 토큰을 받은 뒤
  // 계정 조회(Google userinfo, GitHub `/user`)로 채워야 새 통합 저장의 필수 필드 검증을 지난다.
  describe('handleCallback — Google · GitHub 계정 식별자 조회', () => {
    const newState = (provider: 'google' | 'github') => [
      [
        {
          provider,
          serviceType: provider,
          mode: 'new',
          workspaceId: 'ws-1',
          userId: 'u-1',
          requestedScopes: ['scope-1'],
          integrationId: null,
          expiresAt: new Date(Date.now() + 60_000),
        },
      ],
      1,
    ];
    const jsonResponse = (body: unknown, status = 200) => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    });
    const savedCredentials = (): Record<string, unknown> => {
      const saved = previewRepo.save.mock.calls[0]?.[0] as
        { credentials: Record<string, unknown> } | undefined;
      return saved?.credentials ?? {};
    };

    let originalFetch: typeof global.fetch;
    let fetchMock: jest.Mock;
    beforeEach(() => {
      delete process.env.OAUTH_STUB_MODE;
      oauthMock.env.google = { clientId: 'gid', clientSecret: 'gsec' };
      oauthMock.env.github = { clientId: 'hid', clientSecret: 'hsec' };
      originalFetch = global.fetch;
      fetchMock = jest.fn();
      (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;
    });
    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('Google: 토큰을 받은 뒤 userinfo 의 email 을 account_email 로 저장한다', async () => {
      fetchMock
        .mockResolvedValueOnce(
          jsonResponse({
            access_token: 'g-at',
            refresh_token: 'g-rt',
            expires_in: 3599,
            scope: 'openid https://www.googleapis.com/auth/userinfo.email',
          }),
        )
        .mockResolvedValueOnce(
          jsonResponse({ sub: '1', email: 'someone@example.com' }),
        );
      dataSource.query.mockResolvedValue(newState('google'));

      const result = await service.handleCallback('google', {
        code: 'c',
        state: 's',
      });

      expect(result.previewToken).toMatch(/^tmp_/);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const [url, init] = fetchMock.mock.calls[1] as [
        string,
        { method?: string; headers: Record<string, string> },
      ];
      expect(url).toBe('https://openidconnect.googleapis.com/v1/userinfo');
      expect(init.method ?? 'GET').toBe('GET');
      expect(init.headers.Authorization).toBe('Bearer g-at');
      expect(savedCredentials()).toMatchObject({
        access_token: 'g-at',
        refresh_token: 'g-rt',
        account_email: 'someone@example.com',
      });
    });

    it('GitHub: 토큰을 받은 뒤 /user 의 login 을 저장한다', async () => {
      fetchMock
        .mockResolvedValueOnce(
          jsonResponse({ access_token: 'h-at', scope: 'repo,read:org' }),
        )
        .mockResolvedValueOnce(jsonResponse({ id: 1, login: 'octocat' }));
      dataSource.query.mockResolvedValue(newState('github'));

      await service.handleCallback('github', { code: 'c', state: 's' });

      const [url, init] = fetchMock.mock.calls[1] as [
        string,
        { headers: Record<string, string> },
      ];
      expect(url).toBe('https://api.github.com/user');
      expect(init.headers.Authorization).toBe('Bearer h-at');
      // GitHub REST API 는 User-Agent 가 없는 요청을 거절한다.
      expect(init.headers['User-Agent']).toEqual(expect.any(String));
      expect(savedCredentials()).toMatchObject({
        access_token: 'h-at',
        login: 'octocat',
      });
    });

    it.each([
      ['응답이 실패(401)', jsonResponse({ error: 'invalid_token' }, 401)],
      ['식별자가 없는 응답', jsonResponse({ sub: '1' })],
    ])(
      'Google: 계정 조회의 %s 면 OAUTH_TOKEN_EXCHANGE_FAILED 로 실패하고 미리보기를 만들지 않는다',
      async (_label, identityResponse) => {
        fetchMock
          .mockResolvedValueOnce(
            jsonResponse({ access_token: 'g-at', refresh_token: 'g-rt' }),
          )
          .mockResolvedValueOnce(identityResponse);
        dataSource.query.mockResolvedValue(newState('google'));

        const error = await service
          .handleCallback('google', { code: 'c', state: 's' })
          .catch((err: Error) => err);

        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as { response?: { code?: string } }).response?.code).toBe(
          'OAUTH_TOKEN_EXCHANGE_FAILED',
        );
        expect(previewRepo.save).not.toHaveBeenCalled();
      },
    );

    it('Google: 계정 조회가 전송 오류로 실패해도 OAUTH_TOKEN_EXCHANGE_FAILED 다', async () => {
      fetchMock
        .mockResolvedValueOnce(
          jsonResponse({ access_token: 'g-at', refresh_token: 'g-rt' }),
        )
        .mockRejectedValueOnce(new TypeError('fetch failed'));
      dataSource.query.mockResolvedValue(newState('google'));

      const error = await service
        .handleCallback('google', { code: 'c', state: 's' })
        .catch((err: Error) => err);

      expect((error as { response?: { code?: string } }).response?.code).toBe(
        'OAUTH_TOKEN_EXCHANGE_FAILED',
      );
      expect(previewRepo.save).not.toHaveBeenCalled();
    });

    // CLE-T-BYT4S2: 조회 실패의 나머지 경로. 어느 경로든 코드는 같고 미리보기를 만들지 않는다. 로그에는 실패 이유만
    // 남기고 방금 받은 토큰 · 인가 code · 응답 본문은 남기지 않는다.
    describe('계정 조회 실패 경로와 실패 로그', () => {
      let warnSpy: jest.SpyInstance;
      beforeEach(() => {
        warnSpy = jest
          .spyOn(Logger.prototype, 'warn')
          .mockImplementation(() => undefined);
      });
      afterEach(() => {
        warnSpy.mockRestore();
      });

      const tokenResponse = {
        google: jsonResponse({
          access_token: 'secret-g-at',
          refresh_token: 'secret-g-rt',
        }),
        github: jsonResponse({ access_token: 'secret-h-at' }),
      };
      const abortError = () => {
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        return err;
      };
      const loggedText = (): string =>
        warnSpy.mock.calls.map((call) => call.map(String).join(' ')).join('\n');

      it.each([
        [
          'google',
          '시간 초과(AbortError)',
          () => Promise.reject(abortError()),
          'timed out',
        ],
        [
          'github',
          '응답 실패(401)',
          () => Promise.resolve(jsonResponse({ message: 'Bad creds' }, 401)),
          'HTTP 401',
        ],
        [
          'google',
          'JSON 이 아닌 본문',
          () =>
            Promise.resolve({
              ok: true,
              status: 200,
              json: () =>
                Promise.reject(
                  new SyntaxError(
                    'Unexpected token \'<\', "<html>secret-body" is not valid JSON',
                  ),
                ),
            }),
          'not JSON',
        ],
        [
          'github',
          'null 본문',
          () => Promise.resolve(jsonResponse(null)),
          'no account identifier',
        ],
        [
          'github',
          '전송 오류',
          () => Promise.reject(new Error('socket hang up')),
          'transport error: socket hang up',
        ],
        [
          'google',
          'Error 가 아닌 값의 전송 오류',
          // Error 가 아닌 값으로 reject 하는 String(err) 분기를 덮으려는 의도다.
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
          () => Promise.reject('connection reset'),
          'transport error: connection reset',
        ],
        [
          'google',
          '객체가 아닌 본문',
          () => Promise.resolve(jsonResponse(['secret-array'])),
          'no account identifier',
        ],
      ] as const)(
        '%s: 계정 조회의 %s 는 OAUTH_TOKEN_EXCHANGE_FAILED 이고 로그에 실패 이유만 남긴다',
        async (provider, _label, identityResponse, reason) => {
          fetchMock
            .mockResolvedValueOnce(tokenResponse[provider])
            .mockImplementationOnce(identityResponse);
          dataSource.query.mockResolvedValue(newState(provider));

          const error = await service
            .handleCallback(provider, { code: 'secret-code', state: 's' })
            .catch((err: Error) => err);

          expect(error).toBeInstanceOf(BadRequestException);
          expect(
            (error as { response?: { code?: string } }).response?.code,
          ).toBe('OAUTH_TOKEN_EXCHANGE_FAILED');
          expect(previewRepo.save).not.toHaveBeenCalled();
          const logged = loggedText();
          expect(logged).toContain(
            `OAuth account lookup failed for ${provider}`,
          );
          expect(logged).toContain(reason);
          expect(logged).not.toContain('secret-');
        },
      );

      it('계정 조회 요청은 10초가 지나면 끊는다', async () => {
        jest.useFakeTimers();
        try {
          let identitySignal: AbortSignal | undefined;
          fetchMock
            .mockResolvedValueOnce(tokenResponse.google)
            .mockImplementationOnce(
              (_url: string, init: { signal: AbortSignal }) => {
                identitySignal = init.signal;
                return new Promise((_resolve, reject) => {
                  init.signal.addEventListener('abort', () =>
                    reject(abortError()),
                  );
                });
              },
            );
          dataSource.query.mockResolvedValue(newState('google'));

          const pending = service
            .handleCallback('google', { code: 'secret-code', state: 's' })
            .catch((err: Error) => err);
          await jest.advanceTimersByTimeAsync(9_999);
          expect(identitySignal?.aborted).toBe(false);
          await jest.advanceTimersByTimeAsync(1);
          const error = await pending;

          expect(identitySignal?.aborted).toBe(true);
          expect(
            (error as { response?: { code?: string } }).response?.code,
          ).toBe('OAUTH_TOKEN_EXCHANGE_FAILED');
          expect(loggedText()).toContain('timed out');
        } finally {
          jest.useRealTimers();
        }
      });

      // 토큰 교환도 본문 읽기까지 10초 상한 안에 둔다. 그래야 콜백의 제공자 대기가 최악 20초다.
      it('토큰 교환 응답 본문이 오지 않으면 10초에 끊는다', async () => {
        jest.useFakeTimers();
        try {
          let tokenSignal: AbortSignal | undefined;
          fetchMock.mockImplementationOnce(
            (_url: string, init: { signal: AbortSignal }) => {
              tokenSignal = init.signal;
              return Promise.resolve({
                ok: true,
                status: 200,
                json: () =>
                  new Promise((_resolve, reject) => {
                    init.signal.addEventListener('abort', () =>
                      reject(abortError()),
                    );
                  }),
              });
            },
          );
          dataSource.query.mockResolvedValue(newState('google'));

          const pending = service
            .handleCallback('google', { code: 'secret-code', state: 's' })
            .catch((err: Error) => err);
          await jest.advanceTimersByTimeAsync(9_999);
          expect(tokenSignal?.aborted).toBe(false);
          await jest.advanceTimersByTimeAsync(1);
          const error = await pending;

          expect(tokenSignal?.aborted).toBe(true);
          expect(
            (error as { response?: { code?: string } }).response?.code,
          ).toBe('OAUTH_TOKEN_EXCHANGE_FAILED');
          expect(loggedText()).toContain('OAuth token exchange timed out');
          expect(fetchMock).toHaveBeenCalledTimes(1);
        } finally {
          jest.useRealTimers();
        }
      });

      it('토큰 교환 응답이 JSON 이 아니면 OAUTH_TOKEN_EXCHANGE_FAILED 이고 본문을 로그에 남기지 않는다', async () => {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () =>
            Promise.reject(
              new SyntaxError(
                'Unexpected token \'<\', "<html>secret-body" is not valid JSON',
              ),
            ),
        });
        dataSource.query.mockResolvedValue(newState('github'));

        const error = await service
          .handleCallback('github', { code: 'secret-code', state: 's' })
          .catch((err: Error) => err);

        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as { response?: { code?: string } }).response?.code).toBe(
          'OAUTH_TOKEN_EXCHANGE_FAILED',
        );
        const logged = loggedText();
        expect(logged).toContain('OAuth token exchange failed for github');
        expect(logged).toContain('response is not JSON');
        expect(logged).not.toContain('secret-');
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });
    });

    it.each([
      ['google', 'account_email'],
      ['github', 'login'],
    ] as const)(
      'stub 모드(%s)도 필수 식별자(%s)를 채우고 외부를 부르지 않는다',
      async (provider, field) => {
        process.env.OAUTH_STUB_MODE = 'true';
        dataSource.query.mockResolvedValue(newState(provider));

        await service.handleCallback(provider, { code: 'c', state: 's' });

        expect(fetchMock).not.toHaveBeenCalled();
        expect(savedCredentials()[field]).toEqual(expect.any(String));
      },
    );
  });

  describe('handleCallbackWithErrorCapture', () => {
    // Service-side wrapper that runs handleCallback and, on a post-state-
    // consumption failure, writes the diagnostic onto the row before
    // re-throwing the same error.

    it('returns the result transparently on success', async () => {
      dataSource.query.mockResolvedValue([
        [
          {
            provider: 'google',
            serviceType: 'google',
            mode: 'new',
            workspaceId: 'ws-1',
            userId: 'u-1',
            requestedScopes: ['scope'],
            integrationId: null,
            expiresAt: new Date(Date.now() + 60_000),
          },
        ],
        1,
      ]);
      const result = await service.handleCallbackWithErrorCapture('google', {
        code: 'c',
        state: 's',
      });
      expect(result.mode).toBe('new');
    });

    it('records callback error via markIntegrationCallbackError on post-state failure', async () => {
      dataSource.query.mockResolvedValue([
        [
          {
            provider: 'google',
            serviceType: 'google',
            mode: 'reauthorize',
            workspaceId: 'ws-1',
            userId: 'u-1',
            requestedScopes: ['scope'],
            integrationId: 'int-1',
            expiresAt: new Date(Date.now() - 60_000),
          },
        ],
        1,
      ]);
      const spy = jest.spyOn(service, 'markIntegrationCallbackError');
      const err = await service
        .handleCallbackWithErrorCapture('google', { code: 'c', state: 's' })
        .catch((err_: Error) => err_);
      expect(err).toBeInstanceOf(BadRequestException);
      expect(spy).toHaveBeenCalledWith(
        'int-1',
        'ws-1',
        'OAUTH_STATE_EXPIRED',
        expect.stringContaining('expired'),
        // §2: 5번째 extra 인자 — invalid_scope 외에는 undefined (context 에
        // requiresCafe24Approval 없음).
        undefined,
      );
      spy.mockRestore();
    });

    // CLE-T-HBDGPZ — begin 이 무시하기 전에 만들어진 state 나 위조된 state 라도 `new` 모드는 행을 가리키지 않는다.
    it.each([
      [
        'state 만료',
        'google',
        { expiresAt: new Date(Date.now() - 60_000) },
        'OAUTH_STATE_EXPIRED',
      ],
      [
        'provider 불일치',
        'google',
        { provider: 'github', serviceType: 'github' },
        'OAUTH_STATE_MISMATCH',
      ],
    ])(
      'mode=new state 에 integrationId 가 있어도 %s 실패를 그 행에 기록하지 않는다',
      async (_label, provider, overrides, expectedCode) => {
        dataSource.query.mockResolvedValue([
          [
            {
              provider: 'google',
              serviceType: 'google',
              mode: 'new',
              workspaceId: 'ws-1',
              userId: 'u-1',
              requestedScopes: ['scope'],
              integrationId: 'other-integration',
              expiresAt: new Date(Date.now() + 60_000),
              ...overrides,
            },
          ],
          1,
        ]);
        const spy = jest.spyOn(service, 'markIntegrationCallbackError');
        const err = await service
          .handleCallbackWithErrorCapture(provider, { code: 'c', state: 's' })
          .catch((err_: unknown) => err_);
        expect((err as { response?: { code?: string } }).response?.code).toBe(
          expectedCode,
        );
        expect(callbackContextOf(err)).toBeUndefined();
        expect(spy).not.toHaveBeenCalled();
        expect(integrationRepo.save).not.toHaveBeenCalled();
        expect(actionRequiredNotifier.notify).not.toHaveBeenCalled();
        spy.mockRestore();
      },
    );

    // 토큰 교환 실패도 같은 규칙이다. 같은 state 에서 mode 만 다르면 `reauthorize` 만 행에 기록된다(`mode !== 'new'` 가
    // reauthorize 를 막는 회귀를 잡는 대조 쌍).
    it.each([
      ['new', false],
      ['reauthorize', true],
    ])(
      'mode=%s state 의 토큰 교환 실패는 그 행에 기록 여부=%s',
      async (mode, recorded) => {
        delete process.env.OAUTH_STUB_MODE;
        oauthMock.env.google = { clientId: 'cid', clientSecret: 'csec' };
        const originalFetch = global.fetch;
        (global as unknown as { fetch: jest.Mock }).fetch = jest
          .fn()
          .mockResolvedValue({
            ok: false,
            status: 401,
            text: async () => 'unauthorized',
          });
        const spy = jest
          .spyOn(service, 'markIntegrationCallbackError')
          .mockResolvedValue(undefined);
        try {
          dataSource.query.mockResolvedValue([
            [
              {
                provider: 'google',
                serviceType: 'google',
                mode,
                workspaceId: 'ws-1',
                userId: 'u-1',
                requestedScopes: ['scope'],
                integrationId: 'int-token-fail',
                expiresAt: new Date(Date.now() + 60_000),
              },
            ],
            1,
          ]);
          const err = await service
            .handleCallbackWithErrorCapture('google', {
              code: 'bad-code',
              state: 's',
            })
            .catch((err_: unknown) => err_);
          expect((err as { response?: { code?: string } }).response?.code).toBe(
            'OAUTH_TOKEN_EXCHANGE_FAILED',
          );
          if (recorded) {
            expect(spy).toHaveBeenCalledWith(
              'int-token-fail',
              'ws-1',
              'OAUTH_TOKEN_EXCHANGE_FAILED',
              expect.any(String),
              undefined,
            );
          } else {
            expect(callbackContextOf(err)).toBeUndefined();
            expect(spy).not.toHaveBeenCalled();
          }
        } finally {
          spy.mockRestore();
          global.fetch = originalFetch;
          process.env.OAUTH_STUB_MODE = 'true';
        }
      },
    );

    it('does NOT record when no callback context (pre-state-consumption mismatch)', async () => {
      dataSource.query.mockResolvedValue([[], 0]); // DELETE…RETURNING 0 rows
      const spy = jest.spyOn(service, 'markIntegrationCallbackError');
      await service
        .handleCallbackWithErrorCapture('google', { code: 'c', state: 's' })
        .catch(() => undefined);
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('falls back to OAUTH_CALLBACK_FAILED when the error has no response.code', async () => {
      const spy = jest.spyOn(service, 'markIntegrationCallbackError');
      jest.spyOn(service, 'handleCallback').mockImplementation(async () => {
        const raw = new Error('boom') as Error & {
          context?: {
            integrationId: string;
            workspaceId: string;
            mode: string;
          };
        };
        raw.context = {
          integrationId: 'int-2',
          workspaceId: 'ws-1',
          mode: 'reauthorize',
        };
        throw raw;
      });
      await service
        .handleCallbackWithErrorCapture('google', { code: 'c', state: 's' })
        .catch(() => undefined);
      expect(spy).toHaveBeenCalledWith(
        'int-2',
        'ws-1',
        'OAUTH_CALLBACK_FAILED',
        'boom',
        // §2: 5번째 extra 인자 — invalid_scope 외에는 undefined.
        undefined,
      );
      spy.mockRestore();
    });

    it('still re-throws even if recording itself rejects (defence-in-depth)', async () => {
      dataSource.query.mockResolvedValue([
        [
          {
            provider: 'google',
            serviceType: 'google',
            mode: 'reauthorize',
            workspaceId: 'ws-1',
            userId: 'u-1',
            requestedScopes: ['scope'],
            integrationId: 'int-3',
            expiresAt: new Date(Date.now() - 60_000),
          },
        ],
        1,
      ]);
      jest
        .spyOn(service, 'markIntegrationCallbackError')
        .mockRejectedValue(new Error('db down'));
      const err = await service
        .handleCallbackWithErrorCapture('google', { code: 'c', state: 's' })
        .catch((err_: Error) => err_);
      expect(err).toBeInstanceOf(BadRequestException);
    });
  });

  describe('sanitizeLastErrorMessage', () => {
    it('passes short benign messages through', () => {
      expect(sanitizeLastErrorMessage('invalid_grant')).toBe('invalid_grant');
    });

    it('truncates to LAST_ERROR_MESSAGE_MAX_LEN with ellipsis', () => {
      const long = 'a'.repeat(LAST_ERROR_MESSAGE_MAX_LEN + 50);
      const out = sanitizeLastErrorMessage(long);
      expect(out.length).toBe(LAST_ERROR_MESSAGE_MAX_LEN + 1); // +1 for '…'
      expect(out.endsWith('…')).toBe(true);
    });

    it('masks Bearer tokens', () => {
      expect(
        sanitizeLastErrorMessage('failed: Bearer abc.def.ghi at line 2'),
      ).toBe('failed: *** at line 2');
    });

    it('masks client_secret/access_token/refresh_token assignments', () => {
      expect(
        sanitizeLastErrorMessage(
          'request body: client_secret=verySecret123 & grant_type=auth',
        ),
      ).toBe('request body: *** & grant_type=auth');
      expect(sanitizeLastErrorMessage('access_token: ya29.a0AfH6 fail')).toBe(
        '*** fail',
      );
      expect(
        sanitizeLastErrorMessage('refresh_token=eyJxxx invalid_grant'),
      ).toBe('*** invalid_grant');
    });

    it('masks Authorization header echoes', () => {
      expect(
        sanitizeLastErrorMessage(
          'upstream returned 401 Authorization: Bearer abc',
        ),
      ).toBe('upstream returned 401 ***');
    });

    it('returns input unchanged for empty / non-string', () => {
      expect(sanitizeLastErrorMessage('')).toBe('');
    });

    // SEC-C2 — Cafe24 가 응답에 `client-secret` (하이픈) 또는 `"secret":...`
    // 단독 키워드를 echo 하는 비정상 케이스 대비. 운영 보고 (2026-05-16)
    // 후 패턴 확장.
    it('masks hyphenated client-secret variant', () => {
      expect(
        sanitizeLastErrorMessage('error: client-secret=sk_abc123 invalid'),
      ).toBe('error: *** invalid');
    });

    it('masks standalone "secret:" keyword (JSON-style echo)', () => {
      expect(sanitizeLastErrorMessage('echo: "secret":"verySecret"')).toContain(
        '***',
      );
      expect(
        sanitizeLastErrorMessage('echo: "secret":"verySecret"'),
      ).not.toMatch(/verySecret/);
    });

    it('masks hyphenated access-token / refresh-token / api-key', () => {
      expect(sanitizeLastErrorMessage('access-token=abc def')).toBe('*** def');
      expect(sanitizeLastErrorMessage('api-key=xyz fail')).toBe('*** fail');
    });
  });

  describe('markIntegrationCallbackError', () => {
    it('records last_error/status_reason on pending_install row while preserving status', async () => {
      const row = {
        id: 'int-1',
        workspaceId: 'ws-1',
        status: 'pending_install',
        statusReason: null,
        lastError: null,
      };
      integrationRepo.findOne.mockResolvedValue(row);
      await service.markIntegrationCallbackError(
        'int-1',
        'ws-1',
        'OAUTH_TOKEN_EXCHANGE_FAILED',
        'Failed to exchange authorization code for access token',
      );
      expect(integrationRepo.save).toHaveBeenCalledTimes(1);
      const saved = integrationRepo.save.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(saved.status).toBe('pending_install'); // preserved
      expect(saved.statusReason).toBe('oauth_token_exchange_failed'); // snake_case
      const lastError = saved.lastError as {
        code: string;
        message: string;
        at: string;
      };
      expect(lastError.code).toBe('OAUTH_TOKEN_EXCHANGE_FAILED'); // UPPER_SNAKE_CASE in last_error
      expect(lastError.message).toContain('exchange');
      expect(typeof lastError.at).toBe('string');
    });

    it('transitions connected → error(auth_failed) on OAUTH_TOKEN_EXCHANGE_FAILED', async () => {
      integrationRepo.findOne.mockResolvedValue({
        id: 'int-2',
        workspaceId: 'ws-1',
        status: 'connected',
        statusReason: null,
        lastError: null,
      });
      await service.markIntegrationCallbackError(
        'int-2',
        'ws-1',
        'OAUTH_TOKEN_EXCHANGE_FAILED',
        'denied',
      );
      const saved = integrationRepo.save.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(saved.status).toBe('error');
      expect(saved.statusReason).toBe('auth_failed');
    });

    // CLE-T-NNENG8 — 재설치 대기 표시가 있는 행은 기존 토큰이 아직 살아 있다. 새 코드 교환이 실패해도 상태와 표시를
    // 보존해 사용자가 App URL 로 다시 시도하게 한다.
    it('재설치 대기 표시가 있는 connected 행은 OAUTH_TOKEN_EXCHANGE_FAILED 에도 상태와 표시를 보존한다', async () => {
      const requestedAt = new Date(Date.now() - 60 * 60 * 1000);
      integrationRepo.findOne.mockResolvedValue({
        id: 'int-2',
        workspaceId: 'ws-1',
        status: 'connected',
        statusReason: null,
        lastError: null,
        reinstallRequestedAt: requestedAt,
      });
      await service.markIntegrationCallbackError(
        'int-2',
        'ws-1',
        'OAUTH_TOKEN_EXCHANGE_FAILED',
        'denied',
      );
      const saved = integrationRepo.save.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(saved.status).toBe('connected');
      expect(saved.statusReason).toBeNull();
      expect(saved.reinstallRequestedAt).toBe(requestedAt);
      expect((saved.lastError as { code: string }).code).toBe(
        'OAUTH_TOKEN_EXCHANGE_FAILED',
      );
    });

    it('24시간이 지난 재설치 대기 표시는 없는 것으로 본다 — connected 행이 OAUTH_TOKEN_EXCHANGE_FAILED 로 error(auth_failed) 가 된다', async () => {
      integrationRepo.findOne.mockResolvedValue({
        id: 'int-2',
        workspaceId: 'ws-1',
        status: 'connected',
        statusReason: null,
        lastError: null,
        reinstallRequestedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      });
      await service.markIntegrationCallbackError(
        'int-2',
        'ws-1',
        'OAUTH_TOKEN_EXCHANGE_FAILED',
        'denied',
      );
      const saved = integrationRepo.save.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(saved.status).toBe('error');
      expect(saved.statusReason).toBe('auth_failed');
    });

    it('preserves connected status on non-token-exchange errors (state expired)', async () => {
      integrationRepo.findOne.mockResolvedValue({
        id: 'int-3',
        workspaceId: 'ws-1',
        status: 'connected',
        statusReason: null,
        lastError: null,
      });
      await service.markIntegrationCallbackError(
        'int-3',
        'ws-1',
        'OAUTH_STATE_EXPIRED',
        'OAuth state has expired',
      );
      const saved = integrationRepo.save.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(saved.status).toBe('connected'); // preserved
      expect(saved.statusReason).toBeNull(); // not overwritten for connected non-auth errors
      expect((saved.lastError as { code: string }).code).toBe(
        'OAUTH_STATE_EXPIRED',
      );
    });

    it('silently swallows when integration row is missing', async () => {
      integrationRepo.findOne.mockResolvedValue(null);
      await expect(
        service.markIntegrationCallbackError(
          'gone',
          'ws-1',
          'OAUTH_TOKEN_EXCHANGE_FAILED',
          'nope',
        ),
      ).resolves.toBeUndefined();
      expect(integrationRepo.save).not.toHaveBeenCalled();
    });

    it('runs sanitizeLastErrorMessage on the stored message', async () => {
      const row = {
        id: 'int-9',
        workspaceId: 'ws-1',
        status: 'pending_install',
        statusReason: null,
        lastError: null,
      };
      integrationRepo.findOne.mockResolvedValue(row);
      await service.markIntegrationCallbackError(
        'int-9',
        'ws-1',
        'OAUTH_TOKEN_EXCHANGE_FAILED',
        'upstream returned 401: Bearer secret-token-123',
      );
      const saved = integrationRepo.save.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      const lastError = saved.lastError as { message: string };
      // Token masked.
      expect(lastError.message).not.toContain('secret-token-123');
      expect(lastError.message).toContain('***');
    });

    it('does not propagate DB errors from save', async () => {
      integrationRepo.findOne.mockResolvedValue({
        id: 'int-x',
        workspaceId: 'ws-1',
        status: 'pending_install',
        statusReason: null,
        lastError: null,
      });
      integrationRepo.save.mockRejectedValue(new Error('db down'));
      await expect(
        service.markIntegrationCallbackError(
          'int-x',
          'ws-1',
          'OAUTH_TOKEN_EXCHANGE_FAILED',
          'msg',
        ),
      ).resolves.toBeUndefined();
    });

    // CLE-T-MQSRDS · REQ-INTSTAT-030 — 콜백의 코드 교환 실패로 연결됨 통합이 오류가 되면 전이한 그 자리에서 조치 필요
    // 알림을 보낸다. 상태를 바꾸지 않는 기록(설치 대기 · 재설치 대기 표시 · 권한 거부 · 그 밖의 코드)에는 보내지 않는다.
    describe('조치 필요 알림 (connected → error(auth_failed))', () => {
      const connectedRow = (overrides: Record<string, unknown> = {}) => ({
        id: 'int-n',
        workspaceId: 'ws-1',
        name: 'My Shop',
        status: 'connected',
        statusReason: null,
        lastError: null,
        ...overrides,
      });

      it('저장한 행으로 auth_failed · oauth_callback 알림을 한 번 보낸다', async () => {
        integrationRepo.findOne.mockResolvedValue(connectedRow());
        // save 대역 안의 단언은 던져도 구현의 try/catch 가 삼키므로, 저장 시점의 호출 수를 기록해 뒤에서 단언한다.
        let notifyCallsAtSave = -1;
        integrationRepo.save.mockImplementation(async (row: unknown) => {
          notifyCallsAtSave = actionRequiredNotifier.notify.mock.calls.length;
          return row;
        });
        await service.markIntegrationCallbackError(
          'int-n',
          'ws-1',
          'OAUTH_TOKEN_EXCHANGE_FAILED',
          'denied',
        );
        // 저장 시점에 알림이 아직 나가지 않았어야 한다(저장이 실패하면 알리지 않는다).
        expect(notifyCallsAtSave).toBe(0);
        expect(actionRequiredNotifier.notify).toHaveBeenCalledTimes(1);
        const [notified, reason, trigger] =
          actionRequiredNotifier.notify.mock.calls[0];
        expect(notified).toBe(integrationRepo.save.mock.calls[0][0]);
        expect(notified).toMatchObject({
          status: 'error',
          statusReason: 'auth_failed',
        });
        expect(reason).toBe('auth_failed');
        expect(trigger).toBe('oauth_callback');
      });

      it.each([
        [
          '설치 대기 행',
          { status: 'pending_install' },
          'OAUTH_TOKEN_EXCHANGE_FAILED',
        ],
        [
          '유효한 재설치 대기 표시가 있는 연결됨 행',
          { reinstallRequestedAt: new Date(Date.now() - 60 * 60 * 1000) },
          'OAUTH_TOKEN_EXCHANGE_FAILED',
        ],
        [
          '이미 오류인 행',
          { status: 'error', statusReason: 'network' },
          'OAUTH_TOKEN_EXCHANGE_FAILED',
        ],
        ['연결됨 행의 권한 거부', {}, 'OAUTH_INVALID_SCOPE'],
        ['연결됨 행의 state 만료', {}, 'OAUTH_STATE_EXPIRED'],
        [
          '상점 자리를 놓은 만료 행',
          { status: 'expired', statusReason: 'install_timeout' },
          'OAUTH_TOKEN_EXCHANGE_FAILED',
        ],
      ])(
        '%s 은 상태를 오류로 바꾸지 않으므로 알리지 않는다',
        async (_label, overrides, errorCode) => {
          integrationRepo.findOne.mockResolvedValue(connectedRow(overrides));
          await service.markIntegrationCallbackError(
            'int-n',
            'ws-1',
            errorCode,
            'msg',
          );
          expect(actionRequiredNotifier.notify).not.toHaveBeenCalled();
        },
      );

      it('만료된 재설치 대기 표시가 있는 연결됨 행은 오류로 바꾸고 알린다', async () => {
        // 표시는 24시간만 유효하다(`isReinstallRequestActive`). 25시간 전 표시는 무효라 일반 연결됨 행처럼 전이한다.
        integrationRepo.findOne.mockResolvedValue(
          connectedRow({
            reinstallRequestedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
          }),
        );
        await service.markIntegrationCallbackError(
          'int-n',
          'ws-1',
          'OAUTH_TOKEN_EXCHANGE_FAILED',
          'denied',
        );
        expect(actionRequiredNotifier.notify).toHaveBeenCalledTimes(1);
        expect(actionRequiredNotifier.notify.mock.calls[0][0]).toMatchObject({
          status: 'error',
          statusReason: 'auth_failed',
        });
      });

      it('저장이 실패하면 알리지 않는다', async () => {
        integrationRepo.findOne.mockResolvedValue(connectedRow());
        integrationRepo.save.mockRejectedValue(new Error('db down'));
        await expect(
          service.markIntegrationCallbackError(
            'int-n',
            'ws-1',
            'OAUTH_TOKEN_EXCHANGE_FAILED',
            'msg',
          ),
        ).resolves.toBeUndefined();
        expect(actionRequiredNotifier.notify).not.toHaveBeenCalled();
      });
    });
  });

  describe('consumePreviewToken', () => {
    it('rejects unknown token', async () => {
      dataSource.query.mockResolvedValue([[], 0]);
      await expect(
        service.consumePreviewToken('tmp_x', 'ws-1', 'u-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects mismatched owner (filtered at SQL WHERE — returns 0 rows = INVALID)', async () => {
      // workspace_id + user_id 가 WHERE 절에 추가됐으므로 비소유자의 DELETE 는
      // 0 rows 로 반환되어 OAUTH_PREVIEW_INVALID 와 동일한 메시지로 fallthrough.
      // 토큰 존재 여부 자체를 노출하지 않는다.
      dataSource.query.mockResolvedValue([[], 0]);
      await expect(
        service.consumePreviewToken('tmp_x', 'ws-1', 'u-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects expired preview', async () => {
      dataSource.query.mockResolvedValue([
        [
          {
            previewToken: 'tmp_x',
            workspaceId: 'ws-1',
            userId: 'u-1',
            serviceType: 'google',
            credentials: { access_token: 't' },
            tokenExpiresAt: null,
            expiresAt: new Date(Date.now() - 60_000),
          },
        ],
        1,
      ]);
      await expect(
        service.consumePreviewToken('tmp_x', 'ws-1', 'u-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns credentials on success', async () => {
      dataSource.query.mockResolvedValue([
        [
          {
            previewToken: 'tmp_x',
            workspaceId: 'ws-1',
            userId: 'u-1',
            serviceType: 'google',
            credentials: { access_token: 't' },
            tokenExpiresAt: null,
            expiresAt: new Date(Date.now() + 60_000),
          },
        ],
        1,
      ]);
      const result = await service.consumePreviewToken('tmp_x', 'ws-1', 'u-1');
      expect(result.serviceType).toBe('google');
      expect(result.credentials.access_token).toBe('t');
    });

    // SEC-C1/H-5: 옛 동작은 `enc:` prefix 가 없는 plaintext credentials 도
    // `JSON.parse` 해 통과시켰다. 이는 암호화 invariant 를 우회하는 경로를
    // 열어두는 보안 결함이라 hard-fail 로 변경. 이제 plaintext 는
    // `INTEGRATION_CREDENTIALS_INVALID` 로 거부된다.
    it('rejects plaintext (no enc: prefix) credentials as security defense', async () => {
      dataSource.query.mockResolvedValue([
        [
          {
            preview_token: 'tmp_x',
            workspace_id: 'ws-1',
            user_id: 'u-1',
            service_type: 'google',
            credentials: JSON.stringify({ access_token: 't-str' }),
            token_expires_at: null,
            expires_at: new Date(Date.now() + 60_000),
          },
        ],
        1,
      ]);
      await expect(
        service.consumePreviewToken('tmp_x', 'ws-1', 'u-1'),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'INTEGRATION_CREDENTIALS_INVALID',
        }),
      });
    });

    it('rejects with BadRequest when raw credentials string is corrupt (not unhandled 500)', async () => {
      dataSource.query.mockResolvedValue([
        [
          {
            preview_token: 'tmp_x',
            workspace_id: 'ws-1',
            user_id: 'u-1',
            service_type: 'google',
            credentials: '{ not-valid-json',
            token_expires_at: null,
            expires_at: new Date(Date.now() + 60_000),
          },
        ],
        1,
      ]);
      await expect(
        service.consumePreviewToken('tmp_x', 'ws-1', 'u-1'),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'INTEGRATION_CREDENTIALS_INVALID',
        }),
      });
    });
  });

  // E-3: 단독 단위 테스트 — handleCallbackWithErrorCapture 의 의존을 떼고
  // null/primitive 등 비정상 throw 입력의 안전 분기를 잠근다.
  describe('callbackContextOf', () => {
    it('returns the attached context for a normal Error with attachCallbackContext', () => {
      const ctx = {
        integrationId: 'i-1',
        workspaceId: 'ws-1',
        mode: 'connect' as const,
      };
      const err = attachCallbackContext(new Error('boom'), ctx);
      expect(callbackContextOf(err)).toEqual(ctx);
    });

    it('returns undefined for an Error without context attached', () => {
      expect(callbackContextOf(new Error('boom'))).toBeUndefined();
    });

    it('returns undefined for null', () => {
      expect(callbackContextOf(null)).toBeUndefined();
    });

    it('returns undefined for undefined', () => {
      expect(callbackContextOf(undefined)).toBeUndefined();
    });

    it.each([
      ['string', 'oops'],
      ['number', 42],
      ['boolean', true],
      ['bigint', 1n],
    ])('returns undefined for primitive: %s', (_label, value) => {
      expect(callbackContextOf(value)).toBeUndefined();
    });

    it('returns undefined for a plain object without a `context` key', () => {
      expect(callbackContextOf({ message: 'x' })).toBeUndefined();
    });

    it('returns the raw context value even when undefined was attached', () => {
      // 'context' in err 가 true 이면 attach 자체는 일어났다는 의미라
      // attach 한 값(undefined 포함) 을 그대로 surface 한다.
      const err: { context?: unknown } = { context: undefined };
      expect(callbackContextOf(err)).toBeUndefined();
    });
  });
});
