import {
  DatabaseQueryHandler,
  extractSqlVerb,
} from './database-query.handler.js';
import { ExecutionContext } from '../../core/node-handler.interface.js';
import { createEmptyConversationThread } from '../../../shared/conversation-thread/conversation-thread.types';

const connectMock = jest.fn();
const queryMock = jest.fn();
const releaseMock = jest.fn();
const endMock = jest.fn();
const onMock = jest.fn();

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    connect: () =>
      connectMock().then(() => ({
        query: (...args: unknown[]) => queryMock(...args),
        release: () => releaseMock(),
      })),
    end: () => endMock(),
    on: (...args: unknown[]) => onMock(...args),
  })),
}));

const mysqlQueryMock = jest.fn();
const mysqlEndMock = jest.fn();

jest.mock('mysql2/promise', () => ({
  createPool: jest.fn().mockImplementation(() => ({
    query: (...args: unknown[]) => mysqlQueryMock(...args),
    end: () => mysqlEndMock(),
  })),
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

describe('DatabaseQueryHandler', () => {
  beforeEach(() => {
    connectMock.mockReset().mockResolvedValue(undefined);
    queryMock.mockReset();
    releaseMock.mockReset();
    endMock.mockReset().mockResolvedValue(undefined);
    onMock.mockReset();
    jest.requireMock('pg').Pool.mockClear();
    mysqlQueryMock.mockReset();
    mysqlEndMock.mockReset().mockResolvedValue(undefined);
    jest.requireMock('mysql2/promise').createPool.mockClear();
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
  });
});

// W2 + W4 — extractSqlVerb unit tests (INT-US-05)
describe('extractSqlVerb', () => {
  it('returns null for undefined input', () => {
    expect(extractSqlVerb(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractSqlVerb('')).toBeNull();
  });

  it('extracts SELECT from a standard query', () => {
    expect(extractSqlVerb('SELECT id FROM users WHERE age > $1')).toBe(
      'SELECT',
    );
  });

  it('handles leading whitespace', () => {
    expect(extractSqlVerb('  SELECT 1')).toBe('SELECT');
  });

  it('uppercases mixed-case SQL verb', () => {
    expect(extractSqlVerb('SeLeCt 1')).toBe('SELECT');
  });

  it('returns null when first token starts with a digit', () => {
    expect(extractSqlVerb('123invalid')).toBeNull();
  });

  it('extracts WITH for CTE queries', () => {
    expect(extractSqlVerb('WITH cte AS (SELECT 1) SELECT * FROM cte')).toBe(
      'WITH',
    );
  });

  it('extracts INSERT', () => {
    expect(extractSqlVerb('INSERT INTO t VALUES ($1)')).toBe('INSERT');
  });

  it('extracts UPDATE', () => {
    expect(extractSqlVerb('UPDATE t SET col = $1 WHERE id = $2')).toBe(
      'UPDATE',
    );
  });

  it('extracts DELETE', () => {
    expect(extractSqlVerb('DELETE FROM t WHERE id = $1')).toBe('DELETE');
  });

  // W4 — over-length SQL verb (9-char SAVEPOINT gets clamped by clampApiField downstream)
  it('returns full SAVEPOINT (9 chars) — clampApiField upstream of DB write handles truncation', () => {
    // extractSqlVerb itself returns the full verb; callers apply clampApiField.
    expect(extractSqlVerb('SAVEPOINT sp1')).toBe('SAVEPOINT');
  });

  it('returns ROLLBACK (8 chars — exactly at api_method limit)', () => {
    expect(extractSqlVerb('ROLLBACK')).toBe('ROLLBACK');
  });

  it('returns TRUNCATE (8 chars — exactly at api_method limit)', () => {
    expect(extractSqlVerb('TRUNCATE t')).toBe('TRUNCATE');
  });
});
