import 'reflect-metadata';
import { PATH_METADATA } from '@nestjs/common/constants';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import type { Integration } from './entities/integration.entity';
import { INTEGRATION_USER_PARAM } from './integration-visibility';
import type { JwtPayload } from '../../common/decorators';

// 실제 외부 접속을 피한다 — 연결 테스터는 각자의 unit spec 이 검증한다.
jest.mock('./http-connection-tester', () => ({
  testHttpConnection: jest
    .fn()
    .mockResolvedValue({ success: true, message: 'Connection successful' }),
}));

/**
 * `spec/2-navigation/4-integration.md` §8 판정 규칙의 **완결성 캐너리** — 판정이 핸들러별 호출이라 새 `:id` 라우트가
 * 판정 없이 들어올 수 있다(라우트별 수동 부착 누락이 이 저장소에서 두 번 났다 — `data-flow/12-workspace.md` Rationale
 * «멤버십 검증은 가드 1곳에서» · «경로 파라미터 워크스페이스도 가드가 본다»).
 *
 * 1. `IntegrationsController` 의 `:id` 경로 핸들러를 **리플렉션으로 전수** 센다 — 아래 표(`BY_ID`)에 없는 라우트가
 *    생기면 실패한다. 새 라우트는 표에 올리는 순간 2 · 3 을 받는다.
 * 2. 각 핸들러를 **실제** `IntegrationsService` 에 물려 남의 personal → 없는 통합과 같은 404 를 본다.
 * 3. 같은 핸들러를 생성자 본인으로 불러 통과를 본다 — 컨트롤러가 요청자가 아닌 값을 넘기면 2 는 우연히 통과해도 3 이 깨진다.
 */

type Mock = jest.Mock;

const CREATOR = 'user-1';
const OTHER = 'user-2';
const userOf = (sub: string) => ({ sub }) as JwtPayload;

