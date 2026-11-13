import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { FindOperator } from 'typeorm';
import { Workspace } from '../workspaces/entities/workspace.entity';
import { Integration } from './entities/integration.entity';
import {
  ALREADY_CONNECTED_BY_SERVICE,
  INTEGRATION_NAME_TAKEN,
  STORE_IDENTIFIER_UNIQUE_CONSTRAINT,
  WORKSPACE_NAME_UNIQUE_CONSTRAINT,
} from './integrations.constants';
import {
  makeshopPendingLockKey,
  PENDING_INSTALL_CONFLICT,
} from './pending-install-reuse';
import {
  PendingInstallWriter,
  type PendingInstallRequest,
} from './pending-install-writer';

/*
 * 설치 대기 행 쓰기의 동시성 규칙 — NERV CLE-INT-OAUTH 「설치 대기 행 재사용의 권한」, CLE-INT-MANAGE REQ-INTMGMT-066,
 * Task CLE-T-JDQYT8. 서비스 전체 없이 협력 클래스만 만들어 본다.
 *
 * 트랜잭션 매니저가 돌려주는 `txRepo` 는 이 파일 밖의 어떤 저장소와도 다른 목이다. 잠금 · 후보 읽기 · `create` · `save` 가
 * 트랜잭션 밖 저장소로 새면 `dataSource.getRepository` 나 매니저의 직접 메서드가 불린다. 그 경우를 각 테스트가 함께 본다.
 */

type Row = Record<string, unknown> & { id: string };

const ISSUED_AT = new Date('2026-10-28T09:00:00.000Z');

const uniqueViolation = (constraint: string) =>
  Object.assign(new Error('duplicate key'), { code: '23505', constraint });

function cafe24Pending(overrides: Partial<Row> = {}): Row {
  return {
    id: 'pending-1',
    workspaceId: 'ws-1',
    serviceType: 'cafe24',
    status: 'pending_install',
    statusReason: 'oauth_callback_failed',
    lastError: { code: 'X', message: 'old' },
    scope: 'personal',
    createdBy: 'u-1',
    mallId: 'priv-shop',
    installToken: 'KeptKeptKeptKeptKeptKe',
    installTokenIssuedAt: ISSUED_AT,
    createdAt: ISSUED_AT,
    credentials: {
      mall_id: 'priv-shop',
      app_type: 'private',
      client_id: 'cid',
      client_secret: 'csec',
      scopes: ['mall.read_product'],
    },
    ...overrides,
  };
}

function makeshopPending(overrides: Partial<Row> = {}): Row {
  return {
    id: 'ms-pending-1',
    workspaceId: 'ws-1',
    serviceType: 'makeshop',
    status: 'pending_install',
    statusReason: null,
    lastError: null,
    scope: 'personal',
    createdBy: 'u-1',
    mallId: null,
    installToken: 'MsKeptMsKeptMsKeptMsKe',
    installTokenIssuedAt: ISSUED_AT,
    createdAt: ISSUED_AT,
    credentials: {
      client_id: 'ms-cid',
      client_secret: 'ms-csec',
      scopes: ['shop.read'],
    },
    ...overrides,
  };
}

/**
 * 트랜잭션 한 번의 읽기 · 잠금 · 쓰기를 `order` 한 줄로 모은다. `rows` 는 후보 조회가 돌려줄 행이다. 잠금 조회(`lock` 옵션)는
 * 넘긴 id 가운데 아직 설치 대기인 행만 돌려준다(Postgres 가 잠근 뒤 WHERE 를 다시 평가하는 모습).
 */
