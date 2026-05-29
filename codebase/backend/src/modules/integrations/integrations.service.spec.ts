import {
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  IntegrationsService,
  IntegrationCredentialsUnreadableError,
  buildIntegrationMeta,
  type PublicIntegration,
} from './integrations.service';
import type { Integration } from './entities/integration.entity';
import { UNREADABLE_KEY } from './services/credentials-transformer';
import { createTransport } from 'nodemailer';
import { isSmtpHostBlocked } from '../../common/utils/smtp-host-guard';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));
// SSRF 가드는 별도 unit spec(smtp-host-guard.spec.ts)이 검증한다. 여기서는
// 실제 DNS 조회를 피하기 위해 모킹하고, 호출 여부·분기만 제어한다.
jest.mock('../../common/utils/smtp-host-guard', () => ({
  isSmtpHostBlocked: jest.fn().mockResolvedValue(false),
}));

type Mock = jest.Mock;

function makeIntegration(overrides: Partial<Integration> = {}): Integration {
  const base: Integration = {
    id: 'int-1',
    workspaceId: 'ws-1',
    serviceType: 'google',
    name: 'My Google',
    authType: 'oauth2',
    credentials: {
      access_token: 'ya29-secret',
      refresh_token: 'refresh-secret',
      account_email: 'user@example.com',
      scopes: ['https://www.googleapis.com/auth/drive'],
    },
    scope: 'personal',
    status: 'connected',
    statusReason: null,
    tokenExpiresAt: null,
    lastUsedAt: null,
    lastRotatedAt: null,
    lastError: null,
    createdBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Integration;
  return { ...base, ...overrides };
}

function makeQueryBuilder(result: {
  count?: number;
  many?: unknown[];
  raw?: unknown[];
}): Record<string, Mock> {
  const qb: Record<string, Mock> = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(result.count ?? 0),
    getMany: jest.fn().mockResolvedValue(result.many ?? []),
    getRawMany: jest.fn().mockResolvedValue(result.raw ?? []),
  };
  return qb;
}

