import type { LookupAddress } from 'node:dns';
import { lookup } from 'node:dns/promises';
import { DatabaseQueryHandler } from './database-query.handler.js';
import { Logger } from '@nestjs/common';
import {
  assertSafeOutboundHostResolved,
  SSRF_GUARD_FAILED_CLIENT_MESSAGE,
  SsrfBlockedError,
} from '../../../common/utils/ssrf/outbound-guard.js';
import { DB_HOST_BLOCKED_MESSAGE } from './database-connection.js';
import { integrationNotFoundError } from '../../../modules/integrations/integration-visibility.js';
import { ExecutionContext } from '../../core/node-handler.interface.js';
import { createEmptyConversationThread } from '../../../shared/conversation-thread/conversation-thread.types';
import { setEnvForEach, withEnv } from '../../../shared/testing/env';

// 가드는 **실물 그대로** 쓴다(아래 차단 테스트들이 실제 대역 판정을 본다) — `jest.fn` 으로 감싸기만 해 한 테스트에서만
// «판정 아닌 오류» 를 주입한다. `SsrfBlockedError` 도 실물이라 핸들러의 판정 분기가 그대로 동작한다.
jest.mock('../../../common/utils/ssrf/outbound-guard.js', () => {
  const actual = jest.requireActual(
    '../../../common/utils/ssrf/outbound-guard.js',
  );
  return {
    ...actual,
    assertSafeOutboundHostResolved: jest.fn(
      actual.assertSafeOutboundHostResolved,
    ),
  };
});

// DNS 는 가짜로 둔다. 실물 해석 가드는 literal IP · localhost 가 아닌 host(`db.example.com` 등)마다 `lookup` 을 부르고
// 시한이 없다. 그래서 DNS 가 느린 환경에서는 테스트가 jest 시한(5초)을 넘겨 flaky 가 된다(NERV Task `CLE-T-WC482N`).
// 기본값은 공인 주소 하나로 답하게 해 가드를 통과시키고, 해석 결과로 막는 경로는 테스트마다 따로 정한다.
// `outbound-guard.spec.ts` 와 같은 방식이다.
jest.mock('node:dns/promises', () => ({
  lookup: jest.fn(),
}));
// 가드는 `lookup(host, { all: true })` 오버로드만 쓴다 — `jest.mocked(lookup)` 은 단일 주소 오버로드로 잡혀 배열을 거부한다.
const mockedLookup = lookup as unknown as jest.MockedFunction<
  (hostname: string, options: { all: true }) => Promise<LookupAddress[]>
>;
const PUBLIC_ADDRESS: LookupAddress = { address: '93.184.216.34', family: 4 };

const connectMock = jest.fn();
const queryMock = jest.fn();
const releaseMock = jest.fn();
const endMock = jest.fn();
const onMock = jest.fn();
// one-off cancel connection (`new pg.Client()`) — pg_cancel_backend (in-flight cancel)
const pgCancelConnectMock = jest.fn();
const pgCancelQueryMock = jest.fn();
const pgCancelEndMock = jest.fn();

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    connect: () =>
      connectMock().then(() => ({
        query: (...args: unknown[]) => queryMock(...args),
        release: () => releaseMock(),
        processID: 12345, // backend PID — in-flight cancel target
      })),
    end: () => endMock(),
    on: (...args: unknown[]) => onMock(...args),
  })),
  // Cancel uses a one-off Client (isolated from the capped pool).
  Client: jest.fn().mockImplementation(() => ({
    connect: () => pgCancelConnectMock(),
    query: (...args: unknown[]) => pgCancelQueryMock(...args),
    end: () => pgCancelEndMock(),
  })),
}));

const mysqlQueryMock = jest.fn(); // getConnection().query — the actual query
const mysqlReleaseMock = jest.fn();
const mysqlEndMock = jest.fn();
// one-off cancel connection (`createConnection()`) — KILL QUERY (in-flight cancel)
const mysqlCancelQueryMock = jest.fn();
const mysqlCancelEndMock = jest.fn();

jest.mock('mysql2/promise', () => ({
  createPool: jest.fn().mockImplementation(() => ({
    getConnection: () =>
      Promise.resolve({
        query: (...args: unknown[]) => mysqlQueryMock(...args),
        release: () => mysqlReleaseMock(),
        threadId: 42, // connection thread id — KILL QUERY target
      }),
    end: () => mysqlEndMock(),
  })),
  // Cancel uses a one-off connection (isolated from the capped pool).
  // `jest.fn` 으로 두어 취소 연결의 옵션(연결 시점 판정 `stream`)을 단언한다(CLE-T-G0GQVV).
  createConnection: jest.fn(() =>
    Promise.resolve({
      query: (...args: unknown[]) => mysqlCancelQueryMock(...args),
      end: () => mysqlCancelEndMock(),
    }),
  ),
}));

function ctx(): ExecutionContext {
  return {
    executionId: 'exec-1',
    workflowId: 'wf-1',
    nodeExecutionId: 'ne-1',
    variables: { __workspaceId: 'ws-1' },
    nodeOutputCache: {},
    structuredOutputCache: {},
    engineResolvedConfigCache: {},
    conversationThread: createEmptyConversationThread(),
    recursionDepth: 0,
  };
}

/**
 * Typed view of the handler's error-port response. Lets the SQLSTATE /
 * MySQL mapping cases assert without repeating the `as unknown as { ... }`
 * cast inline at every call site.
 */
type ErrorPortOutput = {
  port: string;
  output: {
    error: {
      code: string;
      message: string;
      details?: { driverCode?: string };
    };
  };
};

/**
 * Shared MySQL integration fixture for error-mapping tests. Keeps the
 * driver/ssl/credential shape in one place so future field changes don't
 * have to track every spec call site.
 */
const MYSQL_INTEGRATION_BASE = {
  id: 'int-1',
  name: 'MySql',
  serviceType: 'database',
  status: 'connected',
  credentials: {
    driver: 'mysql' as const,
    host: 'h',
    port: 3306,
    database: 'd',
    username: 'u',
    password: 'p',
    ssl: 'disable' as const,
  },
};

function makeService(
  overrides: {
    integration?: unknown;
    logUsage?: jest.Mock;
  } = {},
) {
  const logUsage = overrides.logUsage ?? jest.fn().mockResolvedValue(undefined);
  const integration = overrides.integration ?? {
    id: 'int-1',
    name: 'Primary PG',
    serviceType: 'database',
    status: 'connected',
    credentials: {
      driver: 'postgres',
      host: 'db.example.com',
      port: 5432,
      database: 'app',
      username: 'u',
      password: 'p',
      ssl: 'require',
    },
  };
  return {
    service: {
      getForExecution: jest.fn().mockResolvedValue(integration),
      logUsage,
    },
    logUsage,
  };
}

// 차단 테스트는 가드가 켜진 상태를 가정한다. 바깥 환경에서 `ALLOW_PRIVATE_HOST_TARGETS` 를 켜 두어도 테스트마다 꺼진 값에서
// 시작하고 끝나면 되돌린다(CLE-T-F4Z845).
setEnvForEach({ ALLOW_PRIVATE_HOST_TARGETS: undefined });

