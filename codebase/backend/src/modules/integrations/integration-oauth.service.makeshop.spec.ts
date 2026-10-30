import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { createHash, createHmac } from 'crypto';
import { Workspace } from '../workspaces/entities/workspace.entity';
import {
  IntegrationOAuthService,
  buildMakeshopHmacMessage,
  generatePkcePair,
  type MakeshopInstallQuery,
} from './integration-oauth.service';
import { makeOAuthConfigMock } from './__test-utils__/oauth-config-mock';
import { makeshopPendingLockKey } from './pending-install-reuse';

type Mock = jest.Mock;

/**
 * Mirrors production `buildMakeshopHmacMessage` — drop `hmac`, sort entries by
 * key, preserve raw URL-encoded values. ⚠ Both compute + verify use the same
 * algorithm; the production note (spec §9.7) flags the message construction as
 * an open question to confirm against makeshop docs.
 */
function computeMakeshopHmac(rawQuery: string, secret: string): string {
  const message = buildMakeshopHmacMessage(rawQuery);
  return createHmac('sha256', secret).update(message, 'utf8').digest('base64');
}

function makeRepo(): Record<string, Mock> {
  return {
    create: jest.fn().mockImplementation((data: unknown) => data),
    save: jest
      .fn()
      .mockImplementation((entity: unknown) => Promise.resolve(entity)),
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue(undefined),
    createQueryBuilder: jest.fn(),
  };
}

function buildFakeMakeshopIntegration(
  overrides: Partial<{
    id: string;
    workspaceId: string;
    createdBy: string;
    name: string;
    status: string;
    mallId: string | null;
    clientId: string;
    clientSecret: string;
    scopes: string[];
    installToken: string | null;
    scope: string;
  }> = {},
): Record<string, unknown> {
  const credentials: Record<string, unknown> = {
    client_id: overrides.clientId ?? 'mk-client-id',
    client_secret: overrides.clientSecret ?? 'mk-client-secret',
    scopes: overrides.scopes ?? ['store.read', 'product.write'],
  };
  return {
    id: overrides.id ?? 'mk-integration-1',
    workspaceId: overrides.workspaceId ?? 'ws-1',
    createdBy: overrides.createdBy ?? 'u-1',
    name: overrides.name ?? 'MakeShop',
    status: overrides.status ?? 'pending_install',
    serviceType: 'makeshop',
    mallId: overrides.mallId === undefined ? null : overrides.mallId,
    installToken:
      overrides.installToken === undefined
        ? 'AbCdEfGhIjKlMnOpQrStUv'
        : overrides.installToken,
    installTokenIssuedAt: new Date(),
    statusReason: null,
    lastError: null,
    scope: overrides.scope ?? 'personal',
    credentials,
  };
}

const INSTALL_TOKEN = 'AbCdEfGhIjKlMnOpQrStUv';

function makeInstallQuery(
  shopUid: string,
  secret: string,
  overrides: Partial<{ timestamp: string; action_type: string }> = {},
): MakeshopInstallQuery {
  const timestamp =
    overrides.timestamp ?? String(Math.floor(Date.now() / 1000));
  const actionType = overrides.action_type ?? 'install';
  const rawQuery = `shop_uid=${shopUid}&timestamp=${timestamp}&action_type=${actionType}`;
  const hmac = computeMakeshopHmac(rawQuery, secret);
  return {
    shop_uid: shopUid,
    timestamp,
    hmac,
    action_type: actionType,
    rawQuery: `${rawQuery}&hmac=${encodeURIComponent(hmac)}`,
  };
}

