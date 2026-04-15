import { Pool, PoolClient } from 'pg';
import {
  createPool as mysqlCreatePool,
  Pool as MysqlPool,
  ResultSetHeader,
  RowDataPacket,
} from 'mysql2/promise';
import { createHash } from 'crypto';
import {
  ExecutionContext,
  NodeHandler,
  ValidationResult,
} from '../node-handler.interface.js';
import {
  IntegrationError,
  IntegrationHandlerBase,
  toLogError,
} from './integration-handler-base.js';
import { IntegrationsService } from '../../../integrations/integrations.service.js';

interface DbCredentials {
  driver: 'postgres' | 'mysql';
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: 'disable' | 'require' | 'verify-full';
}

/**
 * Allowed values for `config.queryType`. Centralised so that validate() and
 * any future runtime branching stay in sync.
 */
export const ALLOWED_QUERY_TYPES = [
  'select',
  'insert',
  'update',
  'delete',
  'raw',
] as const;

const POOL_MAX_CONNECTIONS = 5;
const POOL_IDLE_TIMEOUT_MS = 30_000;

export class DatabaseQueryHandler
  extends IntegrationHandlerBase
  implements NodeHandler
{
  /**
   * integrationId → cached driver-specific connection pool. A new Pool is
   * created on first use and reused across node executions to bound total
   * TCP connections against the database's `max_connections`. Keyed by
   * integrationId + credentials hash so credential rotations invalidate.
   */
  private readonly pools = new Map<
    string,
    | { driver: 'postgres'; pool: Pool; credsHash: string }
    | { driver: 'mysql'; pool: MysqlPool; credsHash: string }
  >();

  constructor(integrationsService?: IntegrationsService) {
    super(integrationsService);
  }

  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];

    if (!config.integrationId || typeof config.integrationId !== 'string') {
      errors.push('integrationId is required');
    }
    if (!config.query || typeof config.query !== 'string') {
      errors.push('query is required and must be a string');
    }
    if (
      config.queryType !== undefined &&
      !ALLOWED_QUERY_TYPES.includes(
        config.queryType as (typeof ALLOWED_QUERY_TYPES)[number],
      )
    ) {
      errors.push(
        `queryType must be one of: ${ALLOWED_QUERY_TYPES.join(', ')}`,
      );
    }
    if (
      config.parameters !== undefined &&
      config.parameters !== null &&
      !Array.isArray(config.parameters) &&
      typeof config.parameters !== 'string'
    ) {
      errors.push('parameters must be an array or a JSON array string');
    }

    return { valid: errors.length === 0, errors };
  }

  async execute(
    _input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<unknown> {
    const integrationId = config.integrationId as string;
    const query = config.query as string;
    const queryType = (config.queryType as string) ?? 'select';
    const parameters = parseParameters(config.parameters);

    if (!this.integrationsService) {
      throw new IntegrationError(
        'INTEGRATION_SERVICE_UNAVAILABLE',
        'Database node requires an integrations service to be configured',
      );
    }

    const start = Date.now();
    const configEcho = { integrationId, query, queryType, parameters };

    // Pre-flight configuration errors throw (halt workflow). Runtime
    // execution errors route to the `error` port so authors can branch.
    const integration = await this.resolveIntegration(
      integrationId,
      context,
      'database',
    );
    const creds = integration.credentials as Partial<DbCredentials>;
    const missing = missingDbFields(creds);
    if (missing.length > 0) {
      throw new IntegrationError(
        'INTEGRATION_INCOMPLETE',
        `Database integration is missing fields: ${missing.join(', ')}`,
      );
    }

    try {
      const driver = creds.driver ?? 'postgres';
      const result =
        driver === 'mysql'
          ? await this.executeMysql(
              integrationId,
              creds as DbCredentials,
              query,
              parameters,
            )
          : await this.executePostgres(
              integrationId,
              creds as DbCredentials,
              query,
              parameters,
            );
      const durationMs = Date.now() - start;
      await this.logUsage(context, {
        integrationId,
        status: 'success',
        durationMs,
      }).catch(() => {});
      return {
        config: configEcho,
        output: result,
        meta: { durationMs },
        port: 'success',
      };
    } catch (err) {
      const durationMs = Date.now() - start;
      await this.logUsage(context, {
        integrationId,
        status: 'failed',
        durationMs,
        error: toLogError(err),
      }).catch(() => {});
      return {
        config: configEcho,
        output: {
          error: {
            code: err instanceof IntegrationError ? err.code : 'QUERY_FAILED',
            message: err instanceof Error ? err.message : String(err),
          },
        },
        meta: { durationMs },
        port: 'error',
      };
    }
  }

  private async executeMysql(
    integrationId: string,
    creds: DbCredentials,
    query: string,
    parameters: unknown[],
  ): Promise<Record<string, unknown>> {
    const pool = this.resolveMysqlPool(integrationId, creds);
    // mysql2 uses `?` placeholders. Convert `$1, $2, ...` from the
    // PostgreSQL-flavoured UI hint into positional `?` marks. Parameters
    // are still bound positionally against `parameters[]`.
    const sql = convertPgPlaceholders(query);
    const [rawRows, fields] = await pool.query(sql, parameters);
    if (Array.isArray(rawRows)) {
      const rows = rawRows as RowDataPacket[];
      return {
        rows,
        rowCount: rows.length,
        fields: Array.isArray(fields)
          ? fields.map((f) => ({
              name: f.name,
              dataTypeID: f.columnType,
            }))
          : undefined,
      };
    }
    const header = rawRows as ResultSetHeader;
    return {
      rows: [],
      rowCount: header.affectedRows ?? 0,
      insertId: header.insertId,
      fields: [],
    };
  }

  private async executePostgres(
    integrationId: string,
    creds: DbCredentials,
    query: string,
    parameters: unknown[],
  ): Promise<Record<string, unknown>> {
    const pool = this.resolvePgPool(integrationId, creds);
    let client: PoolClient | undefined;
    try {
      client = await pool.connect();
      const result = await client.query(query, parameters);
      return {
        rows: result.rows,
        rowCount: result.rowCount ?? result.rows.length,
        fields: result.fields?.map((f) => ({
          name: f.name,
          dataTypeID: f.dataTypeID,
        })),
      };
    } finally {
      client?.release();
    }
  }

  /**
   * Drop the cached pool for an integration — useful when credentials change.
   * Safe to call even if no pool exists for the id.
   */
  async invalidatePool(integrationId: string): Promise<void> {
    const entry = this.pools.get(integrationId);
    if (!entry) return;
    this.pools.delete(integrationId);
    try {
      await entry.pool.end();
    } catch {
      /* ignore */
    }
  }

  /**
   * Close all cached pools. Intended for test cleanup and graceful shutdown.
   */
  async shutdown(): Promise<void> {
    const entries = Array.from(this.pools.values());
    this.pools.clear();
    await Promise.allSettled(entries.map((e) => e.pool.end()));
  }

  private resolvePgPool(integrationId: string, creds: DbCredentials): Pool {
    const credsHash = hashCredentials(creds);
    const existing = this.pools.get(integrationId);
    if (
      existing &&
      existing.driver === 'postgres' &&
      existing.credsHash === credsHash
    ) {
      return existing.pool;
    }
    if (existing) {
      // credential or driver rotated — end the stale pool in the background
      void existing.pool.end().catch(() => {});
    }

    const pool = new Pool({
      ...buildPgConnection(creds),
      max: POOL_MAX_CONNECTIONS,
      idleTimeoutMillis: POOL_IDLE_TIMEOUT_MS,
    });
    // Prevent unhandled error events from crashing the process when an idle
    // client encounters a network issue.
    pool.on('error', () => {});
    this.pools.set(integrationId, { driver: 'postgres', pool, credsHash });
    return pool;
  }

  private resolveMysqlPool(
    integrationId: string,
    creds: DbCredentials,
  ): MysqlPool {
    const credsHash = hashCredentials(creds);
    const existing = this.pools.get(integrationId);
    if (
      existing &&
      existing.driver === 'mysql' &&
      existing.credsHash === credsHash
    ) {
      return existing.pool;
    }
    if (existing) {
      void existing.pool.end().catch(() => {});
    }

    const pool = mysqlCreatePool({
      host: creds.host,
      port: creds.port,
      user: creds.username,
      password: creds.password,
      database: creds.database,
      ssl: buildMysqlSsl(creds.ssl),
      connectionLimit: POOL_MAX_CONNECTIONS,
      idleTimeout: POOL_IDLE_TIMEOUT_MS,
      waitForConnections: true,
    });
    this.pools.set(integrationId, { driver: 'mysql', pool, credsHash });
    return pool;
  }
}