describe('IntegrationsService', () => {
  let service: IntegrationsService;
  let integrationRepo: Record<string, Mock>;
  let usageLogRepo: Record<string, Mock>;
  let nodeRepo: Record<string, Mock>;
  let workspacesService: { getMemberRole: Mock };
  let oauthServiceMock: {
    begin: Mock;
    consumePreviewToken: Mock;
  };
  let auditLogsService: { record: Mock };
  let mcpTestConnection: { test: Mock };
  let integration: Integration;

  beforeEach(() => {
    integration = makeIntegration();

    integrationRepo = {
      findOne: jest.fn().mockResolvedValue(integration),
      create: jest
        .fn()
        .mockImplementation((data) => ({ ...integration, ...data })),
      save: jest
        .fn()
        .mockImplementation((entity) => Promise.resolve(entity as Integration)),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      remove: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest
        .fn()
        .mockReturnValue(makeQueryBuilder({ count: 0, many: [] })),
    };

    usageLogRepo = {
      create: jest.fn().mockImplementation((data: unknown) => data),
      save: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest
        .fn()
        .mockReturnValue(makeQueryBuilder({ many: [], raw: [] })),
    };

    nodeRepo = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValue(makeQueryBuilder({ raw: [] })),
    };

    workspacesService = {
      getMemberRole: jest.fn().mockResolvedValue('member'),
    };

    oauthServiceMock = {
      begin: jest
        .fn()
        .mockResolvedValue({ authUrl: 'https://example.com', state: 'abc' }),
      consumePreviewToken: jest.fn(),
    };
    auditLogsService = { record: jest.fn().mockResolvedValue(undefined) };
    mcpTestConnection = {
      test: jest
        .fn()
        .mockResolvedValue({ success: true, message: 'Connection successful' }),
    };

    service = new IntegrationsService(
      integrationRepo as never,
      usageLogRepo as never,
      nodeRepo as never,
      workspacesService as never,
      oauthServiceMock as never,
      auditLogsService as never,
      mcpTestConnection as never,
    );
  });

  // -----------------------------------------------------------------
  // findById / masking
  // -----------------------------------------------------------------
  describe('findById', () => {
    it('masks secret credential fields', async () => {
      const result = await service.findById('int-1', 'ws-1');
      expect(result.credentials.access_token).toBe('********');
      expect(result.credentials.account_email).toBe('user@example.com');
    });

    it('throws NotFoundException when missing', async () => {
      integrationRepo.findOne.mockResolvedValue(null);
      await expect(service.findById('missing', 'ws-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    // -----------------------------------------------------------------
    // meta.appType — safe-to-expose hints derived from credentials.
    // FE uses this to decide Reauthorize button visibility for Cafe24
    // Private apps without ever touching the encrypted credentials blob.
    // -----------------------------------------------------------------
    describe('meta.appType', () => {
      it('returns "private" for Cafe24 Private rows', async () => {
        integrationRepo.findOne.mockResolvedValue(
          makeIntegration({
            serviceType: 'cafe24',
            authType: 'oauth2',
            credentials: {
              mall_id: 'myshop',
              app_type: 'private',
              client_id: 'cid',
              client_secret: 'csec',
            },
          }),
        );
        const result = await service.findById('int-1', 'ws-1');
        expect(result.meta).toEqual({ appType: 'private' });
      });

      it('returns "public" for Cafe24 Public rows', async () => {
        integrationRepo.findOne.mockResolvedValue(
          makeIntegration({
            serviceType: 'cafe24',
            authType: 'oauth2',
            credentials: {
              mall_id: 'myshop',
              app_type: 'public',
              access_token: 'tok',
            },
          }),
        );
        const result = await service.findById('int-1', 'ws-1');
        expect(result.meta).toEqual({ appType: 'public' });
      });

      it('returns null for non-cafe24 service types', async () => {
        // Default makeIntegration uses serviceType='google'.
        const result = await service.findById('int-1', 'ws-1');
        expect(result.meta).toEqual({ appType: null });
      });

      it('returns null when cafe24 credentials have unexpected app_type', async () => {
        integrationRepo.findOne.mockResolvedValue(
          makeIntegration({
            serviceType: 'cafe24',
            credentials: { mall_id: 'shop', app_type: 'bogus' },
          }),
        );
        const result = await service.findById('int-1', 'ws-1');
        expect(result.meta).toEqual({ appType: null });
      });

      it('returns null when credentials are unreadable (no decrypt → no peek)', async () => {
        // Unreadable credentials sentinel — toPublic short-circuits to a
        // reconnect-required row and meta must not leak any peek either.
        integrationRepo.findOne.mockResolvedValue(
          makeIntegration({
            serviceType: 'cafe24',
            credentials: { __unreadable: true } as unknown as Record<
              string,
              unknown
            >,
          }),
        );
        const result = await service.findById('int-1', 'ws-1');
        expect(result.meta).toEqual({ appType: null });
        // Sanity: status flips to error/needs_reauth on unreadable.
        expect(result.credentialsStatus).toBe('needs_reauth');
      });
    });

    // -----------------------------------------------------------------
    // appUrl — Cafe24 Private 통합 한정. 상세 페이지의 Cafe24 App URL 카드가
    // Cafe24 Developers 의 "앱 URL" 갱신 안내에 노출하는 actionable URL.
    // spec/2-navigation/4-integration.md §4.2 + §9.1 + Rationale "Cafe24
    // App URL 상세 페이지 표시".
    // -----------------------------------------------------------------
    describe('appUrl', () => {
      const ORIGINAL_APP_URL = process.env.APP_URL;
      beforeEach(() => {
        process.env.APP_URL = 'https://app.example.com';
      });
      afterAll(() => {
        if (ORIGINAL_APP_URL === undefined) {
          delete process.env.APP_URL;
        } else {
          process.env.APP_URL = ORIGINAL_APP_URL;
        }
      });

      it('returns full App URL for Cafe24 Private with installToken', async () => {
        integrationRepo.findOne.mockResolvedValue(
          makeIntegration({
            serviceType: 'cafe24',
            authType: 'oauth2',
            installToken: 'AbCdEfGhIjKlMnOpQrStUv',
            credentials: {
              mall_id: 'myshop',
              app_type: 'private',
              client_id: 'cid',
              client_secret: 'csec',
            },
          }),
        );
        const result = await service.findById('int-1', 'ws-1');
        expect(result.appUrl).toBe(
          'https://app.example.com/api/3rd-party/cafe24/install/AbCdEfGhIjKlMnOpQrStUv',
        );
      });

      it('returns null for Cafe24 Private when installToken is null (TTL 만료)', async () => {
        integrationRepo.findOne.mockResolvedValue(
          makeIntegration({
            serviceType: 'cafe24',
            authType: 'oauth2',
            installToken: null,
            credentials: {
              mall_id: 'myshop',
              app_type: 'private',
              client_id: 'cid',
              client_secret: 'csec',
            },
          }),
        );
        const result = await service.findById('int-1', 'ws-1');
        expect(result.appUrl).toBeNull();
      });

      it('returns null for Cafe24 Public (App URL 흐름 미사용)', async () => {
        integrationRepo.findOne.mockResolvedValue(
          makeIntegration({
            serviceType: 'cafe24',
            authType: 'oauth2',
            installToken: null,
            credentials: {
              mall_id: 'myshop',
              app_type: 'public',
              access_token: 'tok',
            },
          }),
        );
        const result = await service.findById('int-1', 'ws-1');
        expect(result.appUrl).toBeNull();
      });

      it('returns null for non-cafe24 service types', async () => {
        // Default makeIntegration uses serviceType='google'.
        const result = await service.findById('int-1', 'ws-1');
        expect(result.appUrl).toBeNull();
      });

      it('does NOT expose installToken as a top-level field (식별자 분산 방지)', async () => {
        integrationRepo.findOne.mockResolvedValue(
          makeIntegration({
            serviceType: 'cafe24',
            authType: 'oauth2',
            installToken: 'AbCdEfGhIjKlMnOpQrStUv',
            credentials: {
              mall_id: 'myshop',
              app_type: 'private',
              client_id: 'cid',
              client_secret: 'csec',
            },
          }),
        );
        const result = await service.findById('int-1', 'ws-1');
        expect(
          (result as unknown as Record<string, unknown>).installToken,
        ).toBeUndefined();
      });

      it('trims trailing slash from APP_URL when building App URL', async () => {
        process.env.APP_URL = 'https://app.example.com/';
        integrationRepo.findOne.mockResolvedValue(
          makeIntegration({
            serviceType: 'cafe24',
            authType: 'oauth2',
            installToken: 'AbCdEfGhIjKlMnOpQrStUv',
            credentials: {
              mall_id: 'myshop',
              app_type: 'private',
              client_id: 'cid',
              client_secret: 'csec',
            },
          }),
        );
        const result = await service.findById('int-1', 'ws-1');
        expect(result.appUrl).toBe(
          'https://app.example.com/api/3rd-party/cafe24/install/AbCdEfGhIjKlMnOpQrStUv',
        );
      });

      it('returns null when credentials are unreadable even for cafe24 private', async () => {
        integrationRepo.findOne.mockResolvedValue(
          makeIntegration({
            serviceType: 'cafe24',
            installToken: 'AbCdEfGhIjKlMnOpQrStUv',
            credentials: { __unreadable: true } as unknown as Record<
              string,
              unknown
            >,
          }),
        );
        const result = await service.findById('int-1', 'ws-1');
        expect(result.appUrl).toBeNull();
      });
    });

    // -----------------------------------------------------------------
    // autoRefresh — derived field for UI 분기 (attention 술어·헤더 보조 라벨).
    // spec/2-navigation/4-integration.md §9.1 + Rationale "자동 갱신 통합을
    // attention 술어에서 제외 (2026-05-17)" + spec/1-data-model.md §2.10
    // 응답 DTO 전용 derived 필드. `ServiceDefinition.supportsTokenAutoRefresh`
    // 에서 매 응답 시점에 계산되며 DB 컬럼이 아니다.
    // -----------------------------------------------------------------
    describe('autoRefresh', () => {
      it('returns true for cafe24 (refresh_token + auto-refresh worker)', async () => {
        integrationRepo.findOne.mockResolvedValue(
          makeIntegration({
            serviceType: 'cafe24',
            authType: 'oauth2',
            credentials: { mall_id: 'myshop', app_type: 'public' },
          }),
        );
        const result = await service.findById('int-1', 'ws-1');
        expect(result.autoRefresh).toBe(true);
      });

      it('returns true for google (refresh_token 발급 provider)', async () => {
        // Default makeIntegration uses serviceType='google'.
        const result = await service.findById('int-1', 'ws-1');
        expect(result.autoRefresh).toBe(true);
      });

      it('returns false for github (Refresh ✗ — spec §10.3 long-lived token)', async () => {
        integrationRepo.findOne.mockResolvedValue(
          makeIntegration({ serviceType: 'github', authType: 'oauth2' }),
        );
        const result = await service.findById('int-1', 'ws-1');
        expect(result.autoRefresh).toBe(false);
      });

      it('returns false for non-OAuth service types (http/api_key 등)', async () => {
        integrationRepo.findOne.mockResolvedValue(
          makeIntegration({ serviceType: 'http', authType: 'api_key' }),
        );
        const result = await service.findById('int-1', 'ws-1');
        expect(result.autoRefresh).toBe(false);
      });

      it('returns true for cafe24 Private 도 동일 (mall-aware refresh 가 동작 — autoRefresh=true 유지)', async () => {
        // Private/Public 무관하게 cafe24 는 refresh_token + Cafe24ApiClient
        // 자동 갱신 메커니즘을 동일하게 사용한다.
        integrationRepo.findOne.mockResolvedValue(
          makeIntegration({
            serviceType: 'cafe24',
            authType: 'oauth2',
            credentials: { mall_id: 'myshop', app_type: 'private' },
          }),
        );
        const result = await service.findById('int-1', 'ws-1');
        expect(result.autoRefresh).toBe(true);
      });

      it('returns false for unknown service_type (service registry 미등록)', async () => {
        integrationRepo.findOne.mockResolvedValue(
          makeIntegration({
            serviceType: 'unknown-provider',
            authType: 'api_key',
          }),
        );
        const result = await service.findById('int-1', 'ws-1');
        expect(result.autoRefresh).toBe(false);
      });

      it('returns false for unreadable credentials (status=error 분기에서도 일관되게 false 가 아닌 service 정의 기반)', async () => {
        // credsUnreadable 분기는 status='error', credentialsStatus='needs_reauth'
        // 로 전이하지만, autoRefresh 는 service 정의에만 의존하므로 cafe24 면
        // 여전히 true 가 자연스럽다 (UI 는 어차피 error 상태로 분기하여
        // Reauthorize/재인증 흐름을 우선시).
        integrationRepo.findOne.mockResolvedValue(
          makeIntegration({
            serviceType: 'cafe24',
            credentials: { __unreadable: true } as unknown as Record<
              string,
              unknown
            >,
          }),
        );
        const result = await service.findById('int-1', 'ws-1');
        expect(result.autoRefresh).toBe(true);
      });
    });
  });

  // -----------------------------------------------------------------
  // testConnection
  // -----------------------------------------------------------------
  describe('testConnection', () => {
    it('returns success for valid credentials', async () => {
      const result = await service.testConnection('int-1', 'ws-1');
      expect(result.success).toBe(true);
    });

    it('throws NotFoundException for missing integration', async () => {
      integrationRepo.findOne.mockResolvedValue(null);
      await expect(service.testConnection('missing', 'ws-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('uses registered entity-aware tester for matching service_type — wins over dispatchTest', async () => {
      const cafe24Integration = makeIntegration({
        serviceType: 'cafe24',
        authType: 'oauth2',
        credentials: {
          mall_id: 'myshop',
          app_type: 'public',
          access_token: 't',
          refresh_token: 'r',
          scopes: ['mall.read_product'],
          expires_at: new Date(Date.now() + 1e7).toISOString(),
          cafe24_operator_id: 'op-1',
        },
      });
      integrationRepo.findOne.mockResolvedValue(cafe24Integration);

      const probe = jest.fn().mockResolvedValue({
        success: false,
        message: 'expired',
        code: 'CAFE24_AUTH_FAILED',
      });
      service.registerEntityTester('cafe24', probe);

      const result = await service.testConnection('int-1', 'ws-1');

      expect(probe).toHaveBeenCalledWith(cafe24Integration);
      expect(result).toEqual({
        success: false,
        message: 'expired',
        code: 'CAFE24_AUTH_FAILED',
      });
    });

    it('warns when registerEntityTester overwrites an existing registration (drift detection)', async () => {
      const warnSpy = jest
        .spyOn(
          (service as unknown as { logger: { warn: Mock } }).logger,
          'warn',
        )
        .mockImplementation(() => undefined);

      const first = jest
        .fn()
        .mockResolvedValue({ success: true, message: 'first' });
      const second = jest
        .fn()
        .mockResolvedValue({ success: true, message: 'second' });

      service.registerEntityTester('cafe24', first);
      expect(warnSpy).not.toHaveBeenCalled();

      service.registerEntityTester('cafe24', second);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("service_type='cafe24'"),
      );

      warnSpy.mockRestore();
    });

    it('falls through to dispatchTest when no entity tester is registered for the service_type', async () => {
      const cafe24Integration = makeIntegration({
        serviceType: 'cafe24',
        authType: 'oauth2',
        credentials: {
          mall_id: 'myshop',
          app_type: 'public',
          access_token: 't',
          refresh_token: 'r',
          scopes: ['mall.read_product'],
          expires_at: new Date(Date.now() + 1e7).toISOString(),
          cafe24_operator_id: 'op-1',
        },
      });
      integrationRepo.findOne.mockResolvedValue(cafe24Integration);

      // No entity tester registered — fallback path returns structural success.
      const result = await service.testConnection('int-1', 'ws-1');
      expect(result.success).toBe(true);
    });

    it('rejects pending_install integration with INTEGRATION_INCOMPLETE — no entity tester or dispatch call', async () => {
      // spec/2-navigation/4-integration.md §9.1 + Rationale "연결 테스트 endpoint
      // 의 `pending_install` 가드 — 응답 형식 (2026-05-18)". Token is not yet
      // issued, so an external probe is meaningless; the guard runs before the
      // entity tester / dispatchTest path.
      const pendingCafe24 = makeIntegration({
        serviceType: 'cafe24',
        authType: 'oauth2',
        status: 'pending_install',
        credentials: {
          mall_id: 'myshop',
          app_type: 'private',
          client_id: 'cid',
          client_secret: 'csecret',
          // No access_token / refresh_token — typical pending_install shape.
        },
      });
      integrationRepo.findOne.mockResolvedValue(pendingCafe24);

      const probe = jest.fn();
      service.registerEntityTester('cafe24', probe);

      const result = await service.testConnection('int-1', 'ws-1');

      expect(probe).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: false,
        code: 'INTEGRATION_INCOMPLETE',
        message: expect.stringContaining('pending_install'),
      });
    });

    it('pending_install guard is service_type-agnostic — same response for non-cafe24 row', async () => {
      // The guard checks status only; future providers adopting pending_install
      // inherit the protection automatically.
      const pendingHttp = makeIntegration({
        serviceType: 'http',
        authType: 'api_key',
        status: 'pending_install',
        credentials: { api_key: 'k' },
      });
      integrationRepo.findOne.mockResolvedValue(pendingHttp);

      const result = await service.testConnection('int-1', 'ws-1');

      expect(result).toEqual({
        success: false,
        code: 'INTEGRATION_INCOMPLETE',
        message: expect.stringContaining('pending_install'),
      });
    });
  });

  // -----------------------------------------------------------------
  // testConnection — email(SMTP) transport tester (Fix 2)
  // 종전엔 email 에 transport tester 가 없어 구조 검증만 통과하면 무조건
  // 성공으로 표시됐다. 이제 nodemailer verify() 로 실제 접속+인증을 검증한다.
  // -----------------------------------------------------------------
  describe('testConnection — email(SMTP)', () => {
    const mockedCreateTransport = createTransport as unknown as Mock;

    function makeEmailIntegration(): Integration {
      return makeIntegration({
        serviceType: 'email',
        authType: 'smtp',
        credentials: {
          host: 'smtp.example.com',
          port: 587,
          secure: 'starttls',
          username: 'user@example.com',
          password: 'app-password',
          default_from: 'user@example.com',
        },
      });
    }

    const mockedIsSmtpHostBlocked = isSmtpHostBlocked as unknown as Mock;

    beforeEach(() => {
      mockedCreateTransport.mockReset();
      mockedIsSmtpHostBlocked.mockReset();
      mockedIsSmtpHostBlocked.mockResolvedValue(false);
    });

    it('returns success when nodemailer verify() resolves', async () => {
      integrationRepo.findOne.mockResolvedValue(makeEmailIntegration());
      const verify = jest.fn().mockResolvedValue(true);
      const close = jest.fn();
      mockedCreateTransport.mockReturnValue({ verify, close });

      const result = await service.testConnection('int-1', 'ws-1');

      expect(result).toEqual({
        success: true,
        message: 'Connection successful',
      });
      // 실제 SMTP 검증이 수행됐는지 — verify 호출 + STARTTLS 매핑 확인.
      expect(verify).toHaveBeenCalledTimes(1);
      expect(mockedCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'smtp.example.com',
          port: 587,
          secure: false,
          requireTLS: true,
          auth: { user: 'user@example.com', pass: 'app-password' },
        }),
      );
      expect(close).toHaveBeenCalled();
    });

    it('returns failure with EMAIL_CONNECT_FAILED when verify() rejects (auth failure)', async () => {
      integrationRepo.findOne.mockResolvedValue(makeEmailIntegration());
      const verify = jest
        .fn()
        .mockRejectedValue(
          new Error('Invalid login: 535 Authentication failed'),
        );
      const close = jest.fn();
      mockedCreateTransport.mockReturnValue({ verify, close });

      const result = await service.testConnection('int-1', 'ws-1');

      expect(result.success).toBe(false);
      expect(result.code).toBe('EMAIL_CONNECT_FAILED');
      expect(result.message).toContain('Authentication failed');
      // 실패해도 transporter 는 닫아야 한다 (소켓 누수 방지).
      expect(close).toHaveBeenCalled();
    });

    it('does not attempt SMTP connection when a required field is missing (structural validation first)', async () => {
      integrationRepo.findOne.mockResolvedValue(
        makeIntegration({
          serviceType: 'email',
          authType: 'smtp',
          credentials: {
            host: 'smtp.example.com',
            port: 587,
            secure: 'starttls',
            username: 'user@example.com',
            // password 누락
            default_from: 'user@example.com',
          },
        }),
      );

      const result = await service.testConnection('int-1', 'ws-1');

      expect(result.success).toBe(false);
      expect(mockedCreateTransport).not.toHaveBeenCalled();
    });

    it('maps secure:"tls" to implicit TLS (secure:true, requireTLS:false)', async () => {
      integrationRepo.findOne.mockResolvedValue(
        makeIntegration({
          serviceType: 'email',
          authType: 'smtp',
          credentials: {
            host: 'smtp.example.com',
            port: 465,
            secure: 'tls',
            username: 'user@example.com',
            password: 'app-password',
            default_from: 'user@example.com',
          },
        }),
      );
      const verify = jest.fn().mockResolvedValue(true);
      mockedCreateTransport.mockReturnValue({ verify, close: jest.fn() });

      await service.testConnection('int-1', 'ws-1');

      expect(mockedCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({ secure: true, requireTLS: false }),
      );
    });

    it('previewTest (pre-save) also runs the real SMTP verify for email', async () => {
      const verify = jest.fn().mockResolvedValue(true);
      const close = jest.fn();
      mockedCreateTransport.mockReturnValue({ verify, close });

      const result = await service.previewTest({
        serviceType: 'email',
        authType: 'smtp',
        credentials: {
          host: 'smtp.example.com',
          port: 587,
          secure: 'starttls',
          username: 'user@example.com',
          password: 'app-password',
          default_from: 'user@example.com',
        },
      });

      expect(result).toEqual({
        success: true,
        message: 'Connection successful',
      });
      expect(verify).toHaveBeenCalledTimes(1);
      expect(close).toHaveBeenCalled();
    });

    it('blocks a private/loopback host (no SMTP attempt) — guard on by default', async () => {
      mockedIsSmtpHostBlocked.mockResolvedValue(true);
      integrationRepo.findOne.mockResolvedValue(
        makeIntegration({
          serviceType: 'email',
          authType: 'smtp',
          credentials: {
            host: '169.254.169.254',
            port: 587,
            secure: 'starttls',
            username: 'user@example.com',
            password: 'app-password',
            default_from: 'user@example.com',
          },
        }),
      );

      const result = await service.testConnection('int-1', 'ws-1');

      expect(result.success).toBe(false);
      expect(result.code).toBe('EMAIL_HOST_BLOCKED');
      // 차단 시 실제 SMTP 연결을 시도하지 않아야 한다.
      expect(mockedCreateTransport).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------
  // reauthorize
  // -----------------------------------------------------------------
  describe('reauthorize', () => {
    it('delegates to OAuth service for OAuth integrations', async () => {
      const result = await service.reauthorize('int-1', 'ws-1', 'user-1');
      expect(result.authUrl).toBe('https://example.com');
      expect(oauthServiceMock.begin).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'google',
          mode: 'reauthorize',
          integrationId: 'int-1',
        }),
      );
    });

    it('resets status for non-OAuth integrations', async () => {
      integrationRepo.findOne.mockResolvedValue(
        makeIntegration({
          serviceType: 'http',
          authType: 'api_key',
          status: 'error',
          statusReason: 'auth_failed',
        }),
      );
      const result = await service.reauthorize('int-1', 'ws-1', 'user-1');
      expect(result).toEqual({ authUrl: '', state: '' });
      expect(integrationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'connected', statusReason: null }),
      );
    });
  });

  // -----------------------------------------------------------------
  // remove / usage-block
  // -----------------------------------------------------------------
  describe('remove', () => {
    it('deletes when no usages exist', async () => {
      await service.remove('int-1', 'ws-1', 'user-1');
      expect(integrationRepo.remove).toHaveBeenCalled();
      expect(auditLogsService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'integration.deleted' }),
      );
    });

    it('throws ConflictException when usages exist', async () => {
      nodeRepo.createQueryBuilder.mockReturnValue(
        makeQueryBuilder({
          raw: [
            {
              node_id: 'n1',
              node_label: 'Send HTTP',
              node_type: 'http-request',
              workflow_id: 'w1',
              workflow_name: 'Workflow A',
              is_active: true,
            },
          ],
        }),
      );
      await expect(service.remove('int-1', 'ws-1', 'user-1')).rejects.toThrow(
        ConflictException,
      );
      expect(integrationRepo.remove).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------
  // getUsages
  // -----------------------------------------------------------------
  describe('getUsages', () => {
    it('groups rows by workflow', async () => {
      nodeRepo.createQueryBuilder.mockReturnValue(
        makeQueryBuilder({
          raw: [
            {
              node_id: 'n1',
              node_label: 'Send',
              node_type: 'http-send',
              workflow_id: 'w1',
              workflow_name: 'Workflow A',
              is_active: true,
            },
            {
              node_id: 'n2',
              node_label: 'Lookup',
              node_type: 'http-user',
              workflow_id: 'w1',
              workflow_name: 'Workflow A',
              is_active: true,
            },
            {
              node_id: 'n3',
              node_label: 'Notify',
              node_type: 'http-send',
              workflow_id: 'w2',
              workflow_name: 'Workflow B',
              is_active: false,
            },
          ],
        }),
      );
      const usages = await service.getUsages('int-1', 'ws-1');
      expect(usages).toHaveLength(2);
      expect(usages[0].nodes).toHaveLength(2);
      expect(usages[1].isActive).toBe(false);
    });
  });

  // -----------------------------------------------------------------
  // rotate
  // -----------------------------------------------------------------
  describe('rotate', () => {
    beforeEach(() => {
      integrationRepo.findOne.mockResolvedValue(
        makeIntegration({
          serviceType: 'http',
          authType: 'api_key',
          credentials: {
            location: 'header',
            key_name: 'X-Api-Key',
            value: 'old-secret',
          },
        }),
      );
    });

    it('rejects OAuth rotation', async () => {
      integrationRepo.findOne.mockResolvedValue(makeIntegration());
      await expect(
        service.rotate('int-1', 'ws-1', 'user-1', 'member', {
          credentials: { access_token: 'new' },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('merges credentials and marks rotated on success', async () => {
      const result = await service.rotate('int-1', 'ws-1', 'user-1', 'member', {
        credentials: { value: 'new-secret' },
      });
      expect(result.credentials.value).toBe('********');
      expect(integrationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          lastRotatedAt: expect.any(Date),
          status: 'connected',
          statusReason: null,
        }),
      );
      expect(auditLogsService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'integration.rotated' }),
      );
    });

    it('rejects org-scope rotation for non-admin', async () => {
      integrationRepo.findOne.mockResolvedValue(
        makeIntegration({
          serviceType: 'http',
          authType: 'api_key',
          scope: 'organization',
          credentials: {
            location: 'header',
            key_name: 'X-Api-Key',
            value: 'v',
          },
        }),
      );
      await expect(
        service.rotate('int-1', 'ws-1', 'user-1', 'member', {
          credentials: { value: 'v2' },
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // -----------------------------------------------------------------
  // requestScopes
  // -----------------------------------------------------------------
  describe('requestScopes', () => {
    it('merges existing + new scopes and delegates to OAuth service', async () => {
      await service.requestScopes('int-1', 'ws-1', 'user-1', 'member', {
        scopes: ['https://www.googleapis.com/auth/gmail.send'],
      });
      expect(oauthServiceMock.begin).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'google',
          mode: 'request_scopes',
          integrationId: 'int-1',
          scopes: expect.arrayContaining([
            'https://www.googleapis.com/auth/drive',
            'https://www.googleapis.com/auth/gmail.send',
          ]),
        }),
      );
    });

    it('rejects non-OAuth services', async () => {
      integrationRepo.findOne.mockResolvedValue(
        makeIntegration({
          serviceType: 'http',
          authType: 'api_key',
          credentials: { location: 'header', key_name: 'X', value: 'v' },
        }),
      );
      await expect(
        service.requestScopes('int-1', 'ws-1', 'user-1', 'member', {
          scopes: ['x'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    /**
     * 회귀 보호 (2026-05-15) — 옛 코드는 cafe24 통합에서 begin 호출 시
     * providerMeta 누락으로 `CAFE24_INVALID_MALL_ID` 가 발생. cafe24 의
     * begin 검증부는 mall_id 를 providerMeta 에서 읽으므로 requestScopes 가
     * entity.credentials.mall_id 를 거쳐 전달해야 한다.
     */
    it('passes cafe24 mall_id/app_type as providerMeta for Public app', async () => {
      integrationRepo.findOne.mockResolvedValue(
        makeIntegration({
          serviceType: 'cafe24',
          authType: 'oauth2',
          credentials: {
            mall_id: 'gehrig0301',
            app_type: 'public',
            access_token: 't',
            refresh_token: 'r',
            scopes: ['mall.read_product'],
          },
        }),
      );
      await service.requestScopes('int-1', 'ws-1', 'user-1', 'member', {
        scopes: ['mall.read_store'],
      });
      expect(oauthServiceMock.begin).toHaveBeenCalledWith(
        expect.objectContaining({
          service: 'cafe24',
          mode: 'request_scopes',
          providerMeta: { mall_id: 'gehrig0301', app_type: 'public' },
        }),
      );
    });

    /**
     * 회귀 보호 (2026-05-15) — Cafe24 Private 은 우리 서버가 OAuth 를
     * 시작할 수 없으므로 begin 호출이 `CAFE24_PRIVATE_APP_USE_TEST_RUN`
     * 으로 거부됨. requestScopes 는 이 경로를 우회하고 기존 install_token
     * 을 재사용하는 `cafe24_private_pending` 응답을 반환한다.
     */
    it('cafe24 Private — bypasses begin and returns cafe24_private_pending with merged scopes saved', async () => {
      const original = process.env.APP_URL;
      process.env.APP_URL = 'https://app.example.com';
      const integration = makeIntegration({
        serviceType: 'cafe24',
        authType: 'oauth2',
        credentials: {
          mall_id: 'gehrig0301',
          app_type: 'private',
          client_id: 'cid',
          client_secret: 'csec',
          access_token: 't',
          refresh_token: 'r',
          scopes: ['mall.read_product'],
        },
        installToken: 'PreservedToken123456__',
      });
      integrationRepo.findOne.mockResolvedValue(integration);
      integrationRepo.save = jest
        .fn()
        .mockImplementation((e: Integration) => Promise.resolve(e));
      try {
        const result = await service.requestScopes(
          'int-1',
          'ws-1',
          'user-1',
          'member',
          { scopes: ['mall.read_store', 'mall.read_product'] },
        );
        // Must NOT call begin — Private bypasses OAuth.
        expect(oauthServiceMock.begin).not.toHaveBeenCalled();
        // Returns the cafe24_private_pending shape with appUrl reusing
        // the existing installToken (so the URL stays registered in
        // Cafe24 Developers).
        expect(result).toMatchObject({
          mode: 'cafe24_private_pending',
          integrationId: 'int-1',
          appUrl:
            'https://app.example.com/api/3rd-party/cafe24/install/PreservedToken123456__',
          callbackUrl: 'https://app.example.com/api/3rd-party/cafe24/callback',
          scopesAdded: ['mall.read_store'],
        });
        // credentials.scopes is merged + saved.
        expect(integrationRepo.save).toHaveBeenCalledTimes(1);
        const saved = integrationRepo.save.mock.calls[0][0] as Integration;
        const creds = saved.credentials;
        expect(creds.scopes).toEqual(['mall.read_product', 'mall.read_store']);
      } finally {
        if (original === undefined) delete process.env.APP_URL;
        else process.env.APP_URL = original;
      }
    });
  });

  // -----------------------------------------------------------------
  // updateScope
  // -----------------------------------------------------------------
  describe('updateScope', () => {
    it('requires admin role', async () => {
      await expect(
        service.updateScope('int-1', 'ws-1', 'user-1', 'member', {
          scope: 'organization',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows admin to change scope', async () => {
      const result = await service.updateScope(
        'int-1',
        'ws-1',
        'user-1',
        'owner',
        { scope: 'organization' },
      );
      expect(result.scope).toBe('organization');
      expect(auditLogsService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'integration.scope_changed' }),
      );
    });
  });

  // -----------------------------------------------------------------
  // create
  // -----------------------------------------------------------------
  describe('create', () => {
    it('rejects organization scope for non-admin', async () => {
      await expect(
        service.create('ws-1', 'user-1', 'member', {
          serviceType: 'http',
          authType: 'api_key',
          name: 'My API',
          scope: 'organization',
          credentials: { location: 'header', key_name: 'X', value: 'v' },
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('validates credentials against schema', async () => {
      await expect(
        service.create('ws-1', 'user-1', 'member', {
          serviceType: 'http',
          authType: 'api_key',
          name: 'My API',
          credentials: { location: 'header' },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('persists valid integration', async () => {
      const result = await service.create('ws-1', 'user-1', 'member', {
        serviceType: 'http',
        authType: 'api_key',
        name: 'My API',
        credentials: {
          location: 'header',
          key_name: 'X-Api-Key',
          value: 'secret',
        },
      });
      expect(result.name).toBe('My API');
      expect(result.credentials.value).toBe('********');
      expect(auditLogsService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'integration.created' }),
      );
    });

    // 회귀 — 신규 통합 생성 시 lastRotatedAt 이 명시 초기화되어야 한다.
    // 없으면 NULL 로 저장되어 `enqueueCafe24BackgroundRefresh` 의 cutoff
    // 비교 (`LessThan(now - 10d)`) 에서 PostgreSQL 의 `NULL < value = FALSE`
    // 시맨틱으로 영원히 제외 → 신규 Cafe24 통합 14일 idle 시 refresh_token
    // 만료. PR #56 의 idle 보호 무력화 회귀를 차단.
    it('initializes lastRotatedAt on create so background refresh covers fresh integrations', async () => {
      await service.create('ws-1', 'user-1', 'member', {
        serviceType: 'http',
        authType: 'api_key',
        name: 'My API',
        credentials: {
          location: 'header',
          key_name: 'X-Api-Key',
          value: 'secret',
        },
      });
      const createArg = integrationRepo.create.mock.calls[0][0] as {
        lastRotatedAt?: Date;
      };
      expect(createArg.lastRotatedAt).toBeInstanceOf(Date);
    });

    // V045 partial UNIQUE `idx_integration_cafe24_workspace_mall` race
    // backstop (2026-05-16) — Cafe24 Public 흐름은 begin 단계에서 row 를
    // 만들지 않으므로 finalize (`POST /api/integrations`) 의 INSERT 가 동시
    // 진입 시 V045 UNIQUE 위반을 일으킬 수 있다. 옛 `throwIfUniqueViolation`
    // 은 `integration_workspace_name_unique` 만 처리해 raw QueryFailedError
    // 가 500 으로 빠지던 결함을 해결. 두 race 경로 (public finalize +
    // private begin 동시 신청) 모두 동일한 409 코드로 변환.
    it('translates cafe24 mall_id unique violation to CAFE24_PRIVATE_APP_ALREADY_CONNECTED (409)', async () => {
      integrationRepo.save = jest.fn().mockRejectedValueOnce(
        Object.assign(
          new Error('duplicate key value violates unique constraint'),
          {
            code: '23505',
            constraint: 'idx_integration_cafe24_workspace_mall',
          },
        ),
      );
      const error = await service
        .create('ws-1', 'user-1', 'member', {
          serviceType: 'http',
          authType: 'api_key',
          name: 'My API',
          credentials: {
            location: 'header',
            key_name: 'X-Api-Key',
            value: 'secret',
          },
        })
        .catch((e: Error) => e);
      const response = (error as { response?: { code?: string } }).response;
      expect(response?.code).toBe('CAFE24_PRIVATE_APP_ALREADY_CONNECTED');
    });

    it('translates integration name unique violation to INTEGRATION_NAME_TAKEN (409)', async () => {
      integrationRepo.save = jest.fn().mockRejectedValueOnce(
        Object.assign(
          new Error('duplicate key value violates unique constraint'),
          {
            code: '23505',
            constraint: 'integration_workspace_name_unique',
          },
        ),
      );
      const error = await service
        .create('ws-1', 'user-1', 'member', {
          serviceType: 'http',
          authType: 'api_key',
          name: 'My API',
          credentials: {
            location: 'header',
            key_name: 'X-Api-Key',
            value: 'secret',
          },
        })
        .catch((e: Error) => e);
      const response = (error as { response?: { code?: string } }).response;
      expect(response?.code).toBe('INTEGRATION_NAME_TAKEN');
    });

    // 트랜잭션 미적용 결정 (W23 검토 결과) 의 회귀 안전망 — ai-review INFO 10
    // (2026-05-16). `auditLogsService.record` 가 내부 try/catch 로 모든
    // exception 을 swallow 하므로 audit 기록 실패는 user-visible 흐름에
    // 영향을 주지 않는다. 향후 audit log 가 throw 하도록 변경되면 본 테스트가
    // 회귀를 감지 — Integration row 는 commit 되었으므로 사용자에게 결과를
    // 정상 반환해야 한다 (audit 누락은 best-effort 정책).
    it('returns integration even when audit log record throws internally (best-effort audit)', async () => {
      // record() 가 내부 try/catch 를 통과하지 못하고 throw 한다고 가정.
      // (실제 record() 구현은 내부에서 swallow 하므로 본 시나리오는 회귀 시
      // 만 발생.)
      auditLogsService.record = jest
        .fn()
        .mockRejectedValueOnce(new Error('audit DB unreachable'));

      // save() 는 정상 — row 가 commit 된 상태.
      const result = await service
        .create('ws-1', 'user-1', 'member', {
          serviceType: 'http',
          authType: 'api_key',
          name: 'My API (audit fail)',
          credentials: {
            location: 'header',
            key_name: 'X-Api-Key',
            value: 'secret',
          },
        })
        .catch((e: Error) => e);

      // 호출자에게는 row 가 정상 반환되어야 한다 (audit 실패는 swallow).
      // 만약 audit 실패가 user-visible 500 으로 빠지면 본 단언이 실패해
      // 회귀를 감지.
      expect(result).not.toBeInstanceOf(Error);
      expect((result as PublicIntegration).name).toBe('My API (audit fail)');
      // audit 시도는 반드시 일어났어야 한다 (best-effort 의무).
      expect(auditLogsService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'integration.created' }),
      );
    });
  });

  // -----------------------------------------------------------------
  // findAll — filter translation
  // -----------------------------------------------------------------
  describe('findAll', () => {
    it('applies q/scope/serviceType/status filters to query builder', async () => {
      const qb = makeQueryBuilder({ count: 0, many: [] });
      integrationRepo.createQueryBuilder.mockReturnValue(qb);
      await service.findAll('ws-1', {
        q: 'google',
        scope: 'organization',
        serviceType: ['google', 'github'],
        status: 'expiring',
      });
      const sql = qb.andWhere.mock.calls.map((c) => c[0]).join(' | ');
      expect(sql).toContain('i.name ILIKE');
      expect(sql).toContain('i.scope');
      expect(sql).toContain('service_type IN');
      expect(sql).toContain('status');
    });

    it('ignores empty serviceType array', async () => {
      const qb = makeQueryBuilder({ count: 0, many: [] });
      integrationRepo.createQueryBuilder.mockReturnValue(qb);
      await service.findAll('ws-1', { serviceType: [] });
      const sql = qb.andWhere.mock.calls.map((c) => c[0]).join(' | ');
      expect(sql).not.toContain('service_type IN');
    });

    // attention is a virtual filter value (spec/2-navigation/4-integration.md
    // §2.4 + §9.1 Rationale "Attention 가상 필터값"). It compiles to the
    // union of expired ∪ error ∪ (connected within 7d), and never matches
    // pending_install rows — those are an explicit external-flow state.
    it('status=attention emits union WHERE covering expired, error, and connected within 7d', async () => {
      const qb = makeQueryBuilder({ count: 0, many: [] });
      integrationRepo.createQueryBuilder.mockReturnValue(qb);
      await service.findAll('ws-1', { status: 'attention' });
      const sql = qb.andWhere.mock.calls.map((c) => c[0]).join(' | ');
      expect(sql).toContain("'expired'");
      expect(sql).toContain("'error'");
      expect(sql).toContain("'connected'");
      expect(sql).toContain('token_expires_at IS NOT NULL');
      expect(sql).toContain('token_expires_at > NOW()');
      expect(sql).toContain('7 days');
    });

    it('status=attention does not include pending_install rows', async () => {
      const qb = makeQueryBuilder({ count: 0, many: [] });
      integrationRepo.createQueryBuilder.mockReturnValue(qb);
      await service.findAll('ws-1', { status: 'attention' });
      const sql = qb.andWhere.mock.calls.map((c) => c[0]).join(' | ');
      expect(sql).not.toContain("'pending_install'");
    });

    it('status=attention does not also pin status to a single value', async () => {
      const qb = makeQueryBuilder({ count: 0, many: [] });
      integrationRepo.createQueryBuilder.mockReturnValue(qb);
      await service.findAll('ws-1', { status: 'attention' });
      const sqls = qb.andWhere.mock.calls.map((c) => c[0]) as string[];
      // The single-value branch (used for expired/error/connected filters)
      // would emit `i.status = :s`. Attention's union must not also pin it.
      expect(sqls.some((s) => /i\.status\s*=\s*:s\b/.test(s))).toBe(false);
    });
  });

  // -----------------------------------------------------------------
  // previewTest
  // -----------------------------------------------------------------
  describe('previewTest', () => {
    it('returns success for valid credentials', async () => {
      const result = await service.previewTest({
        serviceType: 'http',
        authType: 'api_key',
        credentials: {
          location: 'header',
          key_name: 'X',
          value: 'v',
        },
      });
      expect(result.success).toBe(true);
    });

    it('returns failure for invalid credentials', async () => {
      const result = await service.previewTest({
        serviceType: 'http',
        authType: 'api_key',
        credentials: { location: 'header' },
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain('required');
    });

    it('delegates mcp service to McpTestConnectionService and exposes capability preview', async () => {
      mcpTestConnection.test.mockResolvedValueOnce({
        success: true,
        message: 'Connection successful',
        capabilities: { tools: {}, resources: {} },
        serverInfo: { name: 's', version: '1' },
        preview: {
          toolCount: 3,
          resourceSupported: true,
          promptSupported: false,
        },
      });
      const result = await service.previewTest({
        serviceType: 'mcp',
        authType: 'bearer_token',
        credentials: {
          url: 'https://mcp.example.com',
          token: 'abc',
        },
      });
      expect(result.success).toBe(true);
      // Critical-2 fix: capability data must be exposed to the registration
      // UI rather than discarded.
      expect(result.capabilities).toEqual({ tools: {}, resources: {} });
      expect(result.serverInfo).toEqual({ name: 's', version: '1' });
      expect(result.preview).toEqual({
        toolCount: 3,
        resourceSupported: true,
        promptSupported: false,
      });
      expect(mcpTestConnection.test).toHaveBeenCalledWith({
        authType: 'bearer_token',
        url: 'https://mcp.example.com',
        token: 'abc',
        defaultHeaders: undefined,
      });
    });

    it('mcp transport failure surfaces MCP_* code in result.code (not message)', async () => {
      mcpTestConnection.test.mockResolvedValueOnce({
        success: false,
        code: 'MCP_AUTH_FAILED',
        message: 'invalid credentials',
      });
      const result = await service.previewTest({
        serviceType: 'mcp',
        authType: 'bearer_token',
        credentials: { url: 'https://mcp.example.com', token: 't' },
      });
      expect(result.success).toBe(false);
      expect(result.code).toBe('MCP_AUTH_FAILED');
      // Message no longer carries an inline `[CODE]` prefix — clients use
      // result.code for branching and result.message for display.
      expect(result.message).toBe('invalid credentials');
    });

    it('falls back to MCP_CONNECT_FAILED when test result omits code', async () => {
      // Defensive fallback — if the MCP layer ever returns a failure without
      // a vocabulary code, the dispatch must still surface a stable code so
      // the UI can branch deterministically.
      mcpTestConnection.test.mockResolvedValueOnce({
        success: false,
        message: 'unspecified failure',
      });
      const result = await service.previewTest({
        serviceType: 'mcp',
        authType: 'none',
        credentials: { url: 'https://mcp.example.com' },
      });
      expect(result.success).toBe(false);
      expect(result.code).toBe('MCP_CONNECT_FAILED');
    });

    it('mcp structural validation runs before transport probe', async () => {
      const result = await service.previewTest({
        serviceType: 'mcp',
        authType: 'bearer_token',
        credentials: { token: 't' }, // missing url
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain('url is required');
      expect(mcpTestConnection.test).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------
  // getActivity — clamping & summary
  // -----------------------------------------------------------------
  describe('getActivity', () => {
    it('clamps limit to [1,100] and days to [1,30]', async () => {
      const itemsQb = makeQueryBuilder({ many: [], raw: [] });
      const summaryQb = makeQueryBuilder({ many: [], raw: [] });
      let call = 0;
      usageLogRepo.createQueryBuilder.mockImplementation(() =>
        call++ === 0 ? itemsQb : summaryQb,
      );
      const result = await service.getActivity('int-1', 'ws-1', 9999, 9999);
      expect(itemsQb.limit).toHaveBeenCalledWith(100);
      expect(result.summary.successRate).toBe(1);
    });

    it('computes summary from raw rows', async () => {
      const itemsQb = makeQueryBuilder({ many: [] });
      const summaryQb = makeQueryBuilder({
        raw: [
          { day: '2026-04-10', total: '10', failed: '2' },
          { day: '2026-04-11', total: '5', failed: '0' },
        ],
      });
      let call = 0;
      usageLogRepo.createQueryBuilder.mockImplementation(() =>
        call++ === 0 ? itemsQb : summaryQb,
      );
      const result = await service.getActivity('int-1', 'ws-1', 20, 7);
      expect(result.summary.totalCalls).toBe(15);
      expect(result.summary.successRate).toBeCloseTo(13 / 15);
      expect(result.summary.dailyCounts).toHaveLength(2);
    });
  });

  // -----------------------------------------------------------------
  // unreadable credentials (graceful degradation)
  // -----------------------------------------------------------------
  describe('unreadable credentials', () => {
    const sentinel = { [UNREADABLE_KEY]: true } as unknown as Record<
      string,
      unknown
    >;

    it('findById surfaces the row with needs_reauth instead of throwing', async () => {
      integrationRepo.findOne.mockResolvedValue(
        makeIntegration({ credentials: sentinel }),
      );
      const result = await service.findById('int-1', 'ws-1');
      expect(result.credentialsStatus).toBe('needs_reauth');
      expect(result.status).toBe('error');
      expect(result.statusReason).toBe('credentials_unreadable');
      expect(result.credentials).toEqual({});
      // Sentinel internals must never leak to the DTO.
      expect(result.credentials[UNREADABLE_KEY]).toBeUndefined();
    });

    it('findAll returns both healthy and broken rows with correct statuses', async () => {
      const healthy = makeIntegration({ id: 'int-ok' });
      const broken = makeIntegration({
        id: 'int-broken',
        credentials: sentinel,
      });
      const qb = makeQueryBuilder({ count: 2, many: [healthy, broken] });
      integrationRepo.createQueryBuilder.mockReturnValue(qb);

      const page = await service.findAll('ws-1', {});
      expect(page.data).toHaveLength(2);
      const ok = page.data.find((d) => d.id === 'int-ok')!;
      const bad = page.data.find((d) => d.id === 'int-broken')!;
      expect(ok.credentialsStatus).toBe('ok');
      expect(bad.credentialsStatus).toBe('needs_reauth');
      expect(bad.status).toBe('error');
      expect(bad.statusReason).toBe('credentials_unreadable');
    });

    it('treats unreadable lastError as null in the DTO', async () => {
      integrationRepo.findOne.mockResolvedValue(
        makeIntegration({
          lastError: sentinel as unknown as Record<string, unknown>,
        }),
      );
      const result = await service.findById('int-1', 'ws-1');
      expect(result.lastError).toBeNull();
    });

    it('getForExecution throws IntegrationCredentialsUnreadableError', async () => {
      integrationRepo.findOne.mockResolvedValue(
        makeIntegration({ credentials: sentinel }),
      );
      await expect(service.getForExecution('int-1', 'ws-1')).rejects.toThrow(
        IntegrationCredentialsUnreadableError,
      );
    });

    it('healthy rows expose credentialsStatus: ok', async () => {
      const result = await service.findById('int-1', 'ws-1');
      expect(result.credentialsStatus).toBe('ok');
    });
  });

  // -----------------------------------------------------------------
  // logUsage
  // -----------------------------------------------------------------
  describe('logUsage', () => {
    it('records success row and updates lastUsedAt', async () => {
      await service.logUsage({
        integrationId: 'int-1',
        nodeExecutionId: 'nex-1',
        workflowId: 'wf-1',
        status: 'success',
        durationMs: 120,
      });
      expect(usageLogRepo.save).toHaveBeenCalled();
      expect(integrationRepo.update).toHaveBeenCalledWith(
        { id: 'int-1' },
        expect.objectContaining({ lastUsedAt: expect.any(Date) }),
      );
    });

    it('records lastError on failure', async () => {
      await service.logUsage({
        integrationId: 'int-1',
        nodeExecutionId: 'nex-1',
        workflowId: 'wf-1',
        status: 'failed',
        durationMs: 800,
        error: { code: 'auth_failed', message: '401' },
      });
      expect(integrationRepo.update).toHaveBeenCalledWith(
        { id: 'int-1' },
        expect.objectContaining({
          lastError: expect.objectContaining({ code: 'auth_failed' }),
        }),
      );
    });

    it('swallows DB failure (non-blocking)', async () => {
      usageLogRepo.save.mockRejectedValue(new Error('boom'));
      await expect(
        service.logUsage({
          integrationId: 'int-1',
          nodeExecutionId: 'nex-1',
          workflowId: 'wf-1',
          status: 'success',
          durationMs: 1,
        }),
      ).resolves.toBeUndefined();
    });

    it('flips status to error(auth_failed) on MCP_AUTH_FAILED', async () => {
      await service.logUsage({
        integrationId: 'int-1',
        nodeExecutionId: 'nex-1',
        workflowId: 'wf-1',
        status: 'failed',
        durationMs: 50,
        error: { code: 'MCP_AUTH_FAILED', message: '401' },
      });
      expect(integrationRepo.update).toHaveBeenCalledWith(
        { id: 'int-1' },
        expect.objectContaining({
          status: 'error',
          statusReason: 'auth_failed',
        }),
      );
    });

    it('does NOT flip status for non-auth failures', async () => {
      await service.logUsage({
        integrationId: 'int-1',
        nodeExecutionId: 'nex-1',
        workflowId: 'wf-1',
        status: 'failed',
        durationMs: 50,
        error: { code: 'MCP_CALL_FAILED', message: 'transport hiccup' },
      });
      // The patch must NOT touch status / statusReason for non-auth failures.
      const patch = (
        integrationRepo.update.mock.calls[0] as unknown[]
      )[1] as Record<string, unknown>;
      expect(patch.status).toBeUndefined();
      expect(patch.statusReason).toBeUndefined();
    });

    it('clamps very long error messages before persisting', async () => {
      const huge = 'x'.repeat(10_000);
      await service.logUsage({
        integrationId: 'int-1',
        nodeExecutionId: 'nex-1',
        workflowId: 'wf-1',
        status: 'failed',
        durationMs: 1,
        error: { code: 'MCP_CALL_FAILED', message: huge },
      });
      const updateCall = integrationRepo.update.mock.calls[0] as unknown[];
      const patch = updateCall[1] as { lastError?: { message?: string } };
      expect(patch.lastError?.message?.length).toBeLessThanOrEqual(2048);
    });

    // -----------------------------------------------------------------
    // INT-US-05 — api identification columns
    // -----------------------------------------------------------------

    it('persists api identification fields when provided', async () => {
      await service.logUsage({
        integrationId: 'int-1',
        nodeExecutionId: 'nex-1',
        workflowId: 'wf-1',
        status: 'success',
        durationMs: 1,
        api: {
          label: 'cafe24.orders.order_list',
          method: 'GET',
          path: '/admin/orders',
        },
      });
      expect(usageLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          apiLabel: 'cafe24.orders.order_list',
          apiMethod: 'GET',
          apiPath: '/admin/orders',
        }),
      );
    });

    it('stores null api fields when api param is omitted', async () => {
      await service.logUsage({
        integrationId: 'int-1',
        nodeExecutionId: 'nex-1',
        workflowId: 'wf-1',
        status: 'success',
        durationMs: 1,
      });
      expect(usageLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          apiLabel: null,
          apiMethod: null,
          apiPath: null,
        }),
      );
    });

    it('truncates over-length api fields with ellipsis suffix', async () => {
      const longLabel = 'cafe24.' + 'x'.repeat(200);
      const longPath = '/' + 'p'.repeat(400);
      await service.logUsage({
        integrationId: 'int-1',
        nodeExecutionId: 'nex-1',
        workflowId: 'wf-1',
        status: 'success',
        durationMs: 1,
        api: { label: longLabel, method: 'OPTIONSXX', path: longPath },
      });
      const created = (usageLogRepo.create.mock.calls[0] as unknown[])[0] as {
        apiLabel: string;
        apiMethod: string;
        apiPath: string;
      };
      expect(created.apiLabel.length).toBe(128);
      expect(created.apiLabel.endsWith('…')).toBe(true);
      expect(created.apiMethod.length).toBe(8);
      expect(created.apiMethod.endsWith('…')).toBe(true);
      expect(created.apiPath.length).toBe(256);
      expect(created.apiPath.endsWith('…')).toBe(true);
    });

    it('coerces empty-string api fields to null', async () => {
      await service.logUsage({
        integrationId: 'int-1',
        nodeExecutionId: 'nex-1',
        workflowId: 'wf-1',
        status: 'success',
        durationMs: 1,
        api: { label: '', method: '', path: '' },
      });
      expect(usageLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          apiLabel: null,
          apiMethod: null,
          apiPath: null,
        }),
      );
    });
  });

  // -----------------------------------------------------------------
  // getServiceCatalog (INT-US-05 / spec/conventions/cafe24-api-metadata.md §7.5)
  // -----------------------------------------------------------------

  describe('getServiceCatalog', () => {
    it('returns cafe24 operations as `cafe24.<resource>.<operation>` keys', () => {
      const result = service.getServiceCatalog('cafe24');
      expect(result.operations.length).toBeGreaterThan(0);
      const sample = result.operations[0];
      expect(sample.key).toMatch(/^cafe24\.[a-z0-9_]+\.[a-z0-9_]+$/i);
      expect(sample.labelKey).toBe(sample.key);
      expect(typeof sample.method).toBe('string');
      expect(typeof sample.path).toBe('string');
    });

    it('returns empty operations[] for non-cafe24 service types', () => {
      for (const type of [
        'http',
        'database',
        'email',
        'mcp',
        'google',
        'github',
        'unknown',
      ]) {
        const result = service.getServiceCatalog(type);
        expect(result).toEqual({ operations: [] });
      }
    });
  });
});

// E-1: 순수 derive 함수 단독 단위 테스트. findById 경로의 시나리오는 위쪽
// `meta.appType` describe 가 cover 하나, 본 블록은 DB / repo / mask 경로를
// 떼고 cafe24 외 serviceType · unreadable credentials 경계 · 잘못된 app_type
// 타입(숫자/빈문자/undefined) 등 부수 입력을 cover 한다.
describe('buildIntegrationMeta (standalone)', () => {
  const cafe24Entity = (
    creds: Record<string, unknown>,
  ): Pick<Integration, 'serviceType' | 'credentials'> => ({
    serviceType: 'cafe24',
    credentials: creds,
  });

  describe('cafe24 + readable credentials', () => {
    it('returns appType=private', () => {
      expect(
        buildIntegrationMeta(
          cafe24Entity({ app_type: 'private', mall_id: 'shop' }),
        ),
      ).toEqual({ appType: 'private' });
    });

    it('returns appType=public', () => {
      expect(
        buildIntegrationMeta(
          cafe24Entity({ app_type: 'public', mall_id: 'shop' }),
        ),
      ).toEqual({ appType: 'public' });
    });
  });

  describe('cafe24 + unexpected credentials', () => {
    it('returns appType=null when app_type is a typo string', () => {
      expect(
        buildIntegrationMeta(cafe24Entity({ app_type: 'PRIVATE' })),
      ).toEqual({ appType: null });
    });

    it('returns appType=null when app_type is an empty string', () => {
      expect(buildIntegrationMeta(cafe24Entity({ app_type: '' }))).toEqual({
        appType: null,
      });
    });

    it('returns appType=null when app_type is missing', () => {
      expect(buildIntegrationMeta(cafe24Entity({ mall_id: 'shop' }))).toEqual({
        appType: null,
      });
    });

    it('returns appType=null when app_type is a number', () => {
      expect(buildIntegrationMeta(cafe24Entity({ app_type: 1 }))).toEqual({
        appType: null,
      });
    });

    it('returns appType=null when app_type is null', () => {
      expect(buildIntegrationMeta(cafe24Entity({ app_type: null }))).toEqual({
        appType: null,
      });
    });
  });

  describe('non-cafe24 serviceType — never leaks app_type', () => {
    it.each([['google'], ['slack'], ['notion'], ['unknown_future_service']])(
      'returns appType=null for %s even if credentials happen to have app_type',
      (serviceType) => {
        expect(
          buildIntegrationMeta({
            serviceType,
            credentials: { app_type: 'private' },
          } as Pick<Integration, 'serviceType' | 'credentials'>),
        ).toEqual({ appType: null });
      },
    );
  });

  describe('credsUnreadable boundary', () => {
    it('returns appType=null when caller signals credsUnreadable=true even with cafe24+private', () => {
      // Caller-supplied override wins — the encrypted blob may decrypt to
      // something later, but right now we cannot peek so meta must not leak.
      expect(
        buildIntegrationMeta(
          cafe24Entity({ app_type: 'private', mall_id: 'shop' }),
          true,
        ),
      ).toEqual({ appType: null });
    });

    it('auto-detects unreadable credentials via sentinel marker', () => {
      expect(
        buildIntegrationMeta(
          cafe24Entity({
            [UNREADABLE_KEY]: true,
          } as unknown as Record<string, unknown>),
        ),
      ).toEqual({ appType: null });
    });

    it('does not over-treat readable creds as unreadable when override is false', () => {
      expect(
        buildIntegrationMeta(
          cafe24Entity({ app_type: 'public', mall_id: 'shop' }),
          false,
        ),
      ).toEqual({ appType: 'public' });
    });
  });
});
