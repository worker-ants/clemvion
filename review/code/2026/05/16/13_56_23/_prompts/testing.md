# 테스트(Testing) Review Payload

본 파일은 orchestrator 가 테스트(Testing) reviewer 용으로 작성한 입력입니다. 다음 코드 변경을 테스트 관점에서 분석한다.
sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
인자에 review.md 로 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.

## 점검 관점 (테스트(Testing))

1. **테스트 존재 여부**: 변경 코드에 대한 테스트 존재·추가 필요성
2. **커버리지 갭**: 테스트로 커버되지 않는 코드 경로
3. **엣지 케이스 테스트**: 경계값·예외 상황·null 처리 테스트 필요 여부
4. **Mock 적절성**: mock/stub 사용 적절성, 실제 동작과의 괴리
5. **테스트 격리**: 테스트 간 의존성 없이 독립 실행 가능한지
6. **테스트 가독성**: 테스트 코드가 명확하고 의도를 잘 표현
7. **회귀 테스트**: 기존 테스트가 변경 후에도 유효한지
8. **테스트 용이성**: 코드가 테스트하기 쉬운 구조인지 (의존성 주입 등)

## 리뷰 대상 파일

### 파일 1: backend/src/modules/integrations/integrations.service.spec.ts
- 변경 유형: Review
- 언어: ts

#### 변경된 코드
```
diff --git a/backend/src/modules/integrations/integrations.service.spec.ts b/backend/src/modules/integrations/integrations.service.spec.ts
index 64515e7e..4d51d70c 100644
--- a/backend/src/modules/integrations/integrations.service.spec.ts
+++ b/backend/src/modules/integrations/integrations.service.spec.ts
@@ -687,7 +687,7 @@ describe('IntegrationsService', () => {
       expect(sql).toContain("'connected'");
       expect(sql).toContain('token_expires_at IS NOT NULL');
       expect(sql).toContain('token_expires_at > NOW()');
-      expect(sql).toContain("7 days");
+      expect(sql).toContain('7 days');
     });
 
     it('status=attention does not include pending_install rows', async () => {

```

#### 전체 파일 컨텍스트
```
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  IntegrationsService,
  IntegrationCredentialsUnreadableError,
} from './integrations.service';
import type { Integration } from './entities/integration.entity';
import { UNREADABLE_KEY } from './services/credentials-transformer';

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
  });
});

```