function makeIntegration(overrides: Partial<Integration>): Integration {
  return {
    id: 'int-1',
    workspaceId: 'ws-1',
    serviceType: 'http',
    name: 'My API',
    authType: 'api_key',
    credentials: {
      location: 'header',
      key_name: 'X-Api-Key',
      value: 'old-secret',
    },
    scope: 'personal',
    status: 'connected',
    statusReason: null,
    tokenExpiresAt: null,
    lastUsedAt: null,
    lastRotatedAt: null,
    lastError: null,
    createdBy: CREATOR,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Integration;
}
const httpPersonal = () => makeIntegration({});
const googlePersonal = () =>
  makeIntegration({
    serviceType: 'google',
    authType: 'oauth2',
    credentials: { access_token: 'a', scopes: ['s0'] },
  });

function makeQueryBuilder(): Record<string, Mock> {
  const qb: Record<string, Mock> = {};
  for (const m of [
    'where',
    'andWhere',
    'orderBy',
    'addOrderBy',
    'select',
    'addSelect',
    'groupBy',
    'innerJoin',
    'limit',
    'skip',
    'take',
  ]) {
    qb[m] = jest.fn().mockReturnValue(qb);
  }
  qb.getCount = jest.fn().mockResolvedValue(0);
  qb.getMany = jest.fn().mockResolvedValue([]);
  qb.getRawMany = jest.fn().mockResolvedValue([]);
  return qb;
}

describe('IntegrationsController — 소유자 판정 완결성 (§8)', () => {
  let controller: IntegrationsController;
  let integrationRepo: Record<string, Mock>;
  let oauthBegin: Mock;
  let precheckCafe24: Mock;
  let precheckMakeshop: Mock;
  let role: string;

  beforeEach(() => {
    role = 'owner';
    integrationRepo = {
      findOne: jest.fn(),
      save: jest.fn((e: Integration) => Promise.resolve(e)),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      delete: jest.fn().mockResolvedValue({ affected: 1, raw: [] }),
      createQueryBuilder: jest.fn(() => makeQueryBuilder()),
    };
    const repoWithQb = {
      createQueryBuilder: jest.fn(() => makeQueryBuilder()),
    };
    oauthBegin = jest
      .fn()
      .mockResolvedValue({ authUrl: 'https://example.com', state: 'st' });
    precheckCafe24 = jest.fn().mockResolvedValue({ conflict: false });
    precheckMakeshop = jest.fn().mockResolvedValue({ conflict: false });
    const service = new IntegrationsService(
      integrationRepo as never,
      repoWithQb as never, // usageLog
      repoWithQb as never, // node
      { getMemberRole: jest.fn(async () => role) } as never,
      { begin: oauthBegin, consumePreviewToken: jest.fn() } as never,
      { record: jest.fn().mockResolvedValue(undefined) } as never,
      { test: jest.fn() } as never,
      { publish: jest.fn().mockResolvedValue(undefined) } as never,
      {
        transaction: jest.fn(async (cb: (m: unknown) => unknown) =>
          cb({ getRepository: () => integrationRepo }),
        ),
      } as never,
    );
    controller = new IntegrationsController(service, {
      begin: oauthBegin,
      precheckCafe24Mall: precheckCafe24,
      precheckMakeshopShop: precheckMakeshop,
    } as never);
  });

  /**
   * `:id` 경로 핸들러 전부 — 이름 → (그 핸들러가 받는 통합 형태, 호출, 통과의 증거).
   * 새 `:id` 라우트를 추가하면 아래 전수 테스트가 여기에 올릴 때까지 실패한다.
   */
  const BY_ID: Record<
    string,
    {
      fixture: () => Integration;
      call: (c: IntegrationsController, sub: string) => Promise<unknown>;
      passed: () => void;
    }
  > = {
    findOne: {
      fixture: httpPersonal,
      call: (c, sub) => c.findOne('int-1', 'ws-1', userOf(sub)),
      passed: () => undefined,
    },
    listUsages: {
      fixture: httpPersonal,
      call: (c, sub) => c.listUsages('int-1', 'ws-1', userOf(sub)),
      passed: () => undefined,
    },
    activity: {
      fixture: httpPersonal,
      call: (c, sub) => c.activity('int-1', 'ws-1', userOf(sub), {}),
      passed: () => undefined,
    },
    testConnection: {
      fixture: httpPersonal,
      call: (c, sub) => c.testConnection('int-1', 'ws-1', userOf(sub)),
      passed: () => undefined,
    },
    update: {
      fixture: httpPersonal,
      call: (c, sub) =>
        c.update('int-1', 'ws-1', userOf(sub), { name: 'Renamed' }),
      passed: () => expect(integrationRepo.update).toHaveBeenCalledTimes(1),
    },
    rotate: {
      fixture: httpPersonal,
      call: (c, sub) =>
        c.rotate('int-1', 'ws-1', userOf(sub), {
          credentials: { value: 'new-secret' },
        }),
      passed: () => expect(integrationRepo.update).toHaveBeenCalledTimes(1),
    },
    reauthorize: {
      fixture: googlePersonal,
      call: (c, sub) => c.reauthorize('int-1', 'ws-1', userOf(sub)),
      passed: () => expect(oauthBegin).toHaveBeenCalledTimes(1),
    },
    requestScopes: {
      fixture: googlePersonal,
      call: (c, sub) =>
        c.requestScopes('int-1', 'ws-1', userOf(sub), { scopes: ['s1'] }),
      passed: () => expect(oauthBegin).toHaveBeenCalledTimes(1),
    },
    updateScope: {
      fixture: httpPersonal,
      call: (c, sub) =>
        c.updateScope('int-1', 'ws-1', userOf(sub), { scope: 'organization' }),
      passed: () => expect(integrationRepo.update).toHaveBeenCalledTimes(1),
    },
    remove: {
      fixture: httpPersonal,
      call: (c, sub) => c.remove('int-1', 'ws-1', userOf(sub)),
      passed: () => expect(integrationRepo.delete).toHaveBeenCalledTimes(1),
    },
  };

  it('`:id` 경로 핸들러 전부가 판정 표에 있다 (리플렉션 전수)', () => {
    const proto = IntegrationsController.prototype as unknown as Record<
      string,
      unknown
    >;
    const idRoutes = Object.getOwnPropertyNames(proto).filter((name) => {
      if (name === 'constructor' || typeof proto[name] !== 'function') {
        return false;
      }
      const path: unknown = Reflect.getMetadata(PATH_METADATA, proto[name]);
      return typeof path === 'string' && path.split('/').includes(':id');
    });
    // 공허성 가드 — 리플렉션이 아무것도 못 찾으면 아래 비교가 빈 표끼리 같아질 수 있다.
    expect(idRoutes.length).toBeGreaterThan(0);
    expect([...idRoutes].sort()).toEqual(Object.keys(BY_ID).sort());
  });

  it.each(Object.keys(BY_ID))(
    '%s — 남의 personal 은 Owner 에게도 없는 통합과 같은 404',
    async (name) => {
      const { fixture, call } = BY_ID[name];
      integrationRepo.findOne.mockResolvedValue(null);
      const absent: unknown = await call(controller, OTHER).catch(
        (err: unknown) => err,
      );
      integrationRepo.findOne.mockResolvedValue(fixture());
      const hidden: unknown = await call(controller, OTHER).catch(
        (err: unknown) => err,
      );

      const resp = (e: unknown) =>
        (e as { getResponse?: () => unknown }).getResponse?.();
      expect(resp(hidden)).toEqual({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Integration not found',
      });
      expect(resp(hidden)).toEqual(resp(absent));
      expect(oauthBegin).not.toHaveBeenCalled();
    },
  );

  it.each(Object.keys(BY_ID))(
    '%s — 생성자 본인은 통과한다 (컨트롤러가 요청자를 넘긴다)',
    async (name) => {
      const { fixture, call, passed } = BY_ID[name];
      integrationRepo.findOne.mockResolvedValue(fixture());
      await call(controller, CREATOR);
      passed();
    },
  );

  describe('oauth/begin — integrationId 를 지정한 재인증 · scope 추가는 `:id` 경로와 같은 판정', () => {
    const begin = (sub: string, mode: string, integrationId?: string) =>
      controller.oauthBegin('ws-1', userOf(sub), {
        service: 'google',
        scopes: ['s1'],
        mode,
        integrationId,
      } as never);

    it.each(['reauthorize', 'request_scopes', 'request-scopes'])(
      '%s — 남의 personal 이면 404 · OAuth 흐름을 시작하지 않는다',
      async (mode) => {
        integrationRepo.findOne.mockResolvedValue(googlePersonal());
        await expect(begin(OTHER, mode, 'int-1')).rejects.toMatchObject({
          response: { code: 'RESOURCE_NOT_FOUND' },
        });
        expect(oauthBegin).not.toHaveBeenCalled();
      },
    );

    it.each(['editor', 'viewer'])(
      'Organization 통합의 재인증은 %s 에게 403 ADMIN_REQUIRED — 자격 증명 바꿔치기 차단',
      async (r) => {
        role = r;
        integrationRepo.findOne.mockResolvedValue(
          makeIntegration({ ...googlePersonal(), scope: 'organization' }),
        );
        await expect(
          begin(OTHER, 'reauthorize', 'int-1'),
        ).rejects.toMatchObject({ response: { code: 'ADMIN_REQUIRED' } });
        expect(oauthBegin).not.toHaveBeenCalled();
      },
    );

    it('Organization 통합의 scope 추가는 Admin 이면 OAuth 흐름을 시작한다', async () => {
      role = 'admin';
      integrationRepo.findOne.mockResolvedValue(
        makeIntegration({ ...googlePersonal(), scope: 'organization' }),
      );
      await begin(OTHER, 'request_scopes', 'int-1');
      expect(oauthBegin).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'request_scopes',
          integrationId: 'int-1',
        }),
      );
    });

    it("mode 'new' 는 integrationId 를 쓰지 않으므로 판정하지 않는다", async () => {
      await begin(OTHER, 'new', 'int-1');
      expect(integrationRepo.findOne).not.toHaveBeenCalled();
      expect(oauthBegin).toHaveBeenCalledTimes(1);
    });
  });

  it('precheck 두 경로는 요청자를 넘긴다 — 남의 personal 충돌이면 식별자를 뺀다', async () => {
    await controller.cafe24Precheck('ws-1', userOf(OTHER), {
      mallId: 'my-mall',
    } as never);
    await controller.makeshopPrecheck('ws-1', userOf(OTHER), {
      shopUid: 'shop1',
    } as never);
    expect(precheckCafe24).toHaveBeenCalledWith('ws-1', 'my-mall', OTHER);
    expect(precheckMakeshop).toHaveBeenCalledWith('ws-1', 'shop1', OTHER);
  });

  it('목록은 요청자를 넘긴다 — 남의 personal 을 SQL 에서 거른다', async () => {
    const qb = makeQueryBuilder();
    integrationRepo.createQueryBuilder.mockReturnValue(qb);
    await controller.findAll('ws-1', userOf(OTHER), {});
    expect(qb.andWhere).toHaveBeenCalledWith(expect.any(String), {
      [INTEGRATION_USER_PARAM]: OTHER,
    });
  });
});