function makeHarness(options: { rows?: Row[]; member?: boolean } = {}) {
  const rows = options.rows ?? [];
  const member = options.member ?? true;
  const order: string[] = [];
  const txRepo = {
    find: jest.fn(
      (opts: {
        where: Record<string, unknown> | Array<Record<string, unknown>>;
        lock?: unknown;
      }) => {
        if (opts.lock) {
          order.push('lock');
          const ids = (
            (opts.where as Record<string, unknown>).id as FindOperator<string[]>
          ).value as unknown as string[];
          return Promise.resolve(
            rows.filter(
              (r) => ids.includes(r.id) && r.status === 'pending_install',
            ),
          );
        }
        if (Array.isArray(opts.where)) {
          order.push('find-legacy');
          return Promise.resolve([]);
        }
        order.push('find');
        return Promise.resolve(rows);
      },
    ),
    create: jest.fn((data: Row) => {
      order.push('create');
      return { ...data };
    }),
    save: jest.fn((entity: Row) => {
      order.push('save');
      return Promise.resolve({ ...entity, id: entity.id ?? 'new-pending' });
    }),
  };
  const manager = {
    findOne: jest.fn((entity: unknown) => {
      const isWorkspace = entity === Workspace;
      order.push(isWorkspace ? 'workspace' : 'member');
      return Promise.resolve(isWorkspace || member ? { id: 'x' } : null);
    }),
    query: jest.fn((sql: string, _params?: unknown[]) => {
      order.push(sql.includes('pg_advisory_xact_lock') ? 'advisory' : 'query');
      return Promise.resolve([]);
    }),
    getRepository: jest.fn(() => txRepo),
    // 트랜잭션 저장소를 거치지 않는 쓰기 · 읽기. 불리면 안 된다.
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };
  const dataSource = {
    transaction: jest.fn((cb: (m: typeof manager) => Promise<unknown>) =>
      cb(manager),
    ),
    getRepository: jest.fn(),
  };
  return {
    order,
    txRepo,
    manager,
    dataSource,
    writer: new PendingInstallWriter(dataSource as never),
  };
}

/** 트랜잭션 저장소 밖으로 새지 않았는가. */
function expectOnlyTxRepo(h: ReturnType<typeof makeHarness>): void {
  expect(h.dataSource.getRepository).not.toHaveBeenCalled();
  expect(h.manager.find).not.toHaveBeenCalled();
  expect(h.manager.save).not.toHaveBeenCalled();
  expect(h.manager.create).not.toHaveBeenCalled();
  for (const call of h.manager.getRepository.mock.calls) {
    expect(call).toEqual([Integration]);
  }
}

const cafe24Request = (
  overrides: Partial<PendingInstallRequest> = {},
): PendingInstallRequest => ({
  workspaceId: 'ws-1',
  userId: 'u-1',
  scopes: ['mall.read_product'],
  scope: 'personal',
  requesterRole: 'editor',
  ...overrides,
});

const cafe24Meta = {
  mall_id: 'priv-shop',
  app_type: 'private' as const,
  client_id: 'cid',
  client_secret: 'csec',
};

const makeshopRequest = (
  overrides: Partial<PendingInstallRequest> = {},
): PendingInstallRequest => ({
  workspaceId: 'ws-1',
  userId: 'u-1',
  scopes: ['shop.read'],
  scope: 'personal',
  requesterRole: 'editor',
  ...overrides,
});

const makeshopMeta = { client_id: 'ms-cid', client_secret: 'ms-csec' };

