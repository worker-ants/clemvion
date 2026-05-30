import { Logger } from '@nestjs/common';
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
  NodeHandlerOutput,
  ValidationResult,
} from '../../core/node-handler.interface.js';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation.js';
import {
  IntegrationError,
  IntegrationHandlerBase,
  sanitizeMessage,
  toLogError,
} from '../_base/integration-handler-base.js';
import { IntegrationsService } from '../../../modules/integrations/integrations.service.js';
import { assertSafeOutboundHostResolved } from '../http-request/http-safety.js';
import { databaseQueryNodeMetadata } from './database-query.schema.js';

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
const logger = new Logger('DatabaseQueryHandler');

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

  metadata = databaseQueryNodeMetadata;

  validate(config: Record<string, unknown>): ValidationResult {
    // Schema SSOT (warningRules + validateConfig) covers
    // integrationId/query required + parameters sum-type guard. The query
    // and queryType type/enum guards stay handler-side because zod's
    // narrowing happens at parse time only.
    const errors = [...evaluateMetadataBlockingErrors(this.metadata, config)];
    if (config.query !== undefined && typeof config.query !== 'string') {
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
    return { valid: errors.length === 0, errors };
  }

  async execute(
    _input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<NodeHandlerOutput> {
    // parallel-p2-followups §1 (2026-05-30) — node-cancellation 컨벤션.
    // 노드 진입 직전 이미 abort 된 경우 (cancel-others-on-fail 첫 분기 실패
    // 후 dispatch 된 케이스) 즉시 throw. 진행 중 abort 의 처리는 driver 별
    // cancel 메커니즘 (best-effort) — 후속 PR 에서 PostgreSQL pg.client.cancel
    // 등 추가. 본 PR 은 사전 체크 + best-effort 명시.
    if (context.abortSignal?.aborted) {
      const err = new Error('Operation was aborted before database query');
      err.name = 'AbortError';
      throw err;
    }

    const integrationId = config.integrationId as string;
    const query = config.query as string;

    const start = Date.now();
    // CONVENTIONS Principle 7 — config echoes raw integrationId / query /
    // queryType / parameters (`query` and per-parameter values may carry
    // `{{ ... }}` templates that the engine resolved before dispatch).
    const rawConfig = context.rawConfig ?? config;
    const configEcho = {
      integrationId: rawConfig.integrationId,
      query: rawConfig.query,
      queryType: rawConfig.queryType ?? 'select',
      parameters: rawConfig.parameters,
    };

    // D4 (2026-05-17, plan/in-progress/node-output-redesign) — Integration
    // 4종 모두 send-email 의 catch-all 패턴으로 통일. handler.validate() 가
    // 거른 config 형식 오류만 throw, 그 외 IntegrationError / parameters
    // 파싱 실패 / resolveIntegration 실패 / SSRF guard 실패 모두 catch 후
    // port:'error' 로 라우팅. fallback 코드는 INTEGRATION_CALL_FAILED.
    let driver: 'postgres' | 'mysql' = 'postgres';
    // INT-US-05 — api_method 는 SQL 첫 토큰 (`SELECT` / `INSERT` / ...). 첫
    // 토큰이 동사가 아닌 경우 (raw 쿼리 분기 등) 는 NULL fallback. api_path 는
    // 확정된 driver 토큰 — 그 전엔 default 'postgres'.
    const apiMethod = extractSqlVerb(query);
    try {
      const parameters = parseParameters(config.parameters);

      if (!this.integrationsService) {
        throw new IntegrationError(
          'INTEGRATION_SERVICE_UNAVAILABLE',
          'Database node requires an integrations service to be configured',
        );
      }

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

      // SSRF/DNS-rebinding guard: 사용자 제공 DB host 가 loopback/private IP 로
      // 해석되면 차단. 정상 사용 사례 (private VPC 안 RDS) 는 환경변수
      // ALLOW_PRIVATE_HOST_TARGETS=true 로 의식적 opt-in (W-5).
      if (creds.host) {
        await assertSafeOutboundHostResolved(creds.host);
      }

      driver = creds.driver ?? 'postgres';
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
        api: { method: apiMethod, path: driver },
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
        api: { method: apiMethod, path: driver },
      }).catch(() => {});
      // D4 — IntegrationError (resolve / missingDbFields / parseParameters /
      // SSRF guard 등) 는 그대로 code 를 surface, 그 외 (SQL throw 등) 는
      // driver-specific mapper 로 분류. SSRF guard 의 plain Error 는
      // mapDbError 의 fallback (`INTEGRATION_CALL_FAILED`) 로 흐른다.
      const errorEnvelope =
        err instanceof IntegrationError
          ? {
              code: err.code,
              message: sanitizeMessage(err.message),
            }
          : mapDbError(err, driver);
      return {
        config: configEcho,
        output: {
          error: errorEnvelope,
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
    // Prevent unhandled error events from crashing the process when an
    // idle client encounters a network issue. We still log so TLS expiry,
    // forced disconnects from the DB side, etc. show up in operator
    // logs (the next `pool.connect()` call will surface the same root
    // cause to the workflow as `DB_CONNECTION_ERROR` via `mapDbError`).
    pool.on('error', (err) => {
      logger.warn(
        `pg pool idle client error (integration ${integrationId}): ${sanitizeMessage(err.message)}`,
      );
    });
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

/**
 * INT-US-05 — `IntegrationUsageLog.api_method` 용. 쿼리 첫 비공백 토큰을
 * upper-case 로 추출 (e.g., `SELECT`, `INSERT`, `UPDATE`, `DELETE`).
 * 첫 토큰이 영문 단어가 아니거나 query 가 비어있으면 NULL fallback.
 */
export function extractSqlVerb(query: string | undefined): string | null {
  if (!query) return null;
  const match = query.trim().match(/^([A-Za-z]+)/);
  if (!match) return null;
  return match[1].toUpperCase();
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

/**
 * Subset of `ErrorCode` strings that `mapDbError` may emit. Narrower than
 * `string` so the consumer sees the union directly in autocomplete /
 * exhaustive switch statements.
 */
type DbRuntimeErrorCode =
  | 'DB_QUERY_FAILED'
  | 'DB_CONNECTION_ERROR'
  | 'DB_CONSTRAINT_VIOLATION'
  | 'DB_PERMISSION_DENIED';

/**
 * Driver-error → `output.error.code` mapping.
 *
 * Both `pg` (`DatabaseError.code` = SQLSTATE 5-char) and `mysql2`
 * (`QueryError.code` = `ER_*` / Node `ERRNO` like `ECONNRESET`) attach a
 * `code` string to the thrown Error. We map those into the four canonical
 * `DB_*` codes so workflow authors can branch without substring matching
 * the human-readable message:
 *
 *   - `DB_CONNECTION_ERROR`     — retry-worthy (reconnect / new pool /
 *                                  rotate credentials)
 *   - `DB_CONSTRAINT_VIOLATION` — permanent (data shape problem)
 *   - `DB_PERMISSION_DENIED`    — permanent (privilege problem on an
 *                                  authenticated session)
 *   - `DB_QUERY_FAILED`         — fallback for everything else (syntax,
 *                                  bad column/table, type mismatch)
 *
 * `details.driverCode` is the original driver string (e.g. `"23505"` or
 * `"ER_DUP_ENTRY"`) so operators can still drill in to the precise reason.
 * If the driver provided no `code` (plain `Error`), `details` is omitted
 * entirely — CONVENTIONS Principle 11 (undefined fields elided).
 *
 * The `message` is run through `sanitizeMessage` so password / Bearer /
 * long-token fragments that drivers occasionally include in their error
 * text never reach `output.error.message` (spec §5.3, §6.2).
 *
 * Internal to this handler — not exported. If another integration ever
 * needs DB-style error classification, lift this into
 * `_base/db-error-classifier.ts`.
 */
function mapDbError(
  err: unknown,
  driver: 'postgres' | 'mysql',
): {
  code: DbRuntimeErrorCode;
  message: string;
  details?: { driverCode: string };
} {
  const rawMessage = err instanceof Error ? err.message : String(err);
  const message = sanitizeMessage(rawMessage);
  const driverCode = extractDriverCode(err);
  const code = classifyDbError(driverCode, driver);
  if (driverCode === undefined) {
    return { code, message };
  }
  return { code, message, details: { driverCode } };
}

function extractDriverCode(err: unknown): string | undefined {
  if (err === null || typeof err !== 'object') return undefined;
  const raw = (err as { code?: unknown }).code;
  return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
}

/**
 * Node-side errno + mysql2 protocol-level codes that always indicate a
 * transport failure — checked first by `classifyDbError` so any driver
 * surfacing one of these short-circuits to `DB_CONNECTION_ERROR` before
 * the per-driver Sets are consulted. The mysql2 `PROTOCOL_*` codes also
 * appear here (rather than in `MYSQL_CONNECTION_CODES`) to avoid dead
 * entries — the shared check fires first.
 */
const CONNECTION_ERRNOS = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EAI_AGAIN',
  'EPIPE',
  'PROTOCOL_CONNECTION_LOST',
  'PROTOCOL_SEQUENCE_TIMEOUT',
  'PROTOCOL_PACKETS_OUT_OF_ORDER',
]);

/**
 * MySQL-specific connection / handshake / quota codes. Authentication
 * failure at handshake (`ER_ACCESS_DENIED_ERROR`) is bucketed here rather
 * than under permissions so retry policies that rotate credentials fire —
 * runtime privilege failures on an already-authenticated session use
 * `MYSQL_PERMISSION_CODES` below.
 */
const MYSQL_CONNECTION_CODES = new Set([
  'ER_ACCESS_DENIED_ERROR',
  'ER_CON_COUNT_ERROR',
  'ER_HOST_NOT_PRIVILEGED',
  'ER_HOST_IS_BLOCKED',
  'ER_TOO_MANY_USER_CONNECTIONS',
]);

/**
 * MySQL constraint-violation codes — unique / FK / NOT NULL / CHECK / dup.
 * Mirrors PostgreSQL SQLSTATE class 23 in semantics.
 */
const MYSQL_CONSTRAINT_CODES = new Set([
  'ER_DUP_ENTRY',
  'ER_DUP_KEY',
  'ER_DUP_UNIQUE',
  'ER_NO_REFERENCED_ROW',
  'ER_NO_REFERENCED_ROW_2',
  'ER_ROW_IS_REFERENCED',
  'ER_ROW_IS_REFERENCED_2',
  'ER_BAD_NULL_ERROR',
  'ER_CHECK_CONSTRAINT_VIOLATED',
  'ER_FOREIGN_DUPLICATE_KEY',
  'ER_FOREIGN_DUPLICATE_KEY_WITH_CHILD_INFO',
  'ER_FOREIGN_DUPLICATE_KEY_WITHOUT_CHILD_INFO',
]);

/**
 * MySQL permission codes — privilege denied on an authenticated session
 * (table / column / DB / proc / kill). Distinct from
 * `MYSQL_CONNECTION_CODES.ER_ACCESS_DENIED_ERROR` which fires at handshake.
 */
const MYSQL_PERMISSION_CODES = new Set([
  'ER_TABLEACCESS_DENIED_ERROR',
  'ER_COLUMNACCESS_DENIED_ERROR',
  'ER_DBACCESS_DENIED_ERROR',
  'ER_PROCACCESS_DENIED_ERROR',
  'ER_SPECIFIC_ACCESS_DENIED_ERROR',
  'ER_KILL_DENIED_ERROR',
]);

function classifyDbError(
  driverCode: string | undefined,
  driver: 'postgres' | 'mysql',
): DbRuntimeErrorCode {
  if (!driverCode) return 'DB_QUERY_FAILED';

  // Node-style errno (uppercase E… on either driver) + mysql2 protocol
  // codes — connection issues.
  if (CONNECTION_ERRNOS.has(driverCode)) return 'DB_CONNECTION_ERROR';

  if (driver === 'postgres') {
    return classifyPostgresSqlState(driverCode);
  }
  return classifyMysqlCode(driverCode);
}

function classifyPostgresSqlState(code: string): DbRuntimeErrorCode {
  // PostgreSQL SQLSTATE is a 5-char string. The first 2 chars name the
  // class; we special-case the classes that map cleanly to our enum.
  // https://www.postgresql.org/docs/current/errcodes-appendix.html
  if (code.length !== 5) return 'DB_QUERY_FAILED';
  // 42501 = insufficient_privilege — must precede the generic class
  // switch below because class 42 (syntax_error_or_access_rule_violation)
  // otherwise routes to DB_QUERY_FAILED.
  if (code === '42501') return 'DB_PERMISSION_DENIED';
  const klass = code.slice(0, 2);
  if (klass === '23') return 'DB_CONSTRAINT_VIOLATION';
  // Class 08 (connection_exception) and class 28
  // (invalid_authorization_specification) both fire at connect /
  // handshake. We bucket 28 with connection rather than permission for
  // cross-driver symmetry with mysql2's `ER_ACCESS_DENIED_ERROR` (also
  // handshake-time → DB_CONNECTION_ERROR), so workflows that retry on
  // credential rotation behave the same on either driver.
  if (klass === '08' || klass === '28') return 'DB_CONNECTION_ERROR';
  // Class 53 (insufficient_resources, e.g. too_many_connections) and
  // class 57 (operator_intervention, e.g. admin_shutdown / cannot_connect_now)
  // are retry-worthy transport-level failures.
  if (klass === '53' || klass === '57') return 'DB_CONNECTION_ERROR';
  return 'DB_QUERY_FAILED';
}

function classifyMysqlCode(code: string): DbRuntimeErrorCode {
  if (MYSQL_CONNECTION_CODES.has(code)) return 'DB_CONNECTION_ERROR';
  if (MYSQL_CONSTRAINT_CODES.has(code)) return 'DB_CONSTRAINT_VIOLATION';
  if (MYSQL_PERMISSION_CODES.has(code)) return 'DB_PERMISSION_DENIED';
  return 'DB_QUERY_FAILED';
}
