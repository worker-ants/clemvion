import { Logger } from '@nestjs/common';
import { Pool, Client as PgClient } from 'pg';
import {
  createPool as mysqlCreatePool,
  createConnection as mysqlCreateConnection,
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
import type { Integration } from '../../../modules/integrations/entities/integration.entity.js';
import { IntegrationCacheBus } from '../../../common/redis/integration-cache-bus.service.js';
import {
  SSRF_GUARD_FAILED_CLIENT_MESSAGE,
  SsrfBlockedError,
  assertSafeOutboundHostResolved,
} from '../../../common/utils/ssrf/outbound-guard.js';
import { buildDryRunMock, isDryRun } from '../../core/dry-run.util.js';
import { isAbortErrorLike } from '../../core/abort-error.util.js';
import { databaseQueryNodeMetadata } from './database-query.schema.js';
import {
  DB_HOST_BLOCKED_MESSAGE,
  DbCredentials,
  buildMysqlSsl,
  buildPgConnection,
} from './database-connection.js';

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

/**
 * `config.queryType` 의 타입. UI 가 명시하는 리터럴 유니언이 1차이지만,
 * 검증 전 rawConfig 에서 임의 문자열/누락이 흘러올 수 있어 `| string`/`undefined`
 * 로 넓힌다. {@link isWriteOperation} 의 파라미터 타입과 동일.
 */
// `| string` 대신 `| (string & {})` — 리터럴 유니언이 `string` 에 흡수돼
// 사라지는 것(@typescript-eslint/no-redundant-type-constituents)을 피하면서도
// UI 가 명시하는 리터럴의 autocomplete 를 보존한다. 런타임/할당 호환은 `string` 과 동일.
export type QueryType =
  (typeof ALLOWED_QUERY_TYPES)[number] | (string & {}) | undefined;

const POOL_MAX_CONNECTIONS = 5;
const POOL_IDLE_TIMEOUT_MS = 30_000;
// in-flight 취소용 일회성 연결의 connect / 취소-쿼리 timeout (짧게 — best-effort).
const CANCEL_CONNECT_TIMEOUT_MS = 2_000;
const CANCEL_QUERY_TIMEOUT_MS = 2_000;
const logger = new Logger('DatabaseQueryHandler');

/** `AbortError` (name 기반) — 엔진이 `cancelled` 로 분류하는 표준 취소 에러. */
function makeAbortError(): Error {
  const err = new Error('Operation aborted');
  err.name = 'AbortError';
  return err;
}

/**
 * `promise` 가 settle 하거나 `ms` 경과 중 먼저 발생하는 시점에 resolve(항상 void,
 * 절대 reject 안 함). 취소 명령이 무한 pending 해 호출부의 `release()` 를 막지
 * 않도록 상한을 건다 — 타임아웃 시 호출부의 `end()` 가 일회성 연결을 닫아 서버측
 * pending 쿼리도 함께 정리된다.
 */
function settleWithin(promise: Promise<unknown>, ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    void promise
      .catch(() => {})
      .finally(() => {
        clearTimeout(timer);
        resolve();
      });
  });
}

/** PG `57014 query_canceled` — 우리가 발행한 `pg_cancel_backend` 로 인한 취소. */
function isPgQueryCanceled(err: unknown): boolean {
  return err instanceof Error && (err as { code?: string }).code === '57014';
}