function buildPgConnection(creds: DbCredentials): {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean | { rejectUnauthorized: boolean };
} {
  let ssl: boolean | { rejectUnauthorized: boolean } = false;
  // `require` now enforces cert verification. Operators who rely on
  // self-signed certificates must opt in explicitly by rotating to a
  // fully validated `verify-full` pair, OR extending this mapping to a
  // new `require-trust` mode — we intentionally stopped defaulting to
  // `rejectUnauthorized: false` because of the MITM exposure.
  if (creds.ssl === 'require' || creds.ssl === 'verify-full') {
    ssl = { rejectUnauthorized: true };
  }
  return {
    host: creds.host,
    port: creds.port,
    database: creds.database,
    user: creds.username,
    password: creds.password,
    ssl,
  };
}

function missingDbFields(creds: Partial<DbCredentials>): string[] {
  const required: (keyof DbCredentials)[] = [
    'driver',
    'host',
    'port',
    'database',
    'username',
    'password',
  ];
  return required.filter(
    (k) => creds[k] === undefined || creds[k] === null || creds[k] === '',
  );
}

function parseParameters(raw: unknown): unknown[] {
  if (raw === undefined || raw === null || raw === '') return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      throw new IntegrationError(
        'INVALID_PARAMETERS',
        'parameters must be a JSON array (e.g. `["v1", 2]`)',
      );
    }
  }
  throw new IntegrationError(
    'INVALID_PARAMETERS',
    'parameters must be an array or a JSON array string',
  );
}

function convertPgPlaceholders(sql: string): string {
  // Convert `$1, $2, ...` to `?`. Parameters remain positional, so authors
  // must list `$N` markers in the same order as the `parameters` array.
  return sql.replace(/\$\d+/g, '?');
}

function buildMysqlSsl(
  ssl: DbCredentials['ssl'],
): { rejectUnauthorized: boolean } | undefined {
  if (ssl === 'require' || ssl === 'verify-full') {
    return { rejectUnauthorized: true };
  }
  return undefined;
}

function hashCredentials(creds: DbCredentials): string {
  const fingerprint = [
    creds.driver,
    creds.host,
    creds.port,
    creds.database,
    creds.username,
    creds.password,
    creds.ssl,
  ].join('|');
  return createHash('sha256').update(fingerprint).digest('hex');
}
