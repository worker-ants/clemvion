import { DatabaseQueryHandler } from './database-query.handler.js';
import { ExecutionContext } from '../node-handler.interface.js';

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

function ctx(): ExecutionContext {
  return {
    executionId: 'exec-1',
    workflowId: 'wf-1',
    nodeExecutionId: 'ne-1',
    variables: { __workspaceId: 'ws-1' },
    nodeOutputCache: {},
  };
}

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
      )) as {
        config: { query: string };
        output: { rows: unknown[]; rowCount: number };
        meta: { durationMs: number };
      };
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

    it('releases the client and logs failure on query error', async () => {
      const { service, logUsage } = makeService();
      queryMock.mockRejectedValue(new Error('syntax error'));
      const handler = new DatabaseQueryHandler(service as never);
      await expect(
        handler.execute(
          null,
          { integrationId: 'int-1', query: 'SELEC 1' },
          ctx(),
        ),
      ).rejects.toThrow('syntax error');
      expect(releaseMock).toHaveBeenCalled();
      expect(logUsage).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed' }),
      );
      await handler.shutdown();
    });

    it('rejects mysql until mysql2 driver is added', async () => {
      const { service } = makeService({
        integration: {
          id: 'int-1',
          name: 'MySql',
          serviceType: 'database',
          status: 'connected',
          credentials: {
            driver: 'mysql',
            host: 'h',
            port: 3306,
            database: 'd',
            username: 'u',
            password: 'p',
            ssl: 'require',
          },
        },
      });
      const handler = new DatabaseQueryHandler(service as never);
      await expect(
        handler.execute(
          null,
          { integrationId: 'int-1', query: 'SELECT 1' },
          ctx(),
        ),
      ).rejects.toThrow(/MySQL/);
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
      await expect(
        handler.execute(
          null,
          { integrationId: 'int-1', query: 'SELECT 1' },
          ctx(),
        ),
      ).rejects.toThrow(/missing fields/);
    });

    it('rejects invalid parameters JSON', async () => {
      const { service } = makeService();
      const handler = new DatabaseQueryHandler(service as never);
      await expect(
        handler.execute(
          null,
          {
            integrationId: 'int-1',
            query: 'SELECT 1',
            parameters: 'not json',
          },
          ctx(),
        ),
      ).rejects.toThrow(/JSON array/);
    });

    it('falls back to stub when integrations service missing', async () => {
      const handler = new DatabaseQueryHandler();
      const out = (await handler.execute(
        null,
        { integrationId: 'int-1', query: 'SELECT 1' },
        ctx(),
      )) as { output: { message: string } };
      expect(out.output.message).toMatch(/requires integration/);
    });
  });
});
