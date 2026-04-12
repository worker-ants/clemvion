import { Pool, PoolClient } from 'pg';
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
   * integrationId → cached pg.Pool. A new Pool is created on first use and
   * reused across node executions to bound total TCP connections against
   * PostgreSQL's `max_connections`. Keyed by integrationId + credentials hash
   * so credential rotations invalidate the cache.
   */
  private readonly pools = new Map<string, { pool: Pool; credsHash: string }>();

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
      return {
        config: { integrationId, query, queryType, parameters },
        output: {
          rows: [],
          rowCount: 0,
          message: 'Database execution requires integration connection',
        },
      };
    }

    const start = Date.now();
    try {
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
      if (creds.driver === 'mysql') {
        throw new IntegrationError(
          'DRIVER_NOT_SUPPORTED',
          'MySQL driver is not yet implemented — add `mysql2` dependency to enable',
        );
      }

      const pool = this.resolvePool(integrationId, creds as DbCredentials);
      let client: PoolClient | undefined;
      try {
        client = await pool.connect();
        const result = await client.query(query, parameters);
        const durationMs = Date.now() - start;
        await this.logUsage(context, {
          integrationId,
          status: 'success',
          durationMs,
        }).catch(() => {});
        return {
          config: { integrationId, query, queryType, parameters },
          output: {
            rows: result.rows,
            rowCount: result.rowCount ?? result.rows.length,
            fields: result.fields?.map((f) => ({
              name: f.name,
              dataTypeID: f.dataTypeID,
            })),
          },
          meta: { durationMs },
        };
      } finally {
        client?.release();
      }
    } catch (err) {
      await this.logUsage(context, {
        integrationId,
        status: 'failed',
        durationMs: Date.now() - start,
        error: toLogError(err),
      }).catch(() => {});
      throw err;
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

  private resolvePool(integrationId: string, creds: DbCredentials): Pool {
    const credsHash = hashCredentials(creds);
    const existing = this.pools.get(integrationId);
    if (existing && existing.credsHash === credsHash) {
      return existing.pool;
    }
    if (existing) {
      // credential rotated — end the stale pool in the background
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
    this.pools.set(integrationId, { pool, credsHash });
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
      const parsed = JSON.parse(raw);
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