describe('PendingInstallWriter — Cafe24 Private', () => {
  let h: ReturnType<typeof makeHarness>;

  beforeEach(() => {
    h = makeHarness();
  });

  it('다시 쓸 행이 없으면 워크스페이스 → 멤버십을 잠근 뒤 같은 상점을 읽고 새 행을 트랜잭션 저장소로 만든다', async () => {
    const written = await h.writer.writeCafe24Private(
      cafe24Request({ integrationName: '내 상점' }),
      cafe24Meta,
    );

    expect(h.order).toEqual([
      'workspace',
      'member',
      'find',
      'find-legacy',
      'create',
      'save',
    ]);
    expect(h.txRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        createdBy: 'u-1',
        serviceType: 'cafe24',
        authType: 'oauth2',
        name: '내 상점',
        scope: 'personal',
        status: 'pending_install',
        mallId: 'priv-shop',
        credentials: {
          mall_id: 'priv-shop',
          app_type: 'private',
          client_id: 'cid',
          client_secret: 'csec',
          scopes: ['mall.read_product'],
        },
      }),
    );
    expect(written.saved.id).toBe('new-pending');
    expect(written.installToken).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(written.installToken).toBe(written.saved.installToken);
    expectOnlyTxRepo(h);
  });

  it('이름을 주지 않으면 상점 ID 로 이름을 짓고, 공개 범위를 주지 않으면 개인이다', async () => {
    await h.writer.writeCafe24Private(
      cafe24Request({ scope: undefined }),
      cafe24Meta,
    );
    expect(h.txRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'priv-shop (Cafe24 Private)',
        scope: 'personal',
      }),
    );
  });

  it('조직 범위는 워크스페이스만 잠그고 멤버십은 읽지 않는다', async () => {
    await h.writer.writeCafe24Private(
      cafe24Request({ scope: 'organization', requesterRole: 'admin' }),
      cafe24Meta,
    );
    expect(h.order.slice(0, 2)).toEqual(['workspace', 'find']);
    expect(h.order).not.toContain('member');
  });

  it('멤버십이 없으면 403 NOT_A_MEMBER 이고 행을 읽지 않으며 다시 판정하지 않는다', async () => {
    h = makeHarness({ member: false });
    const error = (await h.writer
      .writeCafe24Private(cafe24Request(), cafe24Meta)
      .catch((err: unknown) => err)) as ForbiddenException;
    expect(error).toBeInstanceOf(ForbiddenException);
    expect(error.getResponse()).toMatchObject({ code: 'NOT_A_MEMBER' });
    expect(h.order).toEqual(['workspace', 'member']);
    expect(h.dataSource.transaction).toHaveBeenCalledTimes(1);
  });

  it('자기 설치 대기 행을 FOR UPDATE 로 잠근 뒤 다시 쓴다. 자격 증명이 같으면 설치 토큰과 발급 시각을 그대로 둔다', async () => {
    h = makeHarness({ rows: [cafe24Pending()] });

    const written = await h.writer.writeCafe24Private(
      cafe24Request({ scopes: ['mall.read_order'] }),
      cafe24Meta,
    );

    expect(h.order).toEqual([
      'workspace',
      'member',
      'find',
      'find-legacy',
      'lock',
      'save',
    ]);
    const lockCall = h.txRepo.find.mock.calls.find(([o]) => o.lock);
    expect(lockCall?.[0]).toMatchObject({
      where: { status: 'pending_install' },
      order: { createdAt: 'ASC', id: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
    expect(h.txRepo.create).not.toHaveBeenCalled();
    expect(written.installToken).toBe('KeptKeptKeptKeptKeptKe');
    expect(written.saved).toMatchObject({
      id: 'pending-1',
      installTokenIssuedAt: ISSUED_AT,
      statusReason: null,
      lastError: null,
      scope: 'personal',
      createdBy: 'u-1',
      credentials: expect.objectContaining({ scopes: ['mall.read_order'] }),
    });
    expectOnlyTxRepo(h);
  });

  it('자격 증명이 바뀌면 설치 토큰을 새로 발급한다', async () => {
    h = makeHarness({ rows: [cafe24Pending()] });
    const written = await h.writer.writeCafe24Private(cafe24Request(), {
      ...cafe24Meta,
      client_secret: 'rotated',
    });
    expect(written.installToken).not.toBe('KeptKeptKeptKeptKeptKe');
    expect(written.saved.installTokenIssuedAt).not.toBe(ISSUED_AT);
  });

  it('같은 상점에 연결된 행이 있으면 409 CAFE24_PRIVATE_APP_ALREADY_CONNECTED 이고 잠그거나 쓰지 않는다', async () => {
    h = makeHarness({
      rows: [cafe24Pending({ id: 'connected-1', status: 'connected' })],
    });
    const error = (await h.writer
      .writeCafe24Private(cafe24Request(), cafe24Meta)
      .catch((err: unknown) => err)) as ConflictException;
    expect(error).toBeInstanceOf(ConflictException);
    expect(error.getResponse()).toMatchObject({
      code: 'CAFE24_PRIVATE_APP_ALREADY_CONNECTED',
    });
    // 겹친 행의 통합 ID 는 싣지 않는다(REQ-INTOAUTH-065).
    expect(JSON.stringify(error.getResponse())).not.toContain('connected-1');
    expect(h.order).not.toContain('lock');
    expect(h.txRepo.save).not.toHaveBeenCalled();
  });

  it('남의 개인 설치 대기 행이면 409 CAFE24_PRIVATE_APP_INSTALL_PENDING 이다', async () => {
    h = makeHarness({ rows: [cafe24Pending({ createdBy: 'u-other' })] });
    const error = (await h.writer
      .writeCafe24Private(cafe24Request(), cafe24Meta)
      .catch((err: unknown) => err)) as ConflictException;
    expect(error.getResponse()).toMatchObject({
      code: PENDING_INSTALL_CONFLICT.cafe24.code,
    });
    expect(h.txRepo.save).not.toHaveBeenCalled();
  });

  it('관리자 미만이 조직 설치 대기 행을 만나면 403 ADMIN_REQUIRED 이다. 역할이 없어도 같다', async () => {
    for (const requesterRole of ['editor', null, undefined]) {
      h = makeHarness({ rows: [cafe24Pending({ scope: 'organization' })] });
      const error = (await h.writer
        .writeCafe24Private(cafe24Request({ requesterRole }), cafe24Meta)
        .catch((err: unknown) => err)) as ForbiddenException;
      expect(error).toBeInstanceOf(ForbiddenException);
      expect(error.getResponse()).toMatchObject({ code: 'ADMIN_REQUIRED' });
      expect(h.txRepo.save).not.toHaveBeenCalled();
    }
  });

  describe('동시 INSERT 와 부딪히면 한 번만 다시 판정한다', () => {
    it.each([
      STORE_IDENTIFIER_UNIQUE_CONSTRAINT,
      WORKSPACE_NAME_UNIQUE_CONSTRAINT,
    ])(
      '첫 쓰기가 %s 에 걸리면 새 트랜잭션에서 다시 판정한다',
      async (constraint) => {
        h.txRepo.save.mockRejectedValueOnce(uniqueViolation(constraint));
        const written = await h.writer.writeCafe24Private(
          cafe24Request(),
          cafe24Meta,
        );
        expect(written.saved.id).toBe('new-pending');
        expect(h.dataSource.transaction).toHaveBeenCalledTimes(2);
        // 두 번째 트랜잭션도 잠금부터 다시 한다.
        expect(h.order.filter((step) => step === 'workspace')).toHaveLength(2);
      },
    );

    it('다시 판정해도 상점 식별자 UNIQUE 에 걸리면 서비스별 409 로 바꾼다', async () => {
      h.txRepo.save.mockRejectedValue(
        uniqueViolation(STORE_IDENTIFIER_UNIQUE_CONSTRAINT),
      );
      const error = (await h.writer
        .writeCafe24Private(cafe24Request(), cafe24Meta)
        .catch((err: unknown) => err)) as ConflictException;
      expect(error).toBeInstanceOf(ConflictException);
      expect(error.getResponse()).toEqual({
        code: ALREADY_CONNECTED_BY_SERVICE.cafe24.code,
        message: ALREADY_CONNECTED_BY_SERVICE.cafe24.message,
      });
      expect(h.dataSource.transaction).toHaveBeenCalledTimes(2);
    });

    it('다시 판정해도 이름 UNIQUE 에 걸리면 409 INTEGRATION_NAME_TAKEN 이다', async () => {
      h.txRepo.save
        .mockRejectedValueOnce(
          uniqueViolation(STORE_IDENTIFIER_UNIQUE_CONSTRAINT),
        )
        .mockRejectedValueOnce(
          uniqueViolation(WORKSPACE_NAME_UNIQUE_CONSTRAINT),
        );
      const error = (await h.writer
        .writeCafe24Private(cafe24Request(), cafe24Meta)
        .catch((err: unknown) => err)) as ConflictException;
      expect(error.getResponse()).toEqual({ ...INTEGRATION_NAME_TAKEN });
      expect(h.dataSource.transaction).toHaveBeenCalledTimes(2);
    });

    it('다시 판정한 쓰기의 다른 오류는 그대로 던진다', async () => {
      const other = new Error('connection reset');
      h.txRepo.save
        .mockRejectedValueOnce(
          uniqueViolation(STORE_IDENTIFIER_UNIQUE_CONSTRAINT),
        )
        .mockRejectedValueOnce(other);
      await expect(
        h.writer.writeCafe24Private(cafe24Request(), cafe24Meta),
      ).rejects.toBe(other);
    });

    it('다른 제약의 23505 와 다른 오류는 다시 판정하지 않고 그대로 던진다', async () => {
      const other = uniqueViolation('some_other_unique');
      h.txRepo.save.mockRejectedValueOnce(other);
      await expect(
        h.writer.writeCafe24Private(cafe24Request(), cafe24Meta),
      ).rejects.toBe(other);
      expect(h.dataSource.transaction).toHaveBeenCalledTimes(1);
    });
  });
});

describe('PendingInstallWriter — MakeShop', () => {
  it('워크스페이스 → 멤버십 → advisory lock → 후보 조회 → FOR UPDATE 순으로 잠그고 읽는다', async () => {
    const h = makeHarness({ rows: [makeshopPending()] });

    await h.writer.writeMakeshop(makeshopRequest(), makeshopMeta);

    expect(h.order).toEqual([
      'workspace',
      'member',
      'advisory',
      'find',
      'lock',
      'save',
    ]);
    expect(h.manager.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [makeshopPendingLockKey('ws-1', 'ms-cid')],
    );
    const candidateCall = h.txRepo.find.mock.calls.find(([o]) => !o.lock);
    expect(candidateCall?.[0]).toEqual({
      where: {
        workspaceId: 'ws-1',
        serviceType: 'makeshop',
        status: 'pending_install',
      },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    expectOnlyTxRepo(h);
  });

  it('다시 쓸 행이 없으면 advisory lock 뒤에 새 행을 트랜잭션 저장소로 만든다', async () => {
    const h = makeHarness();
    const written = await h.writer.writeMakeshop(
      makeshopRequest({ scope: 'organization', requesterRole: 'admin' }),
      makeshopMeta,
    );
    expect(h.order).toEqual([
      'workspace',
      'advisory',
      'find',
      'create',
      'save',
    ]);
    expect(h.txRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceType: 'makeshop',
        name: 'MakeShop',
        scope: 'organization',
        status: 'pending_install',
        credentials: {
          client_id: 'ms-cid',
          client_secret: 'ms-csec',
          scopes: ['shop.read'],
        },
      }),
    );
    // shop_uid 는 설치 리다이렉트 전에는 모른다.
    expect(h.txRepo.create.mock.calls[0][0]).not.toHaveProperty('mallId');
    expect(written.installToken).toBe(written.saved.installToken);
    expectOnlyTxRepo(h);
  });

  it('client_secret 이 바뀌어도 설치 토큰과 발급 시각은 그대로 둔다', async () => {
    const h = makeHarness({ rows: [makeshopPending()] });
    const written = await h.writer.writeMakeshop(makeshopRequest(), {
      ...makeshopMeta,
      client_secret: 'rotated',
    });
    expect(written.installToken).toBe('MsKeptMsKeptMsKeptMsKe');
    expect(written.saved).toMatchObject({
      installTokenIssuedAt: ISSUED_AT,
      credentials: expect.objectContaining({ client_secret: 'rotated' }),
    });
  });

  it('잠근 행의 client_id 가 다르면 다시 쓰지 않고 새 행을 만든다', async () => {
    const h = makeHarness({
      rows: [
        makeshopPending({
          credentials: { client_id: 'other', client_secret: 's', scopes: [] },
        }),
      ],
    });
    // 후보 조회는 `client_id` 로 거른다. 잠금이 다른 client_id 의 행을 돌려줘도 다시 거른다.
    h.txRepo.find.mockImplementationOnce(() =>
      Promise.resolve([makeshopPending()]),
    );
    await h.writer.writeMakeshop(makeshopRequest(), makeshopMeta);
    expect(h.txRepo.create).toHaveBeenCalledTimes(1);
  });

  it('남의 개인 설치 대기 행이면 409 MAKESHOP_INSTALL_PENDING 이다', async () => {
    const h = makeHarness({
      rows: [makeshopPending({ createdBy: 'u-other' })],
    });
    const error = (await h.writer
      .writeMakeshop(makeshopRequest(), makeshopMeta)
      .catch((err: unknown) => err)) as ConflictException;
    expect(error.getResponse()).toMatchObject({
      code: PENDING_INSTALL_CONFLICT.makeshop.code,
    });
  });

  it('이름 UNIQUE 에 걸리면 다시 판정하지 않고 409 INTEGRATION_NAME_TAKEN 이다', async () => {
    const h = makeHarness();
    h.txRepo.save.mockRejectedValueOnce(
      uniqueViolation(WORKSPACE_NAME_UNIQUE_CONSTRAINT),
    );
    const error = (await h.writer
      .writeMakeshop(makeshopRequest(), makeshopMeta)
      .catch((err: unknown) => err)) as ConflictException;
    expect(error.getResponse()).toEqual({ ...INTEGRATION_NAME_TAKEN });
    expect(h.dataSource.transaction).toHaveBeenCalledTimes(1);
  });

  it('다른 오류는 그대로 던진다', async () => {
    const h = makeHarness();
    const other = uniqueViolation(STORE_IDENTIFIER_UNIQUE_CONSTRAINT);
    h.txRepo.save.mockRejectedValueOnce(other);
    await expect(
      h.writer.writeMakeshop(makeshopRequest(), makeshopMeta),
    ).rejects.toBe(other);
    expect(h.dataSource.transaction).toHaveBeenCalledTimes(1);
  });
});