describe('IntegrationOAuthService — MakeShop', () => {
  let service: IntegrationOAuthService;
  let integrationRepo: Record<string, Mock>;
  let stateRepo: Record<string, Mock>;
  let previewRepo: Record<string, Mock>;
  let dataSource: { query: Mock; transaction: Mock };
  /** 트랜잭션 매니저의 `query` — begin 의 advisory lock 이 쓴다. */
  let managerQuery: Mock;
  /** 트랜잭션 매니저의 `findOne` — 쓰기 잠금 도우미의 워크스페이스 · 멤버십 읽기(REQ-INTMGMT-066). */
  let managerFindOne: Mock;
  let oauthMock: ReturnType<typeof makeOAuthConfigMock>;
  // review W2: OAUTH_STUB_MODE 초기값 보존 — suite 진입 전 값을 afterEach 에서 원복.
  let savedOAuthStub: string | undefined;

  beforeEach(() => {
    integrationRepo = makeRepo();
    stateRepo = makeRepo();
    previewRepo = makeRepo();
    managerQuery = jest.fn().mockResolvedValue([]);
    managerFindOne = jest.fn().mockResolvedValue({ id: 'locked-row' });
    dataSource = {
      query: jest.fn().mockResolvedValue([]),
      // 콜백의 반환값을 돌려준다 — begin 의 설치 대기 행 쓰기가 트랜잭션 결과를 쓴다.
      transaction: jest
        .fn()
        .mockImplementation(
          (
            cb: (manager: {
              findOne: Mock;
              getRepository: Mock;
              query: Mock;
            }) => Promise<unknown>,
          ) =>
            cb({
              findOne: managerFindOne,
              getRepository: jest.fn().mockReturnValue(integrationRepo),
              query: managerQuery,
            }),
        ),
    };

    savedOAuthStub = process.env.OAUTH_STUB_MODE;
    process.env.OAUTH_STUB_MODE = 'true';
    // refactor M-6: FRONTEND_URL 등 redirect base 는 `oauth` namespace 로 이전 — config mock 으로 제공.
    oauthMock = makeOAuthConfigMock();

    service = new IntegrationOAuthService(
      integrationRepo as never,
      stateRepo as never,
      previewRepo as never,
      dataSource as never,
      oauthMock.configService as never,
    );
  });

  afterEach(() => {
    if (savedOAuthStub === undefined) delete process.env.OAUTH_STUB_MODE;
    else process.env.OAUTH_STUB_MODE = savedOAuthStub;
    jest.restoreAllMocks();
  });

  // -------------------------------------------------------------------
  // PKCE
  // -------------------------------------------------------------------
  describe('generatePkcePair', () => {
    it('derives challenge = BASE64URL(SHA256(verifier))', () => {
      const { verifier, challenge } = generatePkcePair();
      expect(verifier.length).toBeGreaterThanOrEqual(43);
      const expected = createHash('sha256')
        .update(verifier)
        .digest('base64url');
      expect(challenge).toBe(expected);
      // base64url charset only (no +/=)
      expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('produces a fresh pair each call', () => {
      const a = generatePkcePair();
      const b = generatePkcePair();
      expect(a.verifier).not.toBe(b.verifier);
    });
  });

  // -------------------------------------------------------------------
  // begin
  // -------------------------------------------------------------------
  describe('begin — makeshop', () => {
    it('rejects begin without client_id/client_secret', async () => {
      await expect(
        service.begin({
          workspaceId: 'ws-1',
          userId: 'u-1',
          service: 'makeshop',
          scopes: ['store.read'],
          mode: 'new',
          providerMeta: {},
        }),
      ).rejects.toThrow(BadRequestException);
    });

    // CLE-T-NNENG8 — ShopStore 재설치는 기존 행을 되살리지 않는다(App URL 이 설치 대기가 아닌 행을 상세 화면으로
    // 보낸다). 그래서 거부 문구는 재설치가 아니라 삭제 후 재등록을 안내한다.
    it.each(['reauthorize', 'request_scopes'] as const)(
      'rejects %s mode — 삭제 후 다시 등록하라고 안내한다',
      async (mode) => {
        await expect(
          service.begin({
            workspaceId: 'ws-1',
            userId: 'u-1',
            service: 'makeshop',
            scopes: ['store.read'],
            mode,
            providerMeta: {
              client_id: 'mk-client-id',
              client_secret: 'mk-client-secret',
            },
          }),
        ).rejects.toMatchObject({
          response: {
            code: 'MAKESHOP_USE_SHOPSTORE_INSTALL',
            message: expect.stringMatching(
              /delete the integration and register it again/,
            ),
          },
        });
      },
    );

    it('거부 문구는 기존 행을 되살리는 재설치를 안내하지 않는다', async () => {
      const err = await service
        .begin({
          workspaceId: 'ws-1',
          userId: 'u-1',
          service: 'makeshop',
          scopes: ['store.read'],
          mode: 'reauthorize',
          providerMeta: {
            client_id: 'mk-client-id',
            client_secret: 'mk-client-secret',
          },
        })
        .catch((err_: unknown) => err_);
      expect(err).toBeInstanceOf(BadRequestException);
      const message = (err as BadRequestException).getResponse() as {
        message: string;
      };
      expect(message.message).not.toMatch(/reinstall the app/);
    });

    it('creates a pending_install integration and returns makeshop_pending_install', async () => {
      integrationRepo.save = jest.fn().mockResolvedValue({
        id: 'pending-mk-id',
        installToken: INSTALL_TOKEN,
      });

      const result = await service.begin({
        workspaceId: 'ws-1',
        userId: 'u-1',
        service: 'makeshop',
        scopes: ['store.read', 'product.write'],
        mode: 'new',
        providerMeta: {
          client_id: 'mk-client-id',
          client_secret: 'mk-client-secret',
        },
      });

      expect(result).toMatchObject({
        mode: 'makeshop_pending_install',
        integrationId: 'pending-mk-id',
      });
      const r = result as { appUrl: string; callbackUrl: string };
      expect(r.appUrl).toMatch(
        /\/api\/3rd-party\/makeshop\/install\/[A-Za-z0-9_-]{22}$/,
      );
      expect(r.callbackUrl).toContain('/api/3rd-party/makeshop/callback');

      // pending_install row with confidential creds embedded, no shop_uid yet.
      expect(integrationRepo.save).toHaveBeenCalledTimes(1);
      const created = integrationRepo.create.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(created.status).toBe('pending_install');
      expect(created.serviceType).toBe('makeshop');
      const creds = created.credentials as Record<string, unknown>;
      expect(creds.client_id).toBe('mk-client-id');
      expect(creds.client_secret).toBe('mk-client-secret');
      expect(creds.shop_uid).toBeUndefined();
      // no state row created at begin (created later in install).
      expect(stateRepo.save).not.toHaveBeenCalled();
    });

    it('reuses an existing pending_install row for the same client_id', async () => {
      const existing = buildFakeMakeshopIntegration({
        id: 'existing-mk',
        installToken: 'OldOldOldOldOldOldOldO',
      });
      integrationRepo.find = jest.fn().mockResolvedValue([existing]);
      integrationRepo.save = jest
        .fn()
        .mockImplementation((e: unknown) => Promise.resolve(e));

      const result = await service.begin({
        workspaceId: 'ws-1',
        userId: 'u-1',
        service: 'makeshop',
        scopes: ['store.read'],
        mode: 'new',
        providerMeta: {
          client_id: 'mk-client-id',
          client_secret: 'mk-client-secret',
        },
      });

      // existing install_token preserved (idempotent begin).
      const r = result as { appUrl: string };
      expect(r.appUrl).toContain('OldOldOldOldOldOldOldO');
      expect(integrationRepo.create).not.toHaveBeenCalled();
    });
  });

  // NERV CLE-INT-OAUTH 「설치 대기 행 재사용의 권한」 — Task CLE-T-N7ENKQ.
  describe('begin — makeshop 설치 대기 행 재사용의 권한 (REQ-INTOAUTH-059 · 060 · 062 · 066 · 067)', () => {
    const ISSUED_AT = new Date('2026-10-28T09:00:00.000Z');

    function beginAs(
      requesterRole: string,
      scope?: 'personal' | 'organization',
    ) {
      return service.begin({
        workspaceId: 'ws-1',
        userId: 'u-1',
        service: 'makeshop',
        scopes: ['store.read'],
        mode: 'new',
        scope,
        requesterRole,
        providerMeta: {
          client_id: 'mk-client-id',
          client_secret: 'mk-client-secret',
        },
      });
    }

    function pendingRow(
      id: string,
      scope: 'personal' | 'organization',
      createdBy: string,
      clientId = 'mk-client-id',
    ) {
      return {
        ...buildFakeMakeshopIntegration({ id, scope, createdBy, clientId }),
        installTokenIssuedAt: ISSUED_AT,
      };
    }

    /**
     * 읽기 조회와 잠금 조회(`lock`)에 각각 답한다. 잠금 조회는 요청한 id 만 돌려준다. `lockedRows` 를 주면 잠금 조회가
     * 대신 그 행을 그대로 돌려준다 — 잠금을 기다리는 사이 행이 바뀐 경우를 흉내 낸다.
     */
    function answerFind(
      rows: Record<string, unknown>[],
      lockedRows?: Record<string, unknown>[],
    ) {
      integrationRepo.find = jest
        .fn()
        .mockImplementation(
          (opts: { lock?: unknown; where?: { id?: { value?: string[] } } }) =>
            Promise.resolve(
              opts.lock
                ? (lockedRows ??
                    rows.filter((r) =>
                      (opts.where?.id?.value ?? []).includes(r.id as string),
                    ))
                : rows,
            ),
        );
    }

    // NERV CLE-INT-MANAGE REQ-INTMGMT-066 — Task CLE-T-PS7JQY.
    it('advisory lock 보다 먼저 워크스페이스 → 요청자의 멤버십을 잠근다', async () => {
      answerFind([]);
      await beginAs('editor', 'personal');

      expect(managerFindOne).toHaveBeenNthCalledWith(
        1,
        Workspace,
        expect.objectContaining({
          where: { id: 'ws-1' },
          lock: { mode: 'for_key_share' },
        }),
      );
      expect(managerFindOne).toHaveBeenNthCalledWith(
        2,
        expect.anything(),
        expect.objectContaining({
          where: { workspaceId: 'ws-1', userId: 'u-1' },
          lock: { mode: 'pessimistic_read' },
        }),
      );
      const memberOrder = managerFindOne.mock.invocationCallOrder[1];
      expect(memberOrder).toBeLessThan(
        managerQuery.mock.invocationCallOrder[0],
      );
    });

    it('조직 범위면 워크스페이스만 잠그고 advisory lock 으로 넘어간다', async () => {
      answerFind([]);
      await beginAs('admin', 'organization');

      expect(managerFindOne).toHaveBeenCalledTimes(1);
      expect(managerFindOne).toHaveBeenCalledWith(Workspace, expect.anything());
      expect(managerFindOne.mock.invocationCallOrder[0]).toBeLessThan(
        managerQuery.mock.invocationCallOrder[0],
      );
    });

    it('멤버십이 없으면 403 NOT_A_MEMBER 이고 advisory lock 도 행 읽기도 하지 않는다', async () => {
      answerFind([]);
      managerFindOne.mockImplementation((entity: unknown) =>
        Promise.resolve(entity === Workspace ? { id: 'ws-1' } : null),
      );

      const error = (await beginAs('editor', 'personal').catch(
        (err: unknown) => err,
      )) as ForbiddenException;
      expect(error).toBeInstanceOf(ForbiddenException);
      expect(error.getResponse()).toMatchObject({ code: 'NOT_A_MEMBER' });
      expect(managerQuery).not.toHaveBeenCalled();
      expect(integrationRepo.find).not.toHaveBeenCalled();
      expect(integrationRepo.save).not.toHaveBeenCalled();
    });

    // REQ-INTMGMT-005 — 설치 대기 행을 만드는 것도 생성이다.
    it('설치 대기 행을 만들다 이름 UNIQUE 에 걸리면 409 INTEGRATION_NAME_TAKEN 이다', async () => {
      answerFind([]);
      integrationRepo.save = jest.fn().mockRejectedValue(
        Object.assign(new Error('duplicate key'), {
          driverError: {
            code: '23505',
            constraint: 'integration_workspace_name_unique',
          },
        }),
      );

      const error = (await beginAs('editor').catch(
        (err: unknown) => err,
      )) as ConflictException;
      expect(error).toBeInstanceOf(ConflictException);
      expect(error.getResponse()).toEqual({
        code: 'INTEGRATION_NAME_TAKEN',
        message: 'Integration name is already in use within this workspace',
      });
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    });

    it('이름 UNIQUE 가 아닌 오류는 그대로 던진다', async () => {
      answerFind([]);
      const other = Object.assign(new Error('duplicate key'), {
        code: '23505',
        constraint: 'some_other_unique',
      });
      integrationRepo.save = jest.fn().mockRejectedValue(other);

      await expect(beginAs('editor')).rejects.toBe(other);
    });

    it('행을 고르기 전에 (workspace_id, client_id) advisory lock 을 잡는다', async () => {
      answerFind([]);
      await beginAs('editor');
      expect(managerQuery).toHaveBeenCalledWith(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [makeshopPendingLockKey('ws-1', 'mk-client-id')],
      );
      expect(managerQuery.mock.invocationCallOrder[0]).toBeLessThan(
        integrationRepo.find.mock.invocationCallOrder[0],
      );
    });

    it('advisory lock → 후보 읽기 → FOR UPDATE 잠금 → 저장 순으로 부른다', async () => {
      answerFind([pendingRow('mine', 'personal', 'u-1')]);
      await beginAs('editor');
      const finds = integrationRepo.find.mock.calls as Array<
        [Record<string, unknown>]
      >;
      const readOrder = integrationRepo.find.mock.invocationCallOrder[0];
      const lockIndex = finds.findIndex(([opts]) => opts.lock !== undefined);
      expect(lockIndex).toBe(1);
      const lockOrder =
        integrationRepo.find.mock.invocationCallOrder[lockIndex];
      const advisoryOrder = managerQuery.mock.invocationCallOrder[0];
      const saveOrder = integrationRepo.save.mock.invocationCallOrder[0];
      expect(advisoryOrder).toBeLessThan(readOrder);
      expect(readOrder).toBeLessThan(lockOrder);
      expect(lockOrder).toBeLessThan(saveOrder);
      // 같은 트랜잭션 안이어야 한다 — advisory lock 은 트랜잭션이 끝날 때 풀린다.
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    });

    it('후보가 없으면 FOR UPDATE 잠금 조회를 하지 않고 새 행을 만든다', async () => {
      answerFind([]);
      await beginAs('editor');
      const finds = integrationRepo.find.mock.calls as Array<
        [Record<string, unknown>]
      >;
      expect(finds.some(([opts]) => opts.lock !== undefined)).toBe(false);
      expect(integrationRepo.create).toHaveBeenCalled();
    });

    // 아래 세 케이스의 목은 «잠근 뒤 WHERE 를 다시 평가한 결과» 를 대신 답한다. 그 재평가(READ COMMITTED)는 Postgres 가
    // 하므로 실제 DB 동작은 e2e(`integration-pending-install-reuse.e2e-spec.ts`)가 본다. 여기서는 서비스가 잠근 뒤의
    // 결과로 다시 판정하는지만 본다.
    it('잠근 뒤 설치 대기가 아니게 된 남의 행은 409 가 아니라 새 행을 만든다', async () => {
      // 잠금을 기다리는 동안 다른 요청이 설치를 마치거나 행을 만료시켰다 — 잠금 조회의 WHERE 에서 빠진다.
      answerFind([pendingRow('others', 'personal', 'u-other')], []);
      integrationRepo.save.mockImplementation((entity: unknown) =>
        Promise.resolve({ ...(entity as object), id: 'fresh-id' }),
      );
      const result = (await beginAs('editor')) as {
        integrationId: string;
        scope: string;
      };
      expect(result.integrationId).toBe('fresh-id');
      expect(result.scope).toBe('personal');
      expect(integrationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'pending_install',
          createdBy: 'u-1',
        }),
      );
    });

    it('잠근 뒤 일부 행만 남으면 남은 행으로 다시 판정한다 — 앞선 남의 행이 빠지면 자기 행을 다시 쓴다', async () => {
      answerFind(
        [
          pendingRow('others-older', 'personal', 'u-other'),
          pendingRow('mine-newer', 'personal', 'u-1'),
        ],
        [pendingRow('mine-newer', 'personal', 'u-1')],
      );
      const result = (await beginAs('editor')) as { integrationId: string };
      expect(result.integrationId).toBe('mine-newer');
      expect(integrationRepo.create).not.toHaveBeenCalled();
    });

    it('잠금 조회가 client_id 가 다른 행을 돌려줘도 다시 걸러 새 행을 만든다', async () => {
      // 읽을 때는 같은 client_id 였지만 잠근 뒤에는 다른 client_id 가 된 행.
      answerFind(
        [pendingRow('moved', 'personal', 'u-other')],
        [pendingRow('moved', 'personal', 'u-other', 'changed-client-id')],
      );
      integrationRepo.save.mockImplementation((entity: unknown) =>
        Promise.resolve({ ...(entity as object), id: 'fresh-id' }),
      );
      const result = (await beginAs('editor')) as { integrationId: string };
      expect(result.integrationId).toBe('fresh-id');
    });

    it('후보는 created_at · id 순으로 읽고 다시 쓸 행을 FOR UPDATE 로 잠근다', async () => {
      answerFind([pendingRow('mine', 'personal', 'u-1')]);
      await beginAs('editor');
      const calls = integrationRepo.find.mock.calls as Array<
        [Record<string, unknown>]
      >;
      expect(calls[0][0]).toMatchObject({
        order: { createdAt: 'ASC', id: 'ASC' },
      });
      expect(calls.some(([opts]) => opts.lock !== undefined)).toBe(true);
      expect(calls.find(([opts]) => opts.lock !== undefined)?.[0].lock).toEqual(
        { mode: 'pessimistic_write' },
      );
    });

    it('남의 개인 행 — 409 MAKESHOP_INSTALL_PENDING 이고 설치 기한만 싣는다', async () => {
      answerFind([pendingRow('others', 'personal', 'u-other')]);
      const error = await beginAs('owner').catch((err: unknown) => err);
      expect(error).toBeInstanceOf(ConflictException);
      const body = (error as ConflictException).getResponse() as Record<
        string,
        unknown
      >;
      expect(body.code).toBe('MAKESHOP_INSTALL_PENDING');
      expect(body.details).toEqual({
        pendingInstallExpiresAt: '2026-10-29T09:00:00.000Z',
      });
      expect(JSON.stringify(body)).not.toContain('others');
      expect(JSON.stringify(body)).not.toContain(INSTALL_TOKEN);
      expect(integrationRepo.save).not.toHaveBeenCalled();
    });

    it('남의 행이 앞서도 자기 행을 먼저 골라 다시 쓴다', async () => {
      answerFind([
        pendingRow('others-older', 'personal', 'u-other'),
        pendingRow('mine-newer', 'personal', 'u-1'),
      ]);
      const result = (await beginAs('editor')) as {
        integrationId: string;
        scope: string;
      };
      expect(result.integrationId).toBe('mine-newer');
      expect(result.scope).toBe('personal');
      expect(integrationRepo.create).not.toHaveBeenCalled();
    });

    it('client_id 가 다른 설치 대기 행은 고르지 않는다', async () => {
      answerFind([pendingRow('other-client', 'personal', 'u-other', 'x-id')]);
      integrationRepo.save.mockImplementation((entity: unknown) =>
        Promise.resolve({ ...(entity as object), id: 'fresh-id' }),
      );
      const result = (await beginAs('editor')) as { integrationId: string };
      expect(result.integrationId).toBe('fresh-id');
    });

    it('조직 행 · 편집자 — 403 ADMIN_REQUIRED', async () => {
      answerFind([pendingRow('org', 'organization', 'u-1')]);
      const error = await beginAs('editor').catch((err: unknown) => err);
      expect(error).toBeInstanceOf(ForbiddenException);
      expect(
        ((error as ForbiddenException).getResponse() as { code: string }).code,
      ).toBe('ADMIN_REQUIRED');
      expect(integrationRepo.save).not.toHaveBeenCalled();
    });

    it('조직 행 · 관리자 — 다시 쓰고 응답 scope 는 organization, 소유자는 그대로', async () => {
      answerFind([pendingRow('org', 'organization', 'u-other')]);
      const result = (await beginAs('admin', 'personal')) as {
        integrationId: string;
        scope: string;
      };
      expect(result.integrationId).toBe('org');
      expect(result.scope).toBe('organization');
      const saved = integrationRepo.save.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(saved.createdBy).toBe('u-other');
    });

    it('다시 쓸 행이 없으면 요청한 공개 범위로 새 행을 만들고 응답에 싣는다', async () => {
      answerFind([]);
      const result = (await beginAs('admin', 'organization')) as {
        scope: string;
      };
      expect(result.scope).toBe('organization');
    });
  });

  // -------------------------------------------------------------------
  // handleMakeshopInstall
  // -------------------------------------------------------------------
  describe('handleMakeshopInstall', () => {
    it('rejects stale timestamp (replay window ±5min)', async () => {
      const oldTs = String(Math.floor(Date.now() / 1000) - 10 * 60);
      await expect(
        service.handleMakeshopInstall(INSTALL_TOKEN, {
          shop_uid: 'myshop',
          timestamp: oldTs,
          hmac: 'x',
          rawQuery: `shop_uid=myshop&timestamp=${oldTs}`,
        }),
      ).rejects.toMatchObject({
        response: { code: 'MAKESHOP_INSTALL_REPLAY' },
      });
    });

    it('rejects invalid shop_uid format', async () => {
      const ts = String(Math.floor(Date.now() / 1000));
      await expect(
        service.handleMakeshopInstall(INSTALL_TOKEN, {
          shop_uid: 'bad shop!',
          timestamp: ts,
          hmac: 'x',
          rawQuery: `shop_uid=bad%20shop!&timestamp=${ts}`,
        }),
      ).rejects.toMatchObject({
        response: { code: 'MAKESHOP_INVALID_SHOP_UID' },
      });
    });

    it('returns 404 when install_token matches no row', async () => {
      integrationRepo.findOne = jest.fn().mockResolvedValue(null);
      await expect(
        service.handleMakeshopInstall(
          INSTALL_TOKEN,
          makeInstallQuery('myshop', 'mk-client-secret'),
        ),
      ).rejects.toMatchObject({
        response: { code: 'MAKESHOP_INSTALL_INVALID_TOKEN' },
      });
    });

    it('rejects a forged HMAC (wrong secret)', async () => {
      const row = buildFakeMakeshopIntegration({
        clientSecret: 'real-secret',
      });
      integrationRepo.findOne = jest.fn().mockResolvedValue(row);
      const query = makeInstallQuery('myshop', 'WRONG-secret');
      await expect(
        service.handleMakeshopInstall(INSTALL_TOKEN, query),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('happy path — verifies HMAC, projects shop_uid, returns authorize URL with PKCE + space-separated scopes', async () => {
      const row = buildFakeMakeshopIntegration({
        clientId: 'mk-client-id',
        clientSecret: 'mk-client-secret',
        scopes: ['store.read', 'product.write'],
        mallId: null,
      });
      integrationRepo.findOne = jest.fn().mockResolvedValue(row);
      integrationRepo.find = jest.fn().mockResolvedValue([]); // no connected dup
      integrationRepo.save = jest
        .fn()
        .mockImplementation((e: unknown) => Promise.resolve(e));

      const query = makeInstallQuery('myshop', 'mk-client-secret');
      const url = await service.handleMakeshopInstall(INSTALL_TOKEN, query);

      expect(url).toMatch(/^https:\/\/auth\.makeshop\.com\/oauth\/authorize\?/);
      // OAuth 2.1 — SPACE-separated scopes (NOT cafe24's comma).
      expect(url).toContain('scope=store.read+product.write');
      expect(url).not.toContain('store.read%2Cproduct.write');
      // PKCE S256 present.
      expect(url).toContain('code_challenge_method=S256');
      expect(url).toMatch(/code_challenge=[A-Za-z0-9_-]+/);
      expect(url).toContain('response_type=code');

      // shop_uid projected onto mall_id column + credentials.
      expect(row.mallId).toBe('myshop');
      expect((row.credentials as Record<string, unknown>).shop_uid).toBe(
        'myshop',
      );
      // state row stores code_verifier for the exchange.
      expect(stateRepo.save).toHaveBeenCalledTimes(1);
      const stateRow = stateRepo.create.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      const pm = stateRow.providerMeta as Record<string, unknown>;
      expect(typeof pm.code_verifier).toBe('string');
      expect(pm.shop_uid).toBe('myshop');
      expect(stateRow.provider).toBe('makeshop');
    });

    // M-1 shared install helpers — security-branch coverage for the boilerplate
    // now shared with handleInstall (cafe24) (ai-review W1–W4).
    it('rejects non-numeric timestamp (assertInstallTimestampFresh NaN branch)', async () => {
      await expect(
        service.handleMakeshopInstall(INSTALL_TOKEN, {
          shop_uid: 'myshop',
          timestamp: 'not-a-number',
          hmac: 'x',
          rawQuery: 'shop_uid=myshop&timestamp=not-a-number',
        }),
      ).rejects.toMatchObject({
        response: { code: 'MAKESHOP_INSTALL_REPLAY' },
      });
    });

    it('throws MAKESHOP_INSTALL_REPLAY and keys the nonce on shop_uid when the nonce cache reports a replay', async () => {
      // installNonceCache is an @Optional() ctor dep — inject a mock that
      // reports a replay and assert makeshop passes `shop_uid` as the identifier.
      const isReplay = jest.fn().mockResolvedValue(true);
      const svc = new IntegrationOAuthService(
        integrationRepo as never,
        stateRepo as never,
        previewRepo as never,
        dataSource as never,
        oauthMock.configService as never,
        { isReplay } as never,
      );
      const row = buildFakeMakeshopIntegration({ mallId: null });
      integrationRepo.findOne = jest.fn().mockResolvedValue(row);

      const query = makeInstallQuery('myshop', 'mk-client-secret');
      await expect(
        svc.handleMakeshopInstall(INSTALL_TOKEN, query),
      ).rejects.toMatchObject({
        response: { code: 'MAKESHOP_INSTALL_REPLAY' },
      });
      expect(isReplay).toHaveBeenCalledWith(
        expect.objectContaining({ mallId: 'myshop', hmac: query.hmac }),
      );
      // Replay is rejected before shop_uid projection / OAuthState minting.
      expect(stateRepo.save).not.toHaveBeenCalled();
    });

    it('falls back to http://localhost:3000 for post-install redirect when neither frontendUrl nor appUrl is set', async () => {
      oauthMock.env.frontendUrl = '';
      oauthMock.env.appUrl = '';
      const row = buildFakeMakeshopIntegration({
        id: 'mk-connected',
        status: 'connected',
        mallId: 'myshop',
      });
      integrationRepo.findOne = jest.fn().mockResolvedValue(row);

      const query = makeInstallQuery('myshop', 'mk-client-secret');
      const url = await service.handleMakeshopInstall(INSTALL_TOKEN, query);
      expect(url).toBe('http://localhost:3000/integrations/mk-connected');
    });

    it('strips a trailing slash from the configured frontend URL in post-install redirect (no double slash)', async () => {
      oauthMock.env.frontendUrl = 'https://app.example.com/';
      const row = buildFakeMakeshopIntegration({
        id: 'mk-connected',
        status: 'connected',
        mallId: 'myshop',
      });
      integrationRepo.findOne = jest.fn().mockResolvedValue(row);

      const query = makeInstallQuery('myshop', 'mk-client-secret');
      const url = await service.handleMakeshopInstall(INSTALL_TOKEN, query);
      expect(url).toBe('https://app.example.com/integrations/mk-connected');
    });

    it('persists the reauthorize state with a future expiry, requested scopes, and the PKCE code_verifier (persistReauthorizeState)', async () => {
      const row = buildFakeMakeshopIntegration({
        scopes: ['store.read', 'product.write'],
        mallId: null,
      });
      integrationRepo.findOne = jest.fn().mockResolvedValue(row);
      integrationRepo.find = jest.fn().mockResolvedValue([]);
      integrationRepo.save = jest
        .fn()
        .mockImplementation((e: unknown) => Promise.resolve(e));

      const before = Date.now();
      const query = makeInstallQuery('myshop', 'mk-client-secret');
      await service.handleMakeshopInstall(INSTALL_TOKEN, query);

      const stateRow = stateRepo.create.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(stateRow.serviceType).toBe('makeshop');
      expect(stateRow.requestedScopes).toEqual(['store.read', 'product.write']);
      expect((stateRow.expiresAt as Date).getTime()).toBeGreaterThan(before);
      const pm = stateRow.providerMeta as Record<string, unknown>;
      expect(typeof pm.code_verifier).toBe('string');
      expect((pm.code_verifier as string).length).toBeGreaterThan(0);
    });

    it('returns 409 when a connected makeshop row already owns the shop_uid', async () => {
      const row = buildFakeMakeshopIntegration({ mallId: null });
      const connectedDup = buildFakeMakeshopIntegration({
        id: 'other-connected',
        status: 'connected',
        mallId: 'myshop',
      });
      integrationRepo.findOne = jest.fn().mockResolvedValue(row);
      integrationRepo.find = jest.fn().mockResolvedValue([connectedDup]);

      const query = makeInstallQuery('myshop', 'mk-client-secret');
      const error = await service
        .handleMakeshopInstall(INSTALL_TOKEN, query)
        .catch((err: unknown) => err);
      expect(error).toBeInstanceOf(ConflictException);
      // 겹친 행의 통합 ID 는 싣지 않는다(REQ-INTOAUTH-065).
      expect((error as ConflictException).getResponse()).not.toHaveProperty(
        'integrationId',
      );
    });

    it('routes a connected row to the frontend detail page (post-install navigation)', async () => {
      oauthMock.env.frontendUrl = 'https://app.example.com';
      const row = buildFakeMakeshopIntegration({
        id: 'mk-connected',
        status: 'connected',
        mallId: 'myshop',
      });
      integrationRepo.findOne = jest.fn().mockResolvedValue(row);

      const query = makeInstallQuery('myshop', 'mk-client-secret');
      const url = await service.handleMakeshopInstall(INSTALL_TOKEN, query);
      expect(url).toBe('https://app.example.com/integrations/mk-connected');
    });

    // CLE-T-NNENG8 — ShopStore 에서 앱을 다시 설치해도 설치 대기가 아닌 행은 OAuth 를 다시 타지 않는다. 오류가 된
    // 행도 상세 화면으로 갈 뿐 되살아나지 않으므로 복구 경로는 삭제 후 재등록이다. 재설치 요청 표시도 보지 않는다.
    it.each(['error', 'expired'] as const)(
      'status=%s 행도 ShopStore 재설치로 되살아나지 않는다 — state 를 만들지 않고 상세 화면으로 보낸다',
      async (status) => {
        oauthMock.env.frontendUrl = 'https://app.example.com';
        const row = {
          ...buildFakeMakeshopIntegration({
            id: 'mk-broken',
            status,
            mallId: 'myshop',
          }),
          reinstallRequestedAt: new Date('2026-10-10T00:00:00.000Z'),
        };
        integrationRepo.findOne = jest.fn().mockResolvedValue(row);

        const query = makeInstallQuery('myshop', 'mk-client-secret');
        const url = await service.handleMakeshopInstall(INSTALL_TOKEN, query);
        expect(url).toBe('https://app.example.com/integrations/mk-broken');
        expect(stateRepo.save).not.toHaveBeenCalled();
        expect(integrationRepo.save).not.toHaveBeenCalled();
      },
    );

    // W-3 — V072 통일 인덱스명(`idx_integration_workspace_service_mall`)을 사용하는
    // race-backstop catch 분기 검증. in-memory 사전 체크가 통과한 후 동시 save() 가
    // UNIQUE 위반을 발생시키면 409(MAKESHOP_ALREADY_CONNECTED) 로 변환한다.
    // ALREADY_CONNECTED_BY_SERVICE['makeshop'] 레지스트리 경유 — 에러 코드·메시지를
    // throwIfUniqueViolation 과 공유.
    // **두 표면을 모두 건다.** `pgErrorConstraint()` 는 `err.constraint` 와
    // `err.driverError.constraint` 를 함께 흡수하는데, 이 callsite 테스트는 오랫동안
    // **flat 표면만** 태우고 있었다 — 실전에서 TypeORM 이 실제로 주는 것은 wrap 된 쪽이다
    // (`review/code/2026/09/08/12_53_08` INFO#7). 헬퍼 유닛 테스트(`pg-error.spec.ts`)가
    // 두 표면을 보장해도, **이 호출부가 헬퍼를 쓰는지**는 별개 주장이다.
    const raceErrorSurfaces: ReadonlyArray<[string, () => Error]> = [
      [
        'flat (err.code / err.constraint)',
        () =>
          Object.assign(
            new Error('duplicate key value violates unique constraint'),
            {
              code: '23505',
              constraint: 'idx_integration_workspace_service_mall',
            },
          ),
      ],
      [
        'wrapped (err.driverError.*) — TypeORM 실제 형태',
        () =>
          Object.assign(
            new Error('duplicate key value violates unique constraint'),
            {
              driverError: {
                code: '23505',
                constraint: 'idx_integration_workspace_service_mall',
              },
            },
          ),
      ],
    ];

    it.each(raceErrorSurfaces)(
      'translates idx_integration_workspace_service_mall violation → MAKESHOP_ALREADY_CONNECTED (409) on concurrent save — %s',
      async (_label, makeError) => {
        const row = buildFakeMakeshopIntegration({ mallId: null });
        integrationRepo.findOne = jest.fn().mockResolvedValue(row);
        integrationRepo.find = jest.fn().mockResolvedValue([]); // pre-check: no connected dup
        integrationRepo.save = jest.fn().mockRejectedValueOnce(makeError());

        const query = makeInstallQuery('myshop', 'mk-client-secret');
        const error = await service
          .handleMakeshopInstall(INSTALL_TOKEN, query)
          .catch((err) => err);
        expect((error as { response?: { code?: string } }).response?.code).toBe(
          'MAKESHOP_ALREADY_CONNECTED',
        );
      },
    );

    it('re-throws non-unique-violation errors from the makeshop race-backstop catch', async () => {
      const row = buildFakeMakeshopIntegration({ mallId: null });
      integrationRepo.findOne = jest.fn().mockResolvedValue(row);
      integrationRepo.find = jest.fn().mockResolvedValue([]);
      const otherError = Object.assign(new Error('connection reset'), {
        code: '08006',
      });
      integrationRepo.save = jest.fn().mockRejectedValueOnce(otherError);

      const query = makeInstallQuery('myshop', 'mk-client-secret');
      await expect(
        service.handleMakeshopInstall(INSTALL_TOKEN, query),
      ).rejects.toMatchObject({ message: 'connection reset' });
    });
  });

  // -------------------------------------------------------------------
  // precheckMakeshopShop
  // -------------------------------------------------------------------
  describe('precheckMakeshopShop', () => {
    it('returns no conflict when no makeshop row exists', async () => {
      integrationRepo.find = jest.fn().mockResolvedValue([]);
      const result = await service.precheckMakeshopShop(
        'ws-1',
        'freshshop',
        'u-1',
      );
      expect(result).toEqual({ conflict: false });
    });

    it('returns the most-restrictive (connected) status on conflict', async () => {
      integrationRepo.find = jest.fn().mockResolvedValue([
        buildFakeMakeshopIntegration({
          id: 'pend',
          status: 'pending_install',
          mallId: 'myshop',
        }),
        buildFakeMakeshopIntegration({
          id: 'conn',
          status: 'connected',
          mallId: 'myshop',
        }),
      ]);
      const result = await service.precheckMakeshopShop(
        'ws-1',
        'myshop',
        'u-1',
      );
      expect(result).toMatchObject({
        conflict: true,
        existingIntegrationId: 'conn',
        status: 'connected',
      });
    });

    /**
     * spec 통합 §8 · §9.2 — 충돌은 scope 를 가리지 않고 알리되, 충돌 행이 남의 personal 이면 식별자(id · 이름)를 싣지
     * 않는다. cafe24 precheck 와 같은 행렬이다(`buildFakeMakeshopIntegration` 의 기본값은 u-1 의 personal 이라 요청자를
     * 바꿔 가며 본다).
     */
    it.each([
      ['남의 personal', 'personal', 'u-2', false],
      ['본인 personal', 'personal', 'u-1', true],
      ['남이 만든 organization', 'organization', 'u-2', true],
    ])(
      '충돌 행이 %s 이면 id · 이름 노출 = %s (충돌 · status 는 항상)',
      async (_label, scope, createdBy, exposed) => {
        integrationRepo.find = jest.fn().mockResolvedValue([
          buildFakeMakeshopIntegration({
            id: 'conn',
            name: 'My Shop',
            status: 'connected',
            mallId: 'myshop',
            scope,
            createdBy,
          }),
        ]);
        const result = await service.precheckMakeshopShop(
          'ws-1',
          'myshop',
          'u-1',
        );
        expect(result).toEqual({
          conflict: true,
          status: 'connected',
          ...(exposed
            ? { existingIntegrationId: 'conn', existingName: 'My Shop' }
            : {}),
        });
      },
    );

    it('priority 밖 상태의 fallback 행도 남의 personal 이면 id · 이름을 싣지 않는다', async () => {
      integrationRepo.find = jest.fn().mockResolvedValue([
        buildFakeMakeshopIntegration({
          id: 'odd',
          status: 'initializing',
          mallId: 'myshop',
          scope: 'personal',
          createdBy: 'u-2',
        }),
      ]);
      const result = await service.precheckMakeshopShop(
        'ws-1',
        'myshop',
        'u-1',
      );
      expect(result).toEqual({ conflict: true });
    });

    // REQ-INTOAUTH-068 — 같은 상점을 찾는 곳은 만료 행 제외 술어 하나를 거친다. 만료 행은 `mall_id` 가 비어 DB 조회에
    // 잡히지 않지만, 조회가 돌려줘도 빼는지 본다.
    it('설치 기한이 지나 만료된 행은 충돌로 알리지 않고 다른 만료 행은 알린다', async () => {
      const expired = (id: string, statusReason: string) => ({
        ...buildFakeMakeshopIntegration({
          id,
          status: 'expired',
          mallId: 'myshop',
        }),
        statusReason,
      });
      integrationRepo.find = jest
        .fn()
        .mockResolvedValueOnce([expired('timeout', 'install_timeout')])
        .mockResolvedValueOnce([expired('token', 'token_expired')]);

      await expect(
        service.precheckMakeshopShop('ws-1', 'myshop', 'u-1'),
      ).resolves.toEqual({ conflict: false });
      await expect(
        service.precheckMakeshopShop('ws-1', 'myshop', 'u-1'),
      ).resolves.toMatchObject({ conflict: true, status: 'expired' });
    });
  });

  // -------------------------------------------------------------------
  // 설치 기한이 지나 만료된 행에 늦게 도착한 콜백 (CLE-INT-OAUTH 「만료된 설치 대기 행은 상점 자리를 놓는다」)
  // -------------------------------------------------------------------
  // 되살림 차단 가드는 provider 와 무관한 공용 경로에 있다. MakeShop 은 콜백이 `credentials.shop_uid` 를 `mall_id` 컬럼으로
  // 다시 채우는 분기가 있어 가드가 없으면 만료 때 비운 상점 자리를 다시 차지한다.
  describe('handleCallback — 설치 기한이 지나 만료된 행', () => {
    let getMemberRole: Mock;
    // 기본 서비스는 workspacesService 가 없어 요청자 판정이 먼저 403 으로 거절한다. 편집자를 주입해 가드만이 400 을
    // 만드는 요인이 되게 한다.
    function serviceWithRole(role: string | null): IntegrationOAuthService {
      getMemberRole = jest.fn().mockResolvedValue(role);
      return new IntegrationOAuthService(
        integrationRepo as never,
        stateRepo as never,
        previewRepo as never,
        dataSource as never,
        oauthMock.configService as never,
        undefined,
        { getMemberRole } as never,
      );
    }

    function expiredRow(
      overrides: Record<string, unknown> = {},
    ): Record<string, unknown> {
      return {
        id: 'mk-expired-int',
        workspaceId: 'ws-1',
        serviceType: 'makeshop',
        status: 'expired',
        statusReason: 'install_timeout',
        scope: 'personal',
        createdBy: 'u-1',
        mallId: null,
        credentials: {
          shop_uid: 'myshop',
          client_id: 'mk-cid',
          client_secret: 'mk-secret',
          scopes: ['store.read'],
        },
        installToken: null,
        lastError: null,
        tokenExpiresAt: null,
        lastRotatedAt: null,
        ...overrides,
      };
    }

    function queueLateCallbackState(): void {
      dataSource.query.mockResolvedValueOnce([
        [
          {
            id: 'mk-state-expired',
            state: 'mk-state-expired',
            workspaceId: 'ws-1',
            userId: 'u-1',
            provider: 'makeshop',
            serviceType: 'makeshop',
            mode: 'reauthorize',
            integrationId: 'mk-expired-int',
            requestedScopes: ['store.read'],
            integrationName: 'MakeShop',
            scope: 'personal',
            providerMeta: {
              shop_uid: 'myshop',
              client_id: 'mk-cid',
              client_secret: 'mk-secret',
              code_verifier: 'verifier-xyz',
            },
            expiresAt: new Date(Date.now() + 60_000),
            createdAt: new Date(),
          },
        ],
        1,
      ]);
    }

    const lateCallback = {
      code: 'authz-code',
      state: 'mk-state-expired',
    };

    it('install_timeout 으로 만료된 행 — 요청자 판정을 통과해도 콜백이 행을 되살리지 않고 shop_uid 를 mall_id 로 다시 채우지 않는다', async () => {
      const row = expiredRow();
      integrationRepo.findOne = jest.fn().mockResolvedValue(row);
      queueLateCallbackState();

      await expect(
        serviceWithRole('editor').handleCallback('makeshop', lateCallback),
      ).rejects.toMatchObject({
        response: {
          code: 'INTEGRATION_INSTALL_EXPIRED',
          message: expect.stringContaining('install window') as unknown,
        },
      });

      // 요청자 판정이 통과했으므로 400 은 가드가 만든 것이다.
      expect(getMemberRole).toHaveBeenCalledTimes(1);
      expect(integrationRepo.save).not.toHaveBeenCalled();
      expect(row.status).toBe('expired');
      expect(row.statusReason).toBe('install_timeout');
      expect(row.mallId).toBeNull();
    });

    // 가드는 상점 자리를 놓은 행(`install_timeout`)만 막는다. 이 케이스는 MakeShop 분기가 `shop_uid` 를 다시 채우는 경로가
    // 가드 밖에서는 열려 있다는 대조다.
    it('status=expired 라도 statusReason=auth_failed 이면 가드가 막지 않는다 — 콜백이 평소대로 커밋한다', async () => {
      const row = expiredRow({ statusReason: 'auth_failed' });
      integrationRepo.findOne = jest.fn().mockResolvedValue(row);
      queueLateCallbackState();

      await expect(
        serviceWithRole('editor').handleCallback('makeshop', lateCallback),
      ).resolves.toMatchObject({ integrationId: 'mk-expired-int' });

      expect(integrationRepo.save).toHaveBeenCalledTimes(1);
      expect(row.status).toBe('connected');
      expect(row.mallId).toBe('myshop');
    });
  });

  // -------------------------------------------------------------------
  // token exchange (handleCallback → exchangeCodeForToken)
  // -------------------------------------------------------------------
  describe('token exchange — makeshop', () => {
    it('uses Basic auth + code_verifier (PKCE), parses space-separated scope string, persists shop_uid', async () => {
      delete process.env.OAUTH_STUB_MODE;
      const originalFetch = global.fetch;
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'mk-access',
          refresh_token: 'mk-refresh',
          expires_in: 3600,
          // MakeShop (OAuth 2.1) returns scope as a SPACE-separated string.
          scope: 'store.read product.write',
        }),
        text: async () => '',
      });
      (global as { fetch: jest.Mock }).fetch = fetchMock;

      integrationRepo.findOne = jest.fn().mockResolvedValue({
        id: 'mk-int',
        workspaceId: 'ws-1',
        status: 'pending_install',
        credentials: {
          client_id: 'mk-cid',
          client_secret: 'mk-secret',
          scopes: ['store.read', 'product.write'],
        },
        installToken: 'token',
      });

      const stateRecord = {
        id: 'mk-state',
        state: 'mk-state',
        workspaceId: 'ws-1',
        userId: 'u-1',
        provider: 'makeshop',
        serviceType: 'makeshop',
        mode: 'reauthorize',
        integrationId: 'mk-int',
        requestedScopes: ['store.read', 'product.write'],
        integrationName: 'MakeShop',
        scope: 'personal',
        providerMeta: {
          shop_uid: 'myshop',
          client_id: 'mk-cid',
          client_secret: 'mk-secret',
          code_verifier: 'verifier-xyz',
        },
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(),
      };
      dataSource.query.mockResolvedValueOnce([[stateRecord], 1]);

      try {
        await service.handleCallback('makeshop', {
          code: 'authz-code',
          state: 'mk-state',
        });

        // token endpoint hit with Basic auth + code_verifier in body, NO
        // client creds in body.
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [calledUrl, opts] = fetchMock.mock.calls[0] as [
          string,
          { headers: Record<string, string>; body: string },
        ];
        expect(calledUrl).toBe('https://auth.makeshop.com/oauth/token');
        expect(opts.headers.Authorization).toBe(
          `Basic ${Buffer.from('mk-cid:mk-secret').toString('base64')}`,
        );
        expect(opts.body).toContain('grant_type=authorization_code');
        expect(opts.body).toContain('code_verifier=verifier-xyz');
        expect(opts.body).not.toContain('client_secret=');

        const savedIntegration = integrationRepo.save.mock
          .calls[0][0] as Record<string, unknown>;
        const creds = savedIntegration.credentials as Record<string, unknown>;
        expect(creds.access_token).toBe('mk-access');
        expect(creds.refresh_token).toBe('mk-refresh');
        expect(creds.scopes).toEqual(['store.read', 'product.write']);
        expect(creds.shop_uid).toBe('myshop');
        // code_verifier must NOT be persisted to credentials.
        expect(creds.code_verifier).toBeUndefined();
        expect(savedIntegration.mallId).toBe('myshop');
        expect(savedIntegration.status).toBe('connected');
      } finally {
        global.fetch = originalFetch;
        process.env.OAUTH_STUB_MODE = 'true';
      }
    });
  });
});