describe('DatabaseQueryHandler', () => {
  beforeEach(() => {
    mockedLookup.mockReset().mockResolvedValue([PUBLIC_ADDRESS]);
    connectMock.mockReset().mockResolvedValue(undefined);
    queryMock.mockReset();
    releaseMock.mockReset();
    endMock.mockReset().mockResolvedValue(undefined);
    onMock.mockReset();
    pgCancelConnectMock.mockReset().mockResolvedValue(undefined);
    pgCancelQueryMock.mockReset().mockResolvedValue({ rows: [] });
    pgCancelEndMock.mockReset().mockResolvedValue(undefined);
    jest.requireMock('pg').Pool.mockClear();
    jest.requireMock('pg').Client.mockClear();
    mysqlQueryMock.mockReset();
    mysqlReleaseMock.mockReset();
    mysqlEndMock.mockReset().mockResolvedValue(undefined);
    mysqlCancelQueryMock.mockReset().mockResolvedValue([[], []]);
    mysqlCancelEndMock.mockReset().mockResolvedValue(undefined);
    jest.requireMock('mysql2/promise').createPool.mockClear();
    jest.requireMock('mysql2/promise').createConnection.mockClear();
  });

  describe('integration cache bus', () => {
    it('registers a pool-invalidator that drops the cached pool on broadcast', () => {
      let registered: ((id: string) => void | Promise<void>) | undefined;
      const bus = {
        register: jest.fn((fn: (id: string) => void | Promise<void>) => {
          registered = fn;
        }),
      };

      const handler = new DatabaseQueryHandler(undefined, bus as never);

      expect(bus.register).toHaveBeenCalledTimes(1);
      const invalidateSpy = jest
        .spyOn(handler, 'invalidatePool')
        .mockResolvedValue(undefined);

      void registered?.('int-1');

      expect(invalidateSpy).toHaveBeenCalledWith('int-1');
    });

    it('constructs without a bus (legacy fixtures) and degrades to local evict', () => {
      expect(() => new DatabaseQueryHandler()).not.toThrow();
    });
  });

  describe('validate', () => {
    const handler = new DatabaseQueryHandler();

    it('requires integrationId and query', () => {
      expect(handler.validate({}).valid).toBe(false);
      expect(
        handler.validate({ integrationId: 'int-1', query: 'SELECT 1' }).valid,
      ).toBe(true);
    });

    it('rejects unknown queryType', () => {
      expect(
        handler.validate({
          integrationId: 'int-1',
          query: 'SELECT 1',
          queryType: 'vacuum',
        }).valid,
      ).toBe(false);
    });

    it('accepts queryType=raw', () => {
      expect(
        handler.validate({
          integrationId: 'int-1',
          query: 'VACUUM ANALYZE',
          queryType: 'raw',
        }).valid,
      ).toBe(true);
    });

    it('accepts string parameters (will be parsed)', () => {
      expect(
        handler.validate({
          integrationId: 'int-1',
          query: 'SELECT $1',
          parameters: '["value"]',
        }).valid,
      ).toBe(true);
    });

    it('rejects object parameters', () => {
      expect(
        handler.validate({
          integrationId: 'int-1',
          query: 'SELECT 1',
          parameters: { x: 1 },
        }).valid,
      ).toBe(false);
    });
  });

  describe('execute', () => {
    it('executes query via pool and releases client', async () => {
      const { service, logUsage } = makeService();
      queryMock.mockResolvedValue({
        rows: [{ id: 1 }, { id: 2 }],
        rowCount: 2,
        fields: [{ name: 'id', dataTypeID: 23 }],
      });
      const handler = new DatabaseQueryHandler(service as never);
      const out = (await handler.execute(
        null,
        {
          integrationId: 'int-1',
          query: 'SELECT id FROM users WHERE age > $1',
          parameters: [18],
        },
        ctx(),
      )) as unknown as {
        config: { query: string };
        output: { rows: unknown[]; rowCount: number };
        meta: { durationMs: number };
        port: string;
      };
      expect(out.port).toBe('success');
      expect(out.output.rowCount).toBe(2);
      expect(out.config.query).toBe('SELECT id FROM users WHERE age > $1');
      expect(out.meta.durationMs).toBeGreaterThanOrEqual(0);
      expect(queryMock).toHaveBeenCalledWith(
        'SELECT id FROM users WHERE age > $1',
        [18],
      );
      expect(releaseMock).toHaveBeenCalled();
      expect(logUsage).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'int-1' }),
        expect.objectContaining({ status: 'success' }),
      );
      await handler.shutdown();
    });

    it('reuses the pool for subsequent calls with the same credentials', async () => {
      const { service } = makeService();
      queryMock.mockResolvedValue({ rows: [], rowCount: 0 });
      const handler = new DatabaseQueryHandler(service as never);
      const config = { integrationId: 'int-1', query: 'SELECT 1' };
      await handler.execute(null, config, ctx());
      await handler.execute(null, config, ctx());
      // Pool constructor called once; connect/release called twice.
      const pg = jest.requireMock('pg');
      expect(pg.Pool).toHaveBeenCalledTimes(1);
      expect(connectMock).toHaveBeenCalledTimes(2);
      expect(releaseMock).toHaveBeenCalledTimes(2);
      await handler.shutdown();
    });

    describe('in-flight cancellation (node-cancellation §2.1)', () => {
      const mysqlIntegration = {
        id: 'int-1',
        name: 'Primary MySQL',
        serviceType: 'database',
        status: 'connected',
        credentials: {
          driver: 'mysql',
          host: 'db.example.com',
          port: 3306,
          database: 'app',
          username: 'u',
          password: 'p',
        },
      };

      it('PG: 진행 중 abort → 별도 연결로 pg_cancel_backend 발행 + AbortError(cancelled)', async () => {
        const { service, logUsage } = makeService();
        const controller = new AbortController();
        // 쿼리 시작 시 외부 abort 가 도착한 것으로 시뮬레이트 → driver 가 57014 로 reject
        queryMock.mockImplementation(() => {
          controller.abort();
          const e = new Error(
            'canceling statement due to user request',
          ) as Error & { code?: string };
          e.code = '57014';
          return Promise.reject(e);
        });
        const handler = new DatabaseQueryHandler(service as never);
        await expect(
          handler.execute(
            null,
            { integrationId: 'int-1', query: 'SELECT pg_sleep(10)' },
            { ...ctx(), abortSignal: controller.signal },
          ),
        ).rejects.toMatchObject({ name: 'AbortError' });
        // 캐시 pool 과 격리된 일회성 연결(new Client)로 backend PID 취소
        expect(pgCancelQueryMock).toHaveBeenCalledWith(
          'SELECT pg_cancel_backend($1)',
          [12345],
        );
        expect(pgCancelEndMock).toHaveBeenCalled(); // 취소 연결 닫힘
        // 취소 연결도 연결 시점 판정(`stream` 팩토리)을 거친다(REQ-DBQ-030, CLE-T-G0GQVV).
        expect(jest.requireMock('pg').Client).toHaveBeenCalledWith(
          expect.objectContaining({ stream: expect.any(Function) }),
        );
        expect(releaseMock).toHaveBeenCalled();
        // CLE-EXEC-CANCEL 규칙 3 — 취소된 호출은 활동 로그를 남기지 않는다.
        expect(logUsage).not.toHaveBeenCalled();
        await handler.shutdown();
      });

      it('MySQL: 진행 중 abort → 별도 연결로 KILL QUERY 발행 + AbortError', async () => {
        const { service, logUsage } = makeService({
          integration: mysqlIntegration,
        });
        const controller = new AbortController();
        mysqlQueryMock.mockImplementation(() => {
          controller.abort();
          const e = new Error('Query execution was interrupted') as Error & {
            code?: string;
          };
          e.code = 'ER_QUERY_INTERRUPTED';
          return Promise.reject(e);
        });
        const handler = new DatabaseQueryHandler(service as never);
        await expect(
          handler.execute(
            null,
            { integrationId: 'int-1', query: 'SELECT SLEEP(10)' },
            { ...ctx(), abortSignal: controller.signal },
          ),
        ).rejects.toMatchObject({ name: 'AbortError' });
        expect(mysqlCancelQueryMock).toHaveBeenCalledWith('KILL QUERY 42');
        // 취소 연결도 연결 시점 판정(`stream` 팩토리)을 거친다(REQ-DBQ-030, CLE-T-G0GQVV).
        expect(
          jest.requireMock('mysql2/promise').createConnection,
        ).toHaveBeenCalledWith(
          expect.objectContaining({ stream: expect.any(Function) }),
        );
        expect(mysqlReleaseMock).toHaveBeenCalled();
        expect(logUsage).not.toHaveBeenCalled();
        await handler.shutdown();
      });

      it('MySQL: 풀을 만들 때 multipleStatements 를 켜지 않는다 (dry-run 판정의 마지막 방어선)', async () => {
        const { service } = makeService({ integration: mysqlIntegration });
        mysqlQueryMock.mockResolvedValue([[], []]);
        const handler = new DatabaseQueryHandler(service as never);
        await handler.execute(
          null,
          { integrationId: 'int-1', query: 'SELECT 1' },
          ctx(),
        );
        const create = jest.requireMock('mysql2/promise').createPool;
        expect(create).toHaveBeenCalled();
        for (const [options] of create.mock.calls) {
          expect(options.multipleStatements ?? false).toBe(false);
        }
        await handler.shutdown();
      });

      it('정상 완료 시 cancel 미발행 + abort 리스너 해제(누수 방지)', async () => {
        const { service } = makeService();
        queryMock.mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 });
        const controller = new AbortController();
        const removeSpy = jest.spyOn(controller.signal, 'removeEventListener');
        const handler = new DatabaseQueryHandler(service as never);
        const out = (await handler.execute(
          null,
          { integrationId: 'int-1', query: 'SELECT 1' },
          { ...ctx(), abortSignal: controller.signal },
        )) as { port: string };
        expect(out.port).toBe('success');
        expect(pgCancelQueryMock).not.toHaveBeenCalled(); // 취소 미발행
        expect(removeSpy).toHaveBeenCalled(); // 리스너 해제됨
        await handler.shutdown();
      });

      it('abortSignal 없으면 취소 배선 no-op (정상 경로 무영향)', async () => {
        const { service } = makeService();
        queryMock.mockResolvedValue({ rows: [], rowCount: 0 });
        const handler = new DatabaseQueryHandler(service as never);
        const out = (await handler.execute(
          null,
          { integrationId: 'int-1', query: 'SELECT 1' },
          ctx(),
        )) as { port: string };
        expect(out.port).toBe('success');
        expect(pgCancelQueryMock).not.toHaveBeenCalled();
        await handler.shutdown();
      });

      it('abort 중이라도 취소와 무관한 실패(비-57014)는 cancelled 오분류 안 함 → error 포트', async () => {
        const { service, logUsage } = makeService();
        const controller = new AbortController();
        queryMock.mockImplementation(() => {
          controller.abort();
          const e = new Error('permission denied') as Error & {
            code?: string;
          };
          e.code = '42501'; // insufficient_privilege — 취소가 아닌 무관한 실패
          return Promise.reject(e);
        });
        const handler = new DatabaseQueryHandler(service as never);
        const out = (await handler.execute(
          null,
          { integrationId: 'int-1', query: 'SELECT 1' },
          { ...ctx(), abortSignal: controller.signal },
        )) as { port: string };
        // AbortError(cancelled) 가 아니라 실제 에러가 error 포트로 매핑돼야 함
        expect(out.port).toBe('error');
        // 취소가 아닌 실패는 그대로 `failed` 활동 로그를 남긴다.
        expect(logUsage).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'int-1' }),
          expect.objectContaining({ status: 'failed' }),
        );
        await handler.shutdown();
      });
    });

    it('parses JSON array string parameters', async () => {
      const { service } = makeService();
      queryMock.mockResolvedValue({ rows: [], rowCount: 0 });
      const handler = new DatabaseQueryHandler(service as never);
      await handler.execute(
        null,
        {
          integrationId: 'int-1',
          query: 'SELECT * FROM t WHERE a = $1',
          parameters: '["hello"]',
        },
        ctx(),
      );
      expect(queryMock).toHaveBeenCalledWith('SELECT * FROM t WHERE a = $1', [
        'hello',
      ]);
      await handler.shutdown();
    });

    it('routes query error to error port and releases the client', async () => {
      const { service, logUsage } = makeService();
      queryMock.mockRejectedValue(new Error('syntax error'));
      const handler = new DatabaseQueryHandler(service as never);
      const out = (await handler.execute(
        null,
        { integrationId: 'int-1', query: 'SELEC 1' },
        ctx(),
      )) as unknown as {
        port: string;
        output: {
          error: {
            code: string;
            message: string;
            details?: { driverCode?: string };
          };
        };
      };
      expect(out.port).toBe('error');
      expect(out.output.error.code).toBe('DB_QUERY_FAILED');
      expect(out.output.error.message).toBe('syntax error');
      // Plain `Error` carries no driver code → `details` omitted (Principle 11)
      expect(out.output.error.details).toBeUndefined();
      expect(releaseMock).toHaveBeenCalled();
      expect(logUsage).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'int-1' }),
        expect.objectContaining({ status: 'failed' }),
      );
      await handler.shutdown();
    });

    // W3 — api field value assertion in logUsage (INT-US-05)
    it('passes api.method (SQL verb) and api.path (driver token) to logUsage on success (INT-US-05)', async () => {
      const { service, logUsage } = makeService();
      queryMock.mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 });
      const handler = new DatabaseQueryHandler(service as never);
      await handler.execute(
        null,
        {
          integrationId: 'int-1',
          query: 'SELECT id FROM users WHERE age > $1',
          parameters: [18],
        },
        ctx(),
      );
      expect(logUsage).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'int-1' }),
        expect.objectContaining({
          status: 'success',
          api: expect.objectContaining({ method: 'SELECT' }),
        }),
      );
      await handler.shutdown();
    });

    it('passes api.method and api.path to logUsage on failure (INT-US-05)', async () => {
      const { service, logUsage } = makeService();
      queryMock.mockRejectedValue(new Error('syntax error'));
      const handler = new DatabaseQueryHandler(service as never);
      await handler.execute(
        null,
        {
          integrationId: 'int-1',
          query: 'INSERT INTO t VALUES ($1)',
          parameters: [1],
        },
        ctx(),
      );
      expect(logUsage).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'int-1' }),
        expect.objectContaining({
          status: 'failed',
          api: expect.objectContaining({ method: 'INSERT' }),
        }),
      );
      await handler.shutdown();
    });

    it('maps PostgreSQL SQLSTATE 23505 (unique violation) to DB_CONSTRAINT_VIOLATION', async () => {
      const { service } = makeService();
      const pgErr = Object.assign(
        new Error(
          'duplicate key value violates unique constraint "users_pkey"',
        ),
        { code: '23505', constraint: 'users_pkey' },
      );
      queryMock.mockRejectedValue(pgErr);
      const handler = new DatabaseQueryHandler(service as never);
      const out = (await handler.execute(
        null,
        {
          integrationId: 'int-1',
          query: 'INSERT INTO users(id) VALUES ($1)',
          parameters: ['u_1'],
        },
        ctx(),
      )) as unknown as ErrorPortOutput;
      expect(out.port).toBe('error');
      expect(out.output.error.code).toBe('DB_CONSTRAINT_VIOLATION');
      expect(out.output.error.details?.driverCode).toBe('23505');
      expect(releaseMock).toHaveBeenCalled();
      await handler.shutdown();
    });

    it('maps PostgreSQL SQLSTATE 23503 (FK violation) to DB_CONSTRAINT_VIOLATION', async () => {
      const { service } = makeService();
      queryMock.mockRejectedValue(
        Object.assign(new Error('foreign key violation'), { code: '23503' }),
      );
      const handler = new DatabaseQueryHandler(service as never);
      const out = (await handler.execute(
        null,
        { integrationId: 'int-1', query: 'INSERT INTO posts ...' },
        ctx(),
      )) as unknown as ErrorPortOutput;
      expect(out.port).toBe('error');
      expect(out.output.error.code).toBe('DB_CONSTRAINT_VIOLATION');
      expect(out.output.error.details?.driverCode).toBe('23503');
      expect(releaseMock).toHaveBeenCalled();
      await handler.shutdown();
    });

    it('maps PostgreSQL SQLSTATE 42501 (permission) to DB_PERMISSION_DENIED', async () => {
      const { service } = makeService();
      queryMock.mockRejectedValue(
        Object.assign(new Error('permission denied for table secret_table'), {
          code: '42501',
        }),
      );
      const handler = new DatabaseQueryHandler(service as never);
      const out = (await handler.execute(
        null,
        { integrationId: 'int-1', query: 'SELECT * FROM secret_table' },
        ctx(),
      )) as unknown as ErrorPortOutput;
      expect(out.port).toBe('error');
      expect(out.output.error.code).toBe('DB_PERMISSION_DENIED');
      expect(out.output.error.details?.driverCode).toBe('42501');
      expect(releaseMock).toHaveBeenCalled();
      await handler.shutdown();
    });

    it('maps PostgreSQL SQLSTATE 42601 (syntax) to DB_QUERY_FAILED with driverCode', async () => {
      const { service } = makeService();
      queryMock.mockRejectedValue(
        Object.assign(new Error('syntax error at or near "SELEC"'), {
          code: '42601',
        }),
      );
      const handler = new DatabaseQueryHandler(service as never);
      const out = (await handler.execute(
        null,
        { integrationId: 'int-1', query: 'SELEC 1' },
        ctx(),
      )) as unknown as ErrorPortOutput;
      expect(out.port).toBe('error');
      expect(out.output.error.code).toBe('DB_QUERY_FAILED');
      expect(out.output.error.details?.driverCode).toBe('42601');
      expect(releaseMock).toHaveBeenCalled();
      await handler.shutdown();
    });

    it('maps PostgreSQL SQLSTATE 08006 (connection_failure) to DB_CONNECTION_ERROR', async () => {
      const { service } = makeService();
      queryMock.mockRejectedValue(
        Object.assign(new Error('terminating connection'), { code: '08006' }),
      );
      const handler = new DatabaseQueryHandler(service as never);
      const out = (await handler.execute(
        null,
        { integrationId: 'int-1', query: 'SELECT 1' },
        ctx(),
      )) as unknown as ErrorPortOutput;
      expect(out.port).toBe('error');
      expect(out.output.error.code).toBe('DB_CONNECTION_ERROR');
      expect(out.output.error.details?.driverCode).toBe('08006');
      expect(releaseMock).toHaveBeenCalled();
      await handler.shutdown();
    });

    it('maps PostgreSQL SQLSTATE 28000 (invalid_authorization) to DB_CONNECTION_ERROR (cross-driver symmetry with mysql ER_ACCESS_DENIED_ERROR)', async () => {
      const { service } = makeService();
      queryMock.mockRejectedValue(
        Object.assign(new Error('invalid authorization'), { code: '28000' }),
      );
      const handler = new DatabaseQueryHandler(service as never);
      const out = (await handler.execute(
        null,
        { integrationId: 'int-1', query: 'SELECT 1' },
        ctx(),
      )) as unknown as ErrorPortOutput;
      expect(out.port).toBe('error');
      expect(out.output.error.code).toBe('DB_CONNECTION_ERROR');
      expect(out.output.error.details?.driverCode).toBe('28000');
      await handler.shutdown();
    });

    it('maps PostgreSQL SQLSTATE 53300 (too_many_connections) to DB_CONNECTION_ERROR', async () => {
      const { service } = makeService();
      queryMock.mockRejectedValue(
        Object.assign(new Error('too many connections for role "u"'), {
          code: '53300',
        }),
      );
      const handler = new DatabaseQueryHandler(service as never);
      const out = (await handler.execute(
        null,
        { integrationId: 'int-1', query: 'SELECT 1' },
        ctx(),
      )) as unknown as ErrorPortOutput;
      expect(out.port).toBe('error');
      expect(out.output.error.code).toBe('DB_CONNECTION_ERROR');
      expect(out.output.error.details?.driverCode).toBe('53300');
      await handler.shutdown();
    });

    it('maps PostgreSQL SQLSTATE 57P01 (admin_shutdown) to DB_CONNECTION_ERROR', async () => {
      const { service } = makeService();
      queryMock.mockRejectedValue(
        Object.assign(
          new Error('terminating connection due to administrator command'),
          { code: '57P01' },
        ),
      );
      const handler = new DatabaseQueryHandler(service as never);
      const out = (await handler.execute(
        null,
        { integrationId: 'int-1', query: 'SELECT 1' },
        ctx(),
      )) as unknown as ErrorPortOutput;
      expect(out.port).toBe('error');
      expect(out.output.error.code).toBe('DB_CONNECTION_ERROR');
      expect(out.output.error.details?.driverCode).toBe('57P01');
      await handler.shutdown();
    });

    it('maps connect-time ECONNRESET to DB_CONNECTION_ERROR', async () => {
      const { service } = makeService();
      // Pool.connect() rejects with a node ErrnoException (`code` is the
      // Node-style errno like ECONNRESET / ETIMEDOUT, not SQLSTATE).
      connectMock.mockRejectedValue(
        Object.assign(new Error('Connection terminated unexpectedly'), {
          code: 'ECONNRESET',
        }),
      );
      const handler = new DatabaseQueryHandler(service as never);
      const out = (await handler.execute(
        null,
        { integrationId: 'int-1', query: 'SELECT 1' },
        ctx(),
      )) as unknown as ErrorPortOutput;
      expect(out.port).toBe('error');
      expect(out.output.error.code).toBe('DB_CONNECTION_ERROR');
      expect(out.output.error.details?.driverCode).toBe('ECONNRESET');
      // connect() rejected before client was acquired → no release expected
      expect(releaseMock).not.toHaveBeenCalled();
      await handler.shutdown();
    });

    // CLE-T-691T4G — 연결할 때 푼 주소의 판정(stream 팩토리)이 막은 연결.
    it('연결 시점 판정이 막은 pg 연결은 DB_HOST_BLOCKED 와 고정 문구로 끝나고 usage 로그에도 주소가 남지 않는다', async () => {
      const { service, logUsage } = makeService();
      connectMock.mockRejectedValue(
        new SsrfBlockedError(
          'hostname "db.example.com" resolved to restricted IP "10.0.0.7" at connect time',
        ),
      );
      const warn = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      const handler = new DatabaseQueryHandler(service as never);
      try {
        const out = (await handler.execute(
          null,
          { integrationId: 'int-1', query: 'SELECT 1' },
          ctx(),
        )) as unknown as ErrorPortOutput;

        expect(out.port).toBe('error');
        expect(out.output.error.code).toBe('DB_HOST_BLOCKED');
        expect(out.output.error.message).toBe(DB_HOST_BLOCKED_MESSAGE);
        expect(JSON.stringify(out.output)).not.toContain('10.0.0.7');
        expect(JSON.stringify(logUsage.mock.calls)).not.toContain('10.0.0.7');
        expect(logUsage).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'int-1' }),
          expect.objectContaining({
            status: 'failed',
            error: expect.objectContaining({ code: 'DB_HOST_BLOCKED' }),
          }),
        );
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('10.0.0.7'));
      } finally {
        warn.mockRestore();
        await handler.shutdown();
      }
    });

    it('mysql2 드라이버가 감싸 온 연결 시점 차단도 DB_HOST_BLOCKED 로 바꾼다', async () => {
      const { service } = makeService({ integration: MYSQL_INTEGRATION_BASE });
      const blocked = new SsrfBlockedError(
        'hostname "db.example.com" resolved to restricted IP "10.0.0.7" at connect time',
      );
      jest
        .requireMock('mysql2/promise')
        .createPool.mockImplementationOnce(() => ({
          getConnection: () =>
            Promise.reject(new Error('connect failed', { cause: blocked })),
          end: () => mysqlEndMock(),
        }));
      const warn = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      const handler = new DatabaseQueryHandler(service as never);
      try {
        const out = (await handler.execute(
          null,
          { integrationId: 'int-1', query: 'SELECT 1' },
          ctx(),
        )) as unknown as ErrorPortOutput;

        expect(out.port).toBe('error');
        expect(out.output.error.code).toBe('DB_HOST_BLOCKED');
        expect(out.output.error.message).toBe(DB_HOST_BLOCKED_MESSAGE);
      } finally {
        warn.mockRestore();
        await handler.shutdown();
      }
    });

    it('풀 옵션에 연결 시점 판정 stream 팩토리를 싣는다(pg · mysql2)', async () => {
      queryMock.mockResolvedValue({ rows: [], rowCount: 0, fields: [] });
      mysqlQueryMock.mockResolvedValue([[], []]);
      const pgHandler = new DatabaseQueryHandler(
        makeService().service as never,
      );
      const mysqlHandler = new DatabaseQueryHandler(
        makeService({ integration: MYSQL_INTEGRATION_BASE }).service as never,
      );
      try {
        await pgHandler.execute(
          null,
          { integrationId: 'int-1', query: 'SELECT 1' },
          ctx(),
        );
        await mysqlHandler.execute(
          null,
          { integrationId: 'int-1', query: 'SELECT 1' },
          ctx(),
        );

        expect(jest.requireMock('pg').Pool).toHaveBeenCalledWith(
          expect.objectContaining({ stream: expect.any(Function) }),
        );
        expect(
          jest.requireMock('mysql2/promise').createPool,
        ).toHaveBeenCalledWith(
          expect.objectContaining({ stream: expect.any(Function) }),
        );
      } finally {
        await pgHandler.shutdown();
        await mysqlHandler.shutdown();
      }
    });

    it('sanitizes secret-looking fragments in driver error messages (spec §5.3 / §6.2)', async () => {
      const { service } = makeService();
      // Drivers occasionally embed credential-flavoured fragments — the
      // envelope must mask them via `sanitizeMessage` before exposing.
      queryMock.mockRejectedValue(
        Object.assign(
          new Error(
            'authentication failed: password=hunter2; Bearer abcdefghijklmnop',
          ),
          { code: '28P01' },
        ),
      );
      const handler = new DatabaseQueryHandler(service as never);
      const out = (await handler.execute(
        null,
        { integrationId: 'int-1', query: 'SELECT 1' },
        ctx(),
      )) as unknown as ErrorPortOutput;
      expect(out.port).toBe('error');
      // 28P01 is class 28 → connection (cross-driver symmetry)
      expect(out.output.error.code).toBe('DB_CONNECTION_ERROR');
      expect(out.output.error.message).not.toContain('hunter2');
      expect(out.output.error.message).toContain('password=***');
      expect(out.output.error.message).toContain('Bearer ***');
      await handler.shutdown();
    });

    it('executes MySQL SELECT via mysql2 pool with $N → ? conversion', async () => {
      const { service } = makeService({
        integration: {
          ...MYSQL_INTEGRATION_BASE,
          credentials: {
            ...MYSQL_INTEGRATION_BASE.credentials,
            ssl: 'require' as const,
          },
        },
      });
      mysqlQueryMock.mockResolvedValue([
        [{ id: 7 }],
        [{ name: 'id', columnType: 3 }],
      ]);
      const handler = new DatabaseQueryHandler(service as never);
      const out = (await handler.execute(
        null,
        {
          integrationId: 'int-1',
          query: 'SELECT id FROM t WHERE x = $1',
          parameters: ['v'],
        },
        ctx(),
      )) as unknown as {
        port: string;
        output: { rows: unknown[]; rowCount: number; fields: unknown[] };
      };
      expect(out.port).toBe('success');
      expect(out.output.rowCount).toBe(1);
      expect(mysqlQueryMock).toHaveBeenCalledWith(
        'SELECT id FROM t WHERE x = ?',
        ['v'],
      );
      await handler.shutdown();
    });

    // `$N` 은 `parameters[N-1]` 이다. 등장 순서가 번호와 달라도 번호대로 바인딩한다(REQ-DBQ-003 · 007, CLE-T-6BV9VP).
    it('binds MySQL $N by number, not by order of appearance', async () => {
      const { service } = makeService({ integration: MYSQL_INTEGRATION_BASE });
      mysqlQueryMock.mockResolvedValue([[], []]);
      const handler = new DatabaseQueryHandler(service as never);
      const out = (await handler.execute(
        null,
        {
          integrationId: 'int-1',
          query: "SELECT * FROM t WHERE b = $2 AND note <> '$1' AND a = $1",
          parameters: ['first', 'second'],
        },
        ctx(),
      )) as unknown as { port: string };
      expect(out.port).toBe('success');
      expect(mysqlQueryMock).toHaveBeenCalledWith(
        "SELECT * FROM t WHERE b = ? AND note <> '$1' AND a = ?",
        ['second', 'first'],
      );
      await handler.shutdown();
    });

    it('routes a MySQL $N beyond the parameters array to INVALID_PARAMETERS without querying', async () => {
      const { service, logUsage } = makeService({
        integration: MYSQL_INTEGRATION_BASE,
      });
      const handler = new DatabaseQueryHandler(service as never);
      const out = (await handler.execute(
        null,
        {
          integrationId: 'int-1',
          query: 'SELECT * FROM t WHERE a = $1 AND b = $3',
          parameters: ['a', 'b'],
        },
        ctx(),
      )) as unknown as ErrorPortOutput;
      expect(out.port).toBe('error');
      expect(out.output.error.code).toBe('INVALID_PARAMETERS');
      expect(out.output.error.message).toContain('$3');
      expect(mysqlQueryMock).not.toHaveBeenCalled();
      // 통합을 얻은 뒤의 실패라 활동 로그를 남긴다.
      expect(logUsage).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'int-1' }),
        expect.objectContaining({ status: 'failed' }),
      );
      await handler.shutdown();
    });

    it('leaves the PostgreSQL query and parameters untouched', async () => {
      const { service } = makeService();
      queryMock.mockResolvedValue({ rows: [], rowCount: 0 });
      const handler = new DatabaseQueryHandler(service as never);
      await handler.execute(
        null,
        {
          integrationId: 'int-1',
          query: 'SELECT * FROM t WHERE b = $2 AND a = $1',
          parameters: ['first', 'second'],
        },
        ctx(),
      );
      expect(queryMock).toHaveBeenCalledWith(
        'SELECT * FROM t WHERE b = $2 AND a = $1',
        ['first', 'second'],
      );
      await handler.shutdown();
    });

    // 설정 에코는 평가 전 원본을 싣는다. 배열 · JSON 문자열 · 표현식 템플릿 어느 쪽이든 그대로다([노드 출력 규약](CLE-NODE-OUTPUT)
    // Principle 7). 실행에 쓴 값(평가 · 파싱한 배열)이 아니다(CLE-T-6BV9VP).
    it.each<[string, unknown]>([
      ['array', [18, 'x']],
      ['JSON array string', '[18, "x"]'],
      ['expression template', '{{ $json.ids }}'],
    ])(
      'echoes config.parameters as the raw %s',
      async (_label, rawParameters) => {
        const { service } = makeService();
        queryMock.mockResolvedValue({ rows: [], rowCount: 0 });
        const handler = new DatabaseQueryHandler(service as never);
        const rawConfig = {
          integrationId: 'int-1',
          query: 'SELECT $1, $2',
          parameters: rawParameters,
        };
        const out = (await handler.execute(
          null,
          { ...rawConfig, parameters: [18, 'x'] },
          { ...ctx(), rawConfig },
        )) as unknown as { config: { parameters: unknown } };
        expect(out.config.parameters).toBe(rawParameters);
        await handler.shutdown();
      },
    );

    it('normalizes MySQL INSERT ResultSetHeader to rowCount/insertId', async () => {
      const { service } = makeService({ integration: MYSQL_INTEGRATION_BASE });
      mysqlQueryMock.mockResolvedValue([
        { affectedRows: 2, insertId: 99 },
        undefined,
      ]);
      const handler = new DatabaseQueryHandler(service as never);
      const out = (await handler.execute(
        null,
        {
          integrationId: 'int-1',
          query: 'INSERT INTO t (a) VALUES (?)',
          parameters: [1],
          queryType: 'insert',
        },
        ctx(),
      )) as unknown as {
        port: string;
        output: { rows: unknown[]; rowCount: number; insertId: number };
      };
      expect(out.port).toBe('success');
      expect(out.output.rowCount).toBe(2);
      expect(out.output.insertId).toBe(99);
      expect(out.output.rows).toEqual([]);
      await handler.shutdown();
    });

    it('routes MySQL query error to error port', async () => {
      const { service } = makeService({ integration: MYSQL_INTEGRATION_BASE });
      mysqlQueryMock.mockRejectedValue(new Error('ER_PARSE_ERROR'));
      const handler = new DatabaseQueryHandler(service as never);
      const out = (await handler.execute(
        null,
        { integrationId: 'int-1', query: 'SELEC 1' },
        ctx(),
      )) as unknown as {
        port: string;
        output: { error: { code: string; message: string } };
      };
      expect(out.port).toBe('error');
      expect(out.output.error.code).toBe('DB_QUERY_FAILED');
      expect(out.output.error.message).toBe('ER_PARSE_ERROR');
      await handler.shutdown();
    });

    it('maps MySQL ER_DUP_ENTRY to DB_CONSTRAINT_VIOLATION', async () => {
      const { service } = makeService({ integration: MYSQL_INTEGRATION_BASE });
      mysqlQueryMock.mockRejectedValue(
        Object.assign(new Error("Duplicate entry 'u_1' for key 'PRIMARY'"), {
          code: 'ER_DUP_ENTRY',
          errno: 1062,
          sqlState: '23000',
        }),
      );
      const handler = new DatabaseQueryHandler(service as never);
      const out = (await handler.execute(
        null,
        { integrationId: 'int-1', query: 'INSERT ...' },
        ctx(),
      )) as unknown as ErrorPortOutput;
      expect(out.port).toBe('error');
      expect(out.output.error.code).toBe('DB_CONSTRAINT_VIOLATION');
      expect(out.output.error.details?.driverCode).toBe('ER_DUP_ENTRY');
      await handler.shutdown();
    });

    it('maps MySQL PROTOCOL_CONNECTION_LOST to DB_CONNECTION_ERROR', async () => {
      const { service } = makeService({ integration: MYSQL_INTEGRATION_BASE });
      mysqlQueryMock.mockRejectedValue(
        Object.assign(new Error('Connection lost'), {
          code: 'PROTOCOL_CONNECTION_LOST',
        }),
      );
      const handler = new DatabaseQueryHandler(service as never);
      const out = (await handler.execute(
        null,
        { integrationId: 'int-1', query: 'SELECT 1' },
        ctx(),
      )) as unknown as ErrorPortOutput;
      expect(out.port).toBe('error');
      expect(out.output.error.code).toBe('DB_CONNECTION_ERROR');
      expect(out.output.error.details?.driverCode).toBe(
        'PROTOCOL_CONNECTION_LOST',
      );
      await handler.shutdown();
    });

    it('maps MySQL ER_TABLEACCESS_DENIED_ERROR to DB_PERMISSION_DENIED', async () => {
      const { service } = makeService({ integration: MYSQL_INTEGRATION_BASE });
      mysqlQueryMock.mockRejectedValue(
        Object.assign(
          new Error("SELECT command denied to user 'u'@'h' for table 'secret'"),
          { code: 'ER_TABLEACCESS_DENIED_ERROR' },
        ),
      );
      const handler = new DatabaseQueryHandler(service as never);
      const out = (await handler.execute(
        null,
        { integrationId: 'int-1', query: 'SELECT * FROM secret' },
        ctx(),
      )) as unknown as ErrorPortOutput;
      expect(out.port).toBe('error');
      expect(out.output.error.code).toBe('DB_PERMISSION_DENIED');
      expect(out.output.error.details?.driverCode).toBe(
        'ER_TABLEACCESS_DENIED_ERROR',
      );
      await handler.shutdown();
    });

    it('maps MySQL ER_ACCESS_DENIED_ERROR (auth fail at connect) to DB_CONNECTION_ERROR', async () => {
      const { service } = makeService({ integration: MYSQL_INTEGRATION_BASE });
      mysqlQueryMock.mockRejectedValue(
        Object.assign(new Error("Access denied for user 'u'@'h'"), {
          code: 'ER_ACCESS_DENIED_ERROR',
        }),
      );
      const handler = new DatabaseQueryHandler(service as never);
      const out = (await handler.execute(
        null,
        { integrationId: 'int-1', query: 'SELECT 1' },
        ctx(),
      )) as unknown as ErrorPortOutput;
      expect(out.port).toBe('error');
      expect(out.output.error.code).toBe('DB_CONNECTION_ERROR');
      expect(out.output.error.details?.driverCode).toBe(
        'ER_ACCESS_DENIED_ERROR',
      );
      await handler.shutdown();
    });

    it('rejects incomplete credentials', async () => {
      const { service } = makeService({
        integration: {
          id: 'int-1',
          name: 'half',
          serviceType: 'database',
          status: 'connected',
          credentials: {
            driver: 'postgres',
            host: 'h',
            port: 5432,
            database: 'd',
          },
        },
      });
      const handler = new DatabaseQueryHandler(service as never);
      // D4 (2026-05-17) — IntegrationError 가 더 이상 throw 되지 않고
      // port:'error' 로 라우팅된다.
      const result = (await handler.execute(
        null,
        { integrationId: 'int-1', query: 'SELECT 1' },
        ctx(),
      )) as unknown as Record<string, unknown>;
      expect(result.port).toBe('error');
      const output = result.output as {
        error: { code: string; message: string };
      };
      expect(output.error.code).toBe('INTEGRATION_INCOMPLETE');
      expect(output.error.message).toMatch(/missing fields/);
    });

    it('routes invalid parameters JSON to port:error (D4)', async () => {
      const { service } = makeService();
      const handler = new DatabaseQueryHandler(service as never);
      const result = (await handler.execute(
        null,
        {
          integrationId: 'int-1',
          query: 'SELECT 1',
          parameters: 'not json',
        },
        ctx(),
      )) as unknown as Record<string, unknown>;
      expect(result.port).toBe('error');
      const output = result.output as {
        error: { code: string; message: string };
      };
      expect(output.error.code).toBe('INVALID_PARAMETERS');
      expect(output.error.message).toMatch(/JSON array/);
    });

    // 통합을 얻기 전에 잡힌 `IntegrationError` 아닌 예외는 쿼리를 시작하지 않았으므로 `mapDbError` 로 보내지 않는다.
    // 분류되지 않은 실패 `INTEGRATION_CALL_FAILED` 다(CLE-NODE-DBQUERY-OUTPUT 에러 코드 표, CLE-T-MWR7C5).
    it('maps a missing integration (RESOURCE_NOT_FOUND) to INTEGRATION_CALL_FAILED, not DB_QUERY_FAILED', async () => {
      const { service, logUsage } = makeService();
      service.getForExecution.mockRejectedValue(integrationNotFoundError());
      const handler = new DatabaseQueryHandler(service as never);
      const out = (await handler.execute(
        null,
        { integrationId: 'int-missing', query: 'SELECT 1' },
        ctx(),
      )) as unknown as ErrorPortOutput;
      expect(out.port).toBe('error');
      expect(out.output.error.code).toBe('INTEGRATION_CALL_FAILED');
      expect(out.output.error.message).toBe(integrationNotFoundError().message);
      expect(out.output.error.details).toBeUndefined();
      // 통합을 얻기 전 실패는 활동 로그를 남기지 않는다(REQ-INTMGMT-053 · 062).
      expect(logUsage).not.toHaveBeenCalled();
      expect(queryMock).not.toHaveBeenCalled();
      await handler.shutdown();
    });

    it('maps a transient lookup failure before the query to INTEGRATION_CALL_FAILED even when it carries a driver code', async () => {
      const { service, logUsage } = makeService();
      // 통합 조회가 플랫폼 DB 의 연결 오류로 실패해도 사용자 DB 쿼리의 실패가 아니다. 드라이버 code 가 붙어 있어도
      // `DB_CONNECTION_ERROR` 로 읽지 않는다.
      service.getForExecution.mockRejectedValue(
        Object.assign(new Error('Connection terminated unexpectedly'), {
          code: 'ECONNRESET',
        }),
      );
      const handler = new DatabaseQueryHandler(service as never);
      const out = (await handler.execute(
        null,
        { integrationId: 'int-1', query: 'SELECT 1' },
        ctx(),
      )) as unknown as ErrorPortOutput;
      expect(out.port).toBe('error');
      expect(out.output.error.code).toBe('INTEGRATION_CALL_FAILED');
      expect(out.output.error.details).toBeUndefined();
      expect(logUsage).not.toHaveBeenCalled();
      await handler.shutdown();
    });

    it('still classifies a driver error thrown by the query with mapDbError after the integration is acquired', async () => {
      const { service } = makeService();
      queryMock.mockRejectedValue(
        Object.assign(new Error('connection reset'), { code: 'ECONNRESET' }),
      );
      const handler = new DatabaseQueryHandler(service as never);
      const out = (await handler.execute(
        null,
        { integrationId: 'int-1', query: 'SELECT 1' },
        ctx(),
      )) as unknown as ErrorPortOutput;
      expect(out.output.error.code).toBe('DB_CONNECTION_ERROR');
      await handler.shutdown();
    });

    it('routes missing integrations service to port:error (D4)', async () => {
      const handler = new DatabaseQueryHandler();
      const result = (await handler.execute(
        null,
        { integrationId: 'int-1', query: 'SELECT 1' },
        ctx(),
      )) as unknown as Record<string, unknown>;
      expect(result.port).toBe('error');
      const output = result.output as {
        error: { code: string; message: string };
      };
      expect(output.error.code).toBe('INTEGRATION_SERVICE_UNAVAILABLE');
      expect(output.error.message).toMatch(/integrations service/);
    });

    // Re-run dry-run (spec/5-system/13-replay-rerun.md §7.1) — WRITE 만 mock,
    // READ(SELECT)는 dry-run 에서도 실제 실행.
    describe('dry-run (spec §7.1)', () => {
      function dryRunCtx(): ExecutionContext {
        const c = ctx();
        c.variables = { ...c.variables, __dryRun: true };
        return c;
      }

      it('mocks a WRITE op (INSERT) without opening a DB connection', async () => {
        const { service, logUsage } = makeService();
        const handler = new DatabaseQueryHandler(service as never);
        const out = (await handler.execute(
          null,
          {
            integrationId: 'int-1',
            query: 'INSERT INTO users(id) VALUES ($1)',
            parameters: ['u_1'],
            queryType: 'insert',
          },
          dryRunCtx(),
        )) as unknown as {
          port: string;
          output: {
            _dryRun: boolean;
            wouldHaveCalled: {
              kind: string;
              operation: string;
              sqlPreview: string;
            };
          };
        };
        expect(out.port).toBe('success');
        expect(out.output._dryRun).toBe(true);
        expect(out.output.wouldHaveCalled.kind).toBe('database_query');
        expect(out.output.wouldHaveCalled.operation).toBe('insert');
        expect(out.output.wouldHaveCalled.sqlPreview).toContain('INSERT INTO');
        // No DB work: pool never constructed, connect/query never called, and
        // the integration is never even resolved.
        expect(jest.requireMock('pg').Pool).not.toHaveBeenCalled();
        expect(connectMock).not.toHaveBeenCalled();
        expect(queryMock).not.toHaveBeenCalled();
        expect(service.getForExecution).not.toHaveBeenCalled();
        // logUsage is also skipped on the mock short-circuit.
        expect(logUsage).not.toHaveBeenCalled();
        await handler.shutdown();
      });

      it('mocks a raw write verb (UPDATE via queryType=raw)', async () => {
        const { service } = makeService();
        const handler = new DatabaseQueryHandler(service as never);
        const out = (await handler.execute(
          null,
          {
            integrationId: 'int-1',
            query: 'UPDATE t SET a = 1',
            queryType: 'raw',
          },
          dryRunCtx(),
        )) as unknown as {
          port: string;
          output: { _dryRun: boolean; wouldHaveCalled: { kind: string } };
        };
        expect(out.port).toBe('success');
        expect(out.output._dryRun).toBe(true);
        expect(out.output.wouldHaveCalled.kind).toBe('database_query');
        expect(connectMock).not.toHaveBeenCalled();
        expect(queryMock).not.toHaveBeenCalled();
        await handler.shutdown();
      });

      it('mocks a DELETE left on the default queryType=select (CLE-T-KH11HA)', async () => {
        const { service, logUsage } = makeService();
        const handler = new DatabaseQueryHandler(service as never);
        const out = (await handler.execute(
          null,
          {
            integrationId: 'int-1',
            query: 'DELETE FROM users WHERE id = $1',
            parameters: ['u_1'],
            queryType: 'select',
          },
          dryRunCtx(),
        )) as unknown as {
          port: string;
          output: { _dryRun: boolean; wouldHaveCalled: { kind: string } };
        };
        expect(out.port).toBe('success');
        expect(out.output._dryRun).toBe(true);
        expect(out.output.wouldHaveCalled.kind).toBe('database_query');
        expect(jest.requireMock('pg').Pool).not.toHaveBeenCalled();
        expect(connectMock).not.toHaveBeenCalled();
        expect(queryMock).not.toHaveBeenCalled();
        expect(service.getForExecution).not.toHaveBeenCalled();
        expect(logUsage).not.toHaveBeenCalled();
        await handler.shutdown();
      });

      it('runs a READ (SELECT) normally even in dry-run', async () => {
        const { service } = makeService();
        queryMock.mockResolvedValue({
          rows: [{ id: 1 }],
          rowCount: 1,
          fields: [{ name: 'id', dataTypeID: 23 }],
        });
        const handler = new DatabaseQueryHandler(service as never);
        const out = (await handler.execute(
          null,
          {
            integrationId: 'int-1',
            query: 'SELECT id FROM users WHERE age > $1',
            parameters: [18],
          },
          dryRunCtx(),
        )) as unknown as {
          port: string;
          output: { _dryRun?: boolean; rowCount: number };
        };
        // Real path: query executed, no dry-run envelope.
        expect(out.port).toBe('success');
        expect(out.output._dryRun).toBeUndefined();
        expect(out.output.rowCount).toBe(1);
        expect(queryMock).toHaveBeenCalledWith(
          'SELECT id FROM users WHERE age > $1',
          [18],
        );
        expect(connectMock).toHaveBeenCalled();
        await handler.shutdown();
      });
    });

    // DB_HOST_BLOCKED — SSRF 가드가 사설/loopback host 를 전용 코드로 surface
    // (HTTP_BLOCKED·EMAIL_HOST_BLOCKED 와 대칭). 가드는 literal IP/localhost
    // fast-path 라 실제 DNS 없이 결정적으로 차단된다.
    describe('SSRF host guard (DB_HOST_BLOCKED)', () => {
      function pgIntegrationWithHost(host: string) {
        return {
          id: 'int-1',
          name: 'Primary PG',
          serviceType: 'database',
          status: 'connected',
          credentials: {
            driver: 'postgres',
            host,
            port: 5432,
            database: 'app',
            username: 'u',
            password: 'p',
            ssl: 'require',
          },
        };
      }

      function mysqlIntegrationWithHost(host: string) {
        return {
          id: 'int-1',
          name: 'Primary MySQL',
          serviceType: 'database',
          status: 'connected',
          credentials: {
            driver: 'mysql',
            host,
            port: 3306,
            database: 'app',
            username: 'u',
            password: 'p',
          },
        };
      }

      it.each([
        ['IPv4 loopback', '127.0.0.1'],
        ['IPv4 RFC1918', '10.0.0.5'],
        ['cloud IMDS', '169.254.169.254'],
        ['localhost by name', 'localhost'],
      ])(
        'blocks %s host → port:error + DB_HOST_BLOCKED',
        async (_label, host) => {
          const { service, logUsage } = makeService({
            integration: pgIntegrationWithHost(host),
          });
          const warn = jest
            .spyOn(Logger.prototype, 'warn')
            .mockImplementation(() => undefined);
          const handler = new DatabaseQueryHandler(service as never);
          try {
            const out = (await handler.execute(
              null,
              { integrationId: 'int-1', query: 'SELECT 1' },
              ctx(),
            )) as unknown as ErrorPortOutput;

            expect(out.port).toBe('error');
            expect(out.output.error.code).toBe('DB_HOST_BLOCKED');
            // 메시지는 차단 host/IP 를 노출하지 않는 일반화 문구 (정찰 면 축소).
            expect(out.output.error.message).not.toContain(host);
            expect(out.output.error.message).toMatch(/SSRF policy/i);
            // 연결을 절대 열지 않는다 (가드가 풀 연결 전에 차단).
            expect(connectMock).not.toHaveBeenCalled();
            // 활동 로그에는 failed + DB_HOST_BLOCKED 가 기록되고 host 원문은 실리지 않는다.
            expect(logUsage).toHaveBeenCalledWith(
              expect.objectContaining({ id: 'int-1' }),
              expect.objectContaining({
                status: 'failed',
                error: expect.objectContaining({ code: 'DB_HOST_BLOCKED' }),
              }),
            );
            expect(JSON.stringify(logUsage.mock.calls[0][1])).not.toContain(
              host,
            );
            // 판정 원문(host · IP)은 서버 경고 로그에만 남는다(CLE-T-CT6SHS, 연결 시점 차단과 같은 규칙).
            expect(warn).toHaveBeenCalledWith(
              expect.stringContaining('SSRF block (database-query)'),
            );
            expect(warn).toHaveBeenCalledWith(expect.stringContaining(host));
          } finally {
            warn.mockRestore();
            await handler.shutdown();
          }
        },
      );

      // DNS rebinding — host 이름은 공인 도메인인데 해석 결과가 내부 대역이면 literal 판정을 지나도 해석 가드에서 막힌다.
      // 위 `node:dns/promises` 가짜가 가드에 실제로 닿는지도 이 테스트로 확인한다. 가짜가 빠지면 실제 조회에서 내부 주소가
      // 나오지 않아 연결을 열고 이 테스트가 실패한다.
      it('blocks a public host name that resolves to a private IP (DNS rebinding) → DB_HOST_BLOCKED', async () => {
        mockedLookup.mockResolvedValueOnce([
          { address: '10.0.0.5', family: 4 },
        ]);
        const { service, logUsage } = makeService({
          integration: pgIntegrationWithHost('rebind.example.com'),
        });
        const warn = jest
          .spyOn(Logger.prototype, 'warn')
          .mockImplementation(() => undefined);
        const handler = new DatabaseQueryHandler(service as never);
        try {
          const out = (await handler.execute(
            null,
            { integrationId: 'int-1', query: 'SELECT 1' },
            ctx(),
          )) as unknown as ErrorPortOutput;

          expect(out.port).toBe('error');
          expect(out.output.error.code).toBe('DB_HOST_BLOCKED');
          expect(out.output.error.message).not.toContain('10.0.0.5');
          expect(mockedLookup).toHaveBeenCalledWith('rebind.example.com', {
            all: true,
          });
          expect(connectMock).not.toHaveBeenCalled();
          // 해석된 내부 IP 는 사용자 응답 · 활동 로그에는 없고 서버 경고 로그에만 있다(CLE-T-CT6SHS).
          expect(JSON.stringify(out.output)).not.toContain('10.0.0.5');
          expect(JSON.stringify(logUsage.mock.calls)).not.toContain('10.0.0.5');
          expect(warn).toHaveBeenCalledWith(
            expect.stringContaining('SSRF block (database-query)'),
          );
          expect(warn).toHaveBeenCalledWith(
            expect.stringContaining('10.0.0.5'),
          );
        } finally {
          warn.mockRestore();
          await handler.shutdown();
        }
      });

      /**
       * 가드의 «판정» 은 `SsrfBlockedError` 하나뿐이다. 그 밖의 오류는 가드의 고장이지 차단이 아니므로 `DB_HOST_BLOCKED`
       * (= 사용자에게 «당신의 host 가 막혔다») 로 보고하면 거짓이다. 분류되지 않은 실패(`INTEGRATION_CALL_FAILED`,
       * 공통 §4.2)로 돌린다 — 같은 실패를 activity 로그에 적는 `toLogError` 와 같은 코드라 둘이 어긋나지 않는다.
       */
      it('가드가 판정 아닌 오류를 던지면 DB_HOST_BLOCKED 가 아니라 INTEGRATION_CALL_FAILED', async () => {
        const { service, logUsage } = makeService({
          integration: pgIntegrationWithHost('db.example.com'),
        });
        const handler = new DatabaseQueryHandler(service as never);
        (
          assertSafeOutboundHostResolved as unknown as jest.Mock
        ).mockRejectedValueOnce(
          new TypeError('hostname.toLowerCase is not a function'),
        );

        const out = (await handler.execute(
          null,
          { integrationId: 'int-1', query: 'SELECT 1' },
          ctx(),
        )) as unknown as ErrorPortOutput;

        expect(out.port).toBe('error');
        expect(out.output.error.code).toBe('INTEGRATION_CALL_FAILED');
        // 원문은 서버 로그에만 남기고 고정 문구를 내보낸다(CLE-T-E991S1).
        expect(out.output.error.message).toBe(
          'The outbound address check failed.',
        );
        expect(out.output.error.message).toBe(SSRF_GUARD_FAILED_CLIENT_MESSAGE);
        // 가드 오류 원문은 사용자 응답에 실리지 않는다(서버 로그 전용).
        expect(JSON.stringify(out.output.error)).not.toContain('toLowerCase');
        expect(connectMock).not.toHaveBeenCalled();
        expect(logUsage).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'int-1' }),
          expect.objectContaining({
            status: 'failed',
            error: expect.objectContaining({ code: 'INTEGRATION_CALL_FAILED' }),
          }),
        );
      });

      it('blocks MySQL driver host too (가드는 driver 분기 전 실행)', async () => {
        const { service, logUsage } = makeService({
          integration: mysqlIntegrationWithHost('127.0.0.1'),
        });
        const handler = new DatabaseQueryHandler(service as never);
        const out = (await handler.execute(
          null,
          { integrationId: 'int-1', query: 'SELECT 1' },
          ctx(),
        )) as unknown as ErrorPortOutput;

        expect(out.port).toBe('error');
        expect(out.output.error.code).toBe('DB_HOST_BLOCKED');
        expect(out.output.error.message).not.toContain('127.0.0.1');
        // MySQL 풀도 절대 생성되지 않는다 (driver 분기 전에 차단).
        expect(
          jest.requireMock('mysql2/promise').createPool,
        ).not.toHaveBeenCalled();
        expect(logUsage).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'int-1' }),
          expect.objectContaining({
            status: 'failed',
            error: expect.objectContaining({ code: 'DB_HOST_BLOCKED' }),
          }),
        );
      });

      it('ALLOW_PRIVATE_HOST_TARGETS=true opt-out → guard 통과 (차단 안 함)', async () => {
        await withEnv({ ALLOW_PRIVATE_HOST_TARGETS: 'true' }, async () => {
          const { service } = makeService({
            integration: pgIntegrationWithHost('127.0.0.1'),
          });
          queryMock.mockResolvedValue({ rows: [], rowCount: 0 });
          const handler = new DatabaseQueryHandler(service as never);
          const out = (await handler.execute(
            null,
            { integrationId: 'int-1', query: 'SELECT 1' },
            ctx(),
          )) as unknown as { port: string };
          // 차단되지 않고 실제 실행 경로로 진행 (opt-in self-host).
          expect(out.port).toBe('success');
          expect(connectMock).toHaveBeenCalled();
        });
      });
    });

    // SUMMARY#14 — abortSignal 사전 체크 경로 단위 테스트
    it('throws AbortError when context.abortSignal is already aborted', async () => {
      const { service } = makeService();
      const handler = new DatabaseQueryHandler(service as never);
      const controller = new AbortController();
      controller.abort();
      const abortedCtx: ExecutionContext = {
        ...ctx(),
        abortSignal: controller.signal,
      };
      await expect(
        handler.execute(
          null,
          { integrationId: 'int-1', query: 'SELECT 1' },
          abortedCtx,
        ),
      ).rejects.toMatchObject({ name: 'AbortError' });
    });
  });
});

// 워크스페이스 컨텍스트 누락은 배포 구성 에러라 공통 코드 `INTEGRATION_SERVICE_UNAVAILABLE` 로 에러 포트에 나간다.
// 통합을 조회하지 않고 얻은 통합도 없어 활동 로그를 남기지 않는다(CLE-NODE-INT-COMMON-ERROR, CLE-T-MYDNQN).
describe('DatabaseQueryHandler — 워크스페이스 컨텍스트 누락', () => {
  it('INTEGRATION_SERVICE_UNAVAILABLE 로 에러 포트에 보내고 통합을 조회하지 않는다', async () => {
    const { service, logUsage } = makeService();
    const handler = new DatabaseQueryHandler(service as never);
    const context = ctx();
    context.variables = {};
    const result = (await handler.execute(
      null,
      { integrationId: 'int-1', query: 'SELECT 1' },
      context,
    )) as unknown as ErrorPortOutput;
    expect(result.port).toBe('error');
    expect(result.output.error.code).toBe('INTEGRATION_SERVICE_UNAVAILABLE');
    expect(result.output.error.message).toMatch(/workspace context/);
    expect(service.getForExecution).not.toHaveBeenCalled();
    expect(logUsage).not.toHaveBeenCalled();
  });
});