/** MySQL `ER_QUERY_INTERRUPTED`(1317) — 우리가 발행한 `KILL QUERY` 로 인한 취소. */
function isMysqlQueryInterrupted(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const e = err as { code?: string; errno?: number };
  return e.code === 'ER_QUERY_INTERRUPTED' || e.errno === 1317;
}

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

  /**
   * 04 m-4 — bus 에 등록하는 invalidator 의 안정적 참조. register 가 받는 `Set` 은
   * 동일 함수 참조에만 idempotent 하므로, 매 등록마다 새 arrow 를 만들지 않고 인스턴스
   * 프로퍼티로 고정해 (비싱글톤 시나리오의) 중복 누적을 원천 차단한다.
   */
  private readonly invalidatePoolOnBroadcast = (
    integrationId: string,
  ): void => {
    void this.invalidatePool(integrationId);
  };

  constructor(
    integrationsService?: IntegrationsService,
    integrationCacheBus?: IntegrationCacheBus,
  ) {
    super(integrationsService);
    // refactor 04 m-4 — credential 회전이 타 인스턴스에서 발생하면 pub/sub 으로
    // 통지받아 해당 integrationId 풀을 즉시 evict 한다. bus 미주입(레거시 fixture)
    // 시엔 §resolvePgPool/resolveMysqlPool 의 credsHash 비교 evict 로 degrade.
    integrationCacheBus?.register(this.invalidatePoolOnBroadcast);
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
    // 후 dispatch 된 케이스) 즉시 throw. 진행 중(in-flight) abort 는 driver 별
    // cancel(§2.1)로 처리한다 — PG `pg_cancel_backend(pid)` / MySQL `KILL QUERY
    // <threadId>` 를 **일회성 별도 연결**로 발행(executePostgres/executeMysql). 취소로
    // 인한 driver 에러(57014/ER_QUERY_INTERRUPTED)만 `AbortError` 로 재throw 해 `cancelled` 분류.
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
      queryType: (rawConfig.queryType ?? 'select') as QueryType,
      parameters: rawConfig.parameters,
    };

    // D4 (2026-05-17, plan/in-progress/node-output-redesign) — Integration
    // 4종 모두 send-email 의 catch-all 패턴으로 통일. handler.validate() 가
    // 거른 config 형식 오류만 throw, 그 외 IntegrationError / parameters
    // 파싱 실패 / 통합 얻기 · 검증 실패 / SSRF guard 실패 모두 catch 후
    // port:'error' 로 라우팅. fallback 코드는 INTEGRATION_CALL_FAILED.
    let driver: 'postgres' | 'mysql' = 'postgres';
    // INT-US-05 — api_method 는 SQL 첫 토큰 (`SELECT` / `INSERT` / ...). 첫
    // 토큰이 동사가 아닌 경우 (raw 쿼리 분기 등) 는 NULL fallback. api_path 는
    // 확정된 driver 토큰 — 그 전엔 default 'postgres'.
    const apiMethod = extractSqlVerb(query);

    // dry-run 재실행([Database Query 「dry-run」](CLE-NODE-DBQUERY#dry-run)): config 검증 · 에코
    // 직후, DB 연결을 열기 전에 쓰기와 판정이 애매한 쿼리를 mock 으로 끝낸다. 읽기 동사(SELECT 등)만
    // 아래 실제 실행 경로로 흐른다. 판정은 `isWriteOperation` 이 한다. mock 경로는 pool/connect 를
    // 부르지 않고 success 포트로 흐른다. sqlPreview 는 SQL 앞 ~200자만 노출(바인딩 값은 미포함).
    if (isDryRun(context) && isWriteOperation(configEcho.queryType, query)) {
      const sqlPreview =
        typeof query === 'string' ? query.slice(0, 200) : undefined;
      return {
        config: configEcho,
        output: buildDryRunMock('database_query', {
          operation: configEcho.queryType,
          sqlPreview,
        }),
        meta: { durationMs: 0 },
        port: 'success',
      };
    }

    // 얻은 통합. 활동 로그는 이 통합에만 남긴다 — 얻기 전에 끝난 실패(파라미터 파싱 · 서비스 미주입 · 워크스페이스
    // 확인 · 조회 거절 · 조회 중 일시 오류)는 기록하지 않는다(REQ-INTMGMT-053 · 062).
    let integration: Integration | undefined;
    try {
      const parameters = parseParameters(config.parameters);

      if (!this.integrationsService) {
        throw new IntegrationError(
          'INTEGRATION_SERVICE_UNAVAILABLE',
          'Database node requires an integrations service to be configured',
        );
      }

      integration = await this.acquireIntegration(integrationId, context);
      this.assertUsable(integration, 'database');
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
      // 차단 시 공용 guard 의 plain Error 를 전용 `DB_HOST_BLOCKED` 로 승격해
      // HTTP(`HTTP_BLOCKED`)·Email(`EMAIL_HOST_BLOCKED`)과 대칭으로 surface 한다.
      // 메시지는 차단된 host/IP 를 노출하지 않는 일반화 문구 — 정찰 면 축소
      // (원본 상세는 logUsage 의 toLogError 로 서버 로그에만 남는다).
      if (creds.host) {
        try {
          await assertSafeOutboundHostResolved(creds.host);
        } catch (err) {
          const detail = err instanceof Error ? err.message : String(err);
          // 판정은 `SsrfBlockedError` 하나뿐이다 — 그 밖의 오류는 가드의 고장이지 차단이 아니므로 «당신의 host 가
          // 막혔다» 로 보고하지 않는다. 분류되지 않은 실패(`INTEGRATION_CALL_FAILED`, 공통 §4.2)로 승격해 아래
          // catch 가 code 를 보존하게 한다 — 그냥 던지면 `mapDbError` 가 `DB_QUERY_FAILED` 를 매기는데 쿼리는
          // 시작도 안 했고, 같은 실패를 적는 usage 로그(`toLogError`)와도 코드가 어긋난다.
          if (!(err instanceof SsrfBlockedError)) {
            logger.warn(`SSRF guard failed (database-query): ${detail}`);
            // 원본 객체를 `cause` 로 붙이지 않는다 — 가드가 앞으로 어떤 오류를 던질지 모르고
            // (`spec/5-system/3-error-handling.md` §6.3.1 C2: message·name 밖의 속성이 통째로 딸려 온다),
            // 이 에러는 Activity API 로 나가는 노드 에러다. 원본 상세는 위 `logger.warn` 에만 남고 사용자에게는
            // 고정 문구를 낸다(CLE-T-E991S1).
            throw new IntegrationError(
              'INTEGRATION_CALL_FAILED',
              SSRF_GUARD_FAILED_CLIENT_MESSAGE,
            );
          }
          // 차단 판정의 원문에는 차단된 host/IP 가 들어 있어 `cause` 로도 싣지 않는다(정찰 면 축소 — 일반화
          // 문구만 내보낸다). 원본 상세는 아래 catch 의 `toLogError` 가 서버 로그로 남긴다.
          throw new IntegrationError(
            'DB_HOST_BLOCKED',
            DB_HOST_BLOCKED_MESSAGE,
          );
        }
      }

      driver = creds.driver ?? 'postgres';
      const result =
        driver === 'mysql'
          ? await this.executeMysql(
              integrationId,
              creds as DbCredentials,
              query,
              parameters,
              context.abortSignal,
            )
          : await this.executePostgres(
              integrationId,
              creds as DbCredentials,
              query,
              parameters,
              context.abortSignal,
            );
      const durationMs = Date.now() - start;
      await this.logUsage(integration, context, {
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
      // [노드 취소](CLE-EXEC-CANCEL#노드-핸들러-의무) — in-flight 취소로
      // `executePostgres`/`executeMysql` 이 던진 `AbortError` (쿼리 취소로 driver 가
      // reject → AbortError 승격)는 D4 error-포트 매핑을 우회해 그대로 재throw →
      // 엔진이 노드를 `cancelled` 로 분류(규칙 19). 취소된 호출은 활동 로그를 남기지
      // 않으므로(규칙 3) `logUsage` 보다 먼저 판정한다. `abortSignal.aborted` 광의
      // 판정이 아니라 **실제 AbortError 만** 재throw 해, 취소와 무관한 실패
      // (resolve/SSRF/파라미터 파싱 등)를 오분류하지 않는다.
      if (isAbortErrorLike(err)) {
        throw err;
      }
      const durationMs = Date.now() - start;
      if (integration) {
        await this.logUsage(integration, context, {
          status: 'failed',
          durationMs,
          error: toLogError(err),
          api: { method: apiMethod, path: driver },
        }).catch(() => {});
      }
      // D4 — IntegrationError (resolve / missingDbFields / parseParameters /
      // SSRF 차단 → `DB_HOST_BLOCKED` 등) 는 그대로 code 를 surface, 그 외 (SQL
      // throw 등) 는 driver-specific mapper 로 분류. SSRF 가드가 던진 것은 위에서
      // 두 갈래로 승격돼 온다 — 차단 판정은 `DB_HOST_BLOCKED`, 판정 아닌 오류(가드의
      // 고장)는 `INTEGRATION_CALL_FAILED`. 둘 다 IntegrationError 라 여기서 code 가
      // 보존되고 `mapDbError` 로는 흐르지 않는다.
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
    abortSignal?: AbortSignal,
  ): Promise<Record<string, unknown>> {
    const pool = this.resolveMysqlPool(integrationId, creds);
    // mysql2 uses `?` placeholders. Convert `$1, $2, ...` from the
    // PostgreSQL-flavoured UI hint into positional `?` marks. Parameters
    // are still bound positionally against `parameters[]`.
    const sql = convertPgPlaceholders(query);
    // getConnection 으로 명시 획득 — in-flight cancel(§2.1)에 connection `threadId`
    // 가 필요하다. abort 시 **일회성 별도 연결**로 `KILL QUERY <threadId>` 를 발행해
    // 진행 중 쿼리만 끊는다(연결은 유지). best-effort — 권한(PROCESS)·타이밍에 의존.
    const connection = await pool.getConnection();
    // connect 대기 중 abort → 쿼리 시작 없이 즉시 취소(pre-dispatch 와 동일).
    if (abortSignal?.aborted) {
      connection.release();
      throw makeAbortError();
    }
    const threadId =
      typeof connection.threadId === 'number' ? connection.threadId : undefined;
    let cancelPromise: Promise<void> | undefined;
    const onAbort = () => {
      cancelPromise = this.cancelMysqlQuery(creds, threadId);
    };
    if (abortSignal)
      abortSignal.addEventListener('abort', onAbort, { once: true });
    try {
      const [rawRows, fields] = await connection.query(sql, parameters);
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
    } catch (err) {
      // 우리가 발행한 `KILL QUERY` 로 인한 취소(ER_QUERY_INTERRUPTED)만 `AbortError`
      // 로 승격(→ cancelled, §5). abort 중 우연히 겹친 무관한 실패는 원래 에러 그대로
      // 보존(오분류 방지, ai-review WARNING).
      if (abortSignal?.aborted && isMysqlQueryInterrupted(err)) {
        throw makeAbortError();
      }
      throw err;
    } finally {
      if (abortSignal) abortSignal.removeEventListener('abort', onAbort);
      // 취소 명령을 connection 반환 **전에** 완료시킨다 — 지연된 취소가 재사용된
      // 연결의 무관한 쿼리를 죽이는 것을 방지(cancelPromise 는 절대 reject 안 함).
      if (cancelPromise) await cancelPromise;
      connection.release();
    }
  }

  private async executePostgres(
    integrationId: string,
    creds: DbCredentials,
    query: string,
    parameters: unknown[],
    abortSignal?: AbortSignal,
  ): Promise<Record<string, unknown>> {
    const pool = this.resolvePgPool(integrationId, creds);
    const client = await pool.connect();
    // connect 대기 중 abort → 쿼리 시작 없이 즉시 취소(pre-dispatch 와 동일).
    if (abortSignal?.aborted) {
      client.release();
      throw makeAbortError();
    }
    // in-flight cancel(§2.1): abort 시 backend PID 로 **일회성 별도 연결**에서
    // `pg_cancel_backend` 를 발행해 진행 중 쿼리를 57014 로 취소한다(연결은 유지).
    // `processID` 는 런타임엔 존재하나 `PoolClient` 타입에 미선언 → 명시 cast.
    const pid = (client as unknown as { processID?: number }).processID;
    let cancelPromise: Promise<void> | undefined;
    const onAbort = () => {
      cancelPromise = this.cancelPgBackend(creds, pid);
    };
    if (abortSignal)
      abortSignal.addEventListener('abort', onAbort, { once: true });
    try {
      const result = await client.query(query, parameters);
      return {
        rows: result.rows,
        rowCount: result.rowCount ?? result.rows.length,
        fields: result.fields?.map((f) => ({
          name: f.name,
          dataTypeID: f.dataTypeID,
        })),
      };
    } catch (err) {
      // 우리가 발행한 `pg_cancel_backend` 로 인한 취소(57014)만 `AbortError` 로 승격
      // (→ cancelled, §5). 무관한 실패는 원래 에러 보존(오분류 방지).
      if (abortSignal?.aborted && isPgQueryCanceled(err)) {
        throw makeAbortError();
      }
      throw err;
    } finally {
      if (abortSignal) abortSignal.removeEventListener('abort', onAbort);
      if (cancelPromise) await cancelPromise;
      client.release();
    }
  }

  /**
   * PG in-flight 취소 — 캐시 pool 과 **분리된 일회성 연결**로 `pg_cancel_backend`
   * 를 발행한다. 공유 pool 을 쓰면 pool 포화 시(취소가 가장 필요한 상황) 취소가
   * 빈 슬롯을 기다리다 데드락에 빠지므로 전용 연결을 쓴다. connect timeout 을 짧게
   * 걸어 무한 대기를 막고, 실패는 삼켜 best-effort 유지(절대 reject 안 함).
   */
  private async cancelPgBackend(
    creds: DbCredentials,
    pid: number | undefined,
  ): Promise<void> {
    if (typeof pid !== 'number') return;
    const client = new PgClient({
      ...buildPgConnection(creds),
      connectionTimeoutMillis: CANCEL_CONNECT_TIMEOUT_MS,
    });
    try {
      await client.connect();
      // 취소 쿼리에도 상한 — pending 시 finally 의 end() 가 연결을 닫아 정리.
      await settleWithin(
        client.query('SELECT pg_cancel_backend($1)', [pid]),
        CANCEL_QUERY_TIMEOUT_MS,
      );
    } catch (err) {
      logger.debug(
        `pg in-flight cancel best-effort 실패: ${sanitizeMessage(err instanceof Error ? err.message : String(err))}`,
      );
    } finally {
      await client.end().catch(() => {});
    }
  }

  /**
   * MySQL in-flight 취소 — 일회성 별도 연결로 `KILL QUERY <threadId>` 발행.
   * (PG 와 동일한 pool-격리·타임아웃·best-effort 정책.)
   */
  private async cancelMysqlQuery(
    creds: DbCredentials,
    threadId: number | undefined,
  ): Promise<void> {
    if (typeof threadId !== 'number') return;
    let connection:
      Awaited<ReturnType<typeof mysqlCreateConnection>> | undefined;
    try {
      connection = await mysqlCreateConnection({
        host: creds.host,
        port: creds.port,
        user: creds.username,
        password: creds.password,
        database: creds.database,
        ssl: buildMysqlSsl(creds.ssl),
        connectTimeout: CANCEL_CONNECT_TIMEOUT_MS,
      });
      // threadId 는 driver 정수라 문자열 보간이 injection-safe.
      await settleWithin(
        connection.query(`KILL QUERY ${threadId}`),
        CANCEL_QUERY_TIMEOUT_MS,
      );
    } catch (err) {
      logger.debug(
        `mysql in-flight cancel best-effort 실패: ${sanitizeMessage(err instanceof Error ? err.message : String(err))}`,
      );
    } finally {
      if (connection) await connection.end().catch(() => {});
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

    // `multipleStatements` 는 켜지 않는다(mysql2 기본값 false). 켜면 `;` 뒤 두 번째 문장도 실행된다.
    // dry-run 판정(`isWriteOperation`)은 판정할 수 없는 모양을 mock 으로 보내지만 문자 단위 스캔이라
    // 이 설정이 마지막 방어선이다.
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

/**
 * dry-run 부수효과 판정에서 읽기로 보는 SQL 첫 동사. 이 목록에 있으면 dry-run 에서도 실제로 실행한다.
 * `EXPLAIN` 은 넣지 않는다. PostgreSQL `EXPLAIN ANALYZE` 는 대상 문장을 실제로 실행한다.
 */
const SQL_READ_VERBS = new Set([
  'SELECT',
  'SHOW',
  'DESCRIBE',
  'DESC',
  'VALUES',
  'TABLE',
]);

/**
 * dry-run 판정 스캐너가 SQL 을 읽는 방언. 판정은 통합을 얻기 전이라 드라이버를 모른다. 그래서 같은 SQL 을
 * 두 방언으로 한 번씩 읽고 둘 다 «읽기 한 문장» 일 때만 실행한다({@link isWriteOperation}).
 */
type SqlDialect = 'postgres' | 'mysql';

const SQL_DIALECTS: readonly SqlDialect[] = ['postgres', 'mysql'];

/**
 * 스캐너 한 걸음의 결과.
 * - `none`: 그 위치에 해당 구문(주석 · 인용 등)이 없다.
 * - `skip`: 그 구문을 건너뛴 다음 위치가 `next` 다.
 * - `ambiguous`: 두 엔진이 다르게 읽을 수 있거나 닫히지 않아 판정할 수 없다. 호출한 쪽은 mock 으로 본다.
 */
type SqlSkip =
  { kind: 'none' } | { kind: 'skip'; next: number } | { kind: 'ambiguous' };

const SQL_NONE: SqlSkip = { kind: 'none' };
const SQL_AMBIGUOUS: SqlSkip = { kind: 'ambiguous' };

/** `pos` 부터 줄 끝(다음 `\n` 뒤)까지 건너뛴다. */
function skipToLineEnd(sql: string, pos: number): SqlSkip {
  const nl = sql.indexOf('\n', pos);
  return { kind: 'skip', next: nl < 0 ? sql.length : nl + 1 };
}

/**
 * `pos` 에서 시작하는 주석 하나를 건너뛴다.
 *
 * - `--` 뒤에 공백이 아닌 문자가 붙어 있으면 `ambiguous` 다. MySQL 은 `--` 뒤에 ASCII 공백 · 제어 문자가 있어야
 *   주석으로 읽고(NBSP · U+2028 · U+3000 같은 유니코드 공백은 공백이 아니다) PostgreSQL 은 늘 주석으로 읽는다.
 * - `#` 는 MySQL 에서만 줄 주석이다. PostgreSQL 에서는 연산자(`#>` 등)라 주석이 아니다.
 * - 블록 주석이 닫히지 않았거나 안에 `/*` 가 또 있으면(PostgreSQL 만 중첩을 허용) `ambiguous` 다.
 * - MySQL 실행 주석 `/*!` 는 안쪽을 SQL 로 실행하므로 MySQL 에서 `ambiguous` 다.
 * - `leading` 이면(동사 앞) 힌트 `/*+` 블록도 `ambiguous` 다. 힌트는 동사 뒤에만 둔다.
 */
function skipSqlComment(
  sql: string,
  pos: number,
  dialect: SqlDialect,
  leading: boolean,
): SqlSkip {
  if (sql.startsWith('--', pos)) {
    const next = sql[pos + 2];
    // ASCII 공백 · 제어 문자(0x00-0x20, 0x7f)만 공백으로 본다.
    if (
      next !== undefined &&
      next.charCodeAt(0) > 0x20 &&
      next.charCodeAt(0) !== 0x7f
    )
      return SQL_AMBIGUOUS;
    return skipToLineEnd(sql, pos);
  }
  if (dialect === 'mysql' && sql[pos] === '#') return skipToLineEnd(sql, pos);
  if (sql.startsWith('/*', pos)) {
    if (dialect === 'mysql' && sql[pos + 2] === '!') return SQL_AMBIGUOUS;
    if (leading && sql[pos + 2] === '+') return SQL_AMBIGUOUS;
    const close = sql.indexOf('*/', pos + 2);
    if (close < 0) return SQL_AMBIGUOUS;
    if (sql.slice(pos + 2, close).includes('/*')) return SQL_AMBIGUOUS;
    return { kind: 'skip', next: close + 2 };
  }
  return SQL_NONE;
}

/**
 * `from` 부터 공백과 주석을 모두 건너뛴 위치를 `skip` 으로 돌려준다(건너뛸 것이 없으면 `next === from`).
 * 판정할 수 없는 주석을 만나면 `ambiguous` 다.
 */
function skipSqlBlank(
  sql: string,
  from: number,
  dialect: SqlDialect,
  leading: boolean,
): SqlSkip {
  let pos = from;
  for (;;) {
    while (pos < sql.length && /\s/.test(sql[pos])) pos += 1;
    const comment = skipSqlComment(sql, pos, dialect, leading);
    if (comment.kind === 'ambiguous') return comment;
    if (comment.kind === 'none') return { kind: 'skip', next: pos };
    pos = comment.next;
  }
}

/**
 * `pos` 에서 시작하는 문자열 리터럴 · 따옴표 식별자 · 달러 인용 하나를 건너뛴다.
 *
 * - 작은따옴표 리터럴 안에 백슬래시가 있으면 `ambiguous` 다. MySQL 은 이스케이프로 읽고 PostgreSQL 은
 *   (`E'…'` 가 아니면) 글자로 읽는다.
 * - 큰따옴표는 PostgreSQL 에서 식별자(백슬래시 이스케이프 없음)다. MySQL 기본 모드에서는 백슬래시
 *   이스케이프가 있는 문자열이고 `ANSI_QUOTES` 모드에서는 식별자다. 그래서 MySQL 에서 큰따옴표 안에
 *   백슬래시가 있으면 `ambiguous` 다.
 * - 백틱은 두 방언 모두 따옴표로 본다. MySQL 식별자이고, PostgreSQL 은 백틱을 구문 오류로 거절해 문자열
 *   전체가 실행되지 않는다.
 * - 달러 인용(`$$…$$` · `$tag$…$tag$`)은 PostgreSQL 에서만 인용이다. MySQL 에서 `$` 는 식별자 글자다.
 * - 같은 따옴표를 두 번 쓰면 따옴표 글자 하나다. 닫히지 않았으면 `ambiguous` 다.
 */
function skipSqlQuoted(sql: string, pos: number, dialect: SqlDialect): SqlSkip {
  const ch = sql[pos];
  if (ch === "'" || ch === '"' || ch === '`') {
    const backslashAmbiguous =
      ch === "'" || (ch === '"' && dialect === 'mysql');
    let i = pos + 1;
    for (;;) {
      const close = sql.indexOf(ch, i);
      if (close < 0) return SQL_AMBIGUOUS;
      if (backslashAmbiguous && sql.slice(pos + 1, close).includes('\\')) {
        return SQL_AMBIGUOUS;
      }
      if (sql[close + 1] === ch) {
        i = close + 2;
        continue;
      }
      return { kind: 'skip', next: close + 1 };
    }
  }
  if (ch === '$' && dialect === 'postgres') {
    const prev = pos > 0 ? sql[pos - 1] : '';
    if (/[A-Za-z0-9_$]/.test(prev)) return SQL_NONE;
    const tag = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(pos));
    if (!tag) return SQL_NONE;
    const close = sql.indexOf(tag[0], pos + tag[0].length);
    return close < 0
      ? SQL_AMBIGUOUS
      : { kind: 'skip', next: close + tag[0].length };
  }
  return SQL_NONE;
}

/**
 * dry-run 판정용으로 SQL 을 한 방언으로 읽는다. 첫 문장의 동사(대문자)와 `multi` 를 돌려준다. `multi` 는
 * 첫 문장을 끝내는 `;` 뒤에 공백 · 주석이 아닌 내용이 더 있으면 true 다. 동사를 못 찾거나 판정할 수 없는
 * 모양이면 NULL 이다. 호출한 쪽은 NULL 을 쓰기로 본다.
 *
 * - 동사 앞의 공백 · 주석은 건너뛴다. 동사 앞의 `/*+` 힌트 블록은 건너뛰지 않고 NULL 이다.
 * - 첫 문장 안에서 문자열 리터럴 · 따옴표 식별자 · 주석 · (PostgreSQL) 달러 인용 속의 `;` 는 문장 끝이 아니다.
 * - 끝에 붙은 `;` 하나와 그 뒤 공백 · 주석은 `multi` 를 바꾸지 않는다.
 *
 * 활동 로그 `api_method` 는 이 함수를 쓰지 않고 {@link extractSqlVerb} 를 그대로 쓴다.
 */
function scanSql(
  query: string,
  dialect: SqlDialect,
): { verb: string; multi: boolean } | null {
  const start = skipSqlBlank(query, 0, dialect, true);
  if (start.kind !== 'skip') return null;
  const verb = extractSqlVerb(query.slice(start.next));
  if (verb === null) return null;
  let pos = start.next + verb.length;
  while (pos < query.length) {
    const quoted = skipSqlQuoted(query, pos, dialect);
    if (quoted.kind === 'ambiguous') return null;
    if (quoted.kind === 'skip') {
      pos = quoted.next;
      continue;
    }
    const comment = skipSqlComment(query, pos, dialect, false);
    if (comment.kind === 'ambiguous') return null;
    if (comment.kind === 'skip') {
      pos = comment.next;
      continue;
    }
    if (query[pos] === ';') {
      const tail = skipSqlBlank(query, pos + 1, dialect, false);
      if (tail.kind !== 'skip') return null;
      return { verb, multi: tail.next < query.length };
    }
    pos += 1;
  }
  return { verb, multi: false };
}

/** 한 방언으로 읽었을 때 읽기 동사 하나로 된 한 문장인지 본다. */
function isSingleReadStatement(query: string, dialect: SqlDialect): boolean {
  const scanned = scanSql(query, dialect);
  return scanned !== null && !scanned.multi && SQL_READ_VERBS.has(scanned.verb);
}

/**
 * dry-run 재실행의 부수효과 판정([Database Query 「dry-run」](CLE-NODE-DBQUERY#dry-run)).
 * true 면 DB 에 연결하지 않고 mock 으로 끝낸다(REQ-DBQ-025), false 면 실제로 실행한다(REQ-DBQ-026).
 *
 * - `queryType` 이 `insert` · `update` · `delete` 면 SQL 과 관계없이 쓰기다.
 * - 그 밖(`select` · `raw` · 누락)은 `queryType` 을 믿지 않고 SQL 첫 동사를 본다. 기본값 `select` 로 둔
 *   `DELETE` 가 dry-run 에서 실행되던 결함을 막는다(CLE-T-KH11HA).
 * - 첫 동사가 {@link SQL_READ_VERBS} 에 있을 때만 읽기다. 쓰기 동사와 판정이 애매한 쿼리
 *   (`WITH` · `CALL` · `DO` · `COPY` · `EXPLAIN`, 괄호로 시작 등)는 안전 쪽(mock)으로 본다.
 *   «애매하면 mock» 은 [Database Query 「dry-run」](CLE-NODE-DBQUERY#dry-run) 의 결정이다.
 * - 첫 문장 뒤에 `;` 로 이어지는 다른 내용이 있으면(`SELECT 1; DELETE …`) mock 이다. 끝에 붙은 `;` 하나와
 *   그 뒤 공백 · 주석은 읽기 판정을 바꾸지 않는다.
 * - 판정 시점에는 드라이버를 모른다. 그래서 PostgreSQL · MySQL 두 방언으로 한 번씩 읽고 둘 다 읽기 한
 *   문장일 때만 실행한다. 한 방언에서 리터럴 · 주석이고 다른 방언에서 문장 끝인 `;`(MySQL `#` 줄 주석,
 *   큰따옴표 안 백슬래시, PostgreSQL 달러 인용)는 이 규칙으로 mock 이 된다.
 * - 맨 앞이 MySQL 실행 주석 `/*!` 이거나 힌트 `/*+` 이면 mock 이다. 닫히지 않은 따옴표 · 주석, 백슬래시가
 *   든 작은따옴표 리터럴, 중첩 블록 주석, 공백 없이 붙은 `--` 처럼 엔진마다 읽는 법이 다를 수 있는 모양도
 *   mock 이다.
 *
 * 한계: `SELECT write_func()` · `SELECT … INTO new_table` 처럼 SELECT 로 시작하지만 데이터를 바꾸는
 * 쿼리는 읽기로 보고 실행한다. 파서가 아니라 문자 단위 스캔이라 위에 적은 모양 밖의 방언 문법은 모른다.
 */
export function isWriteOperation(
  queryType: QueryType,
  query: string | undefined,
): boolean {
  if (
    queryType === 'insert' ||
    queryType === 'update' ||
    queryType === 'delete'
  ) {
    return true;
  }
  if (!query) return true;
  return !SQL_DIALECTS.every((dialect) =>
    isSingleReadStatement(query, dialect),
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
