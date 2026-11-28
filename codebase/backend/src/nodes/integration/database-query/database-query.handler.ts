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
  assertSafeOutboundHostResolved,
} from '../../../common/utils/ssrf/outbound-guard.js';
import {
  findConnectTimeBlock,
  runSsrfPreflight,
} from '../../../common/utils/ssrf/guard-outcome.js';
import { buildDryRunMock, isDryRun } from '../../core/dry-run.util.js';
import { isAbortErrorLike } from '../../core/abort-error.util.js';
import { databaseQueryNodeMetadata } from './database-query.schema.js';
import {
  DB_HOST_BLOCKED_MESSAGE,
  DbCredentials,
  buildMysqlConnection,
  buildPgConnection,
} from './database-connection.js';
import {
  convertMysqlPlaceholders,
  extractSqlVerb,
  isWriteOperation,
} from './sql-scan.js';

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
 * 로 넓힌다. {@link isWriteOperation} 은 같은 값을 `string | undefined` 로 받는다.
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
   * CLE-NODE-DBQUERY 「풀 캐시 무효화」 — bus 에 등록하는 invalidator 의 안정적 참조. register 가 받는 `Set` 은
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
    // CLE-NODE-DBQUERY 「풀 캐시 무효화」 — credential 회전이 타 인스턴스에서 발생하면 pub/sub 으로
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
    // 쿼리를 시작했는지. 시작 전에 잡힌 `IntegrationError` 아닌 예외(통합 조회 거절 `RESOURCE_NOT_FOUND`, 조회 중
    // 일시 오류 등)는 사용자 DB 의 실패가 아니라서 `mapDbError` 로 분류하지 않는다(아래 catch, CLE-T-MWR7C5).
    let queryStarted = false;
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
      // `runSsrfPreflight` 가 돌려준 판정이 `blocked` 면 전용 `DB_HOST_BLOCKED` 로 던져
      // HTTP(`HTTP_BLOCKED`)·Email(`EMAIL_HOST_BLOCKED`)과 대칭으로 surface 한다.
      // 메시지는 차단된 host/IP 를 노출하지 않는 일반화 문구 — 정찰 면 축소.
      // 판정 원문(host · IP)은 헬퍼가 서버 경고 로그에만 남긴다(CLE-T-CT6SHS · CLE-T-NTKWWV). 활동 로그(`toLogError`)는
      // 이 일반화 문구만 받으므로 원문이 없다.
      if (creds.host) {
        const host = creds.host;
        const preflight = await runSsrfPreflight(
          () => assertSafeOutboundHostResolved(host),
          logger,
          'database-query',
        );
        if (preflight === 'guard_failed') {
          // 판정이 아닌 오류는 가드의 고장이지 차단이 아니므로 «당신의 host 가 막혔다» 로 보고하지 않는다. 분류되지
          // 않은 실패(`INTEGRATION_CALL_FAILED`, 공통 §4.2)로 승격해 아래 catch 가 code 를 보존하게 한다 — 그냥 던지면
          // `mapDbError` 가 `DB_QUERY_FAILED` 를 매기는데 쿼리는 시작도 안 했고, 같은 실패를 적는 usage 로그
          // (`toLogError`)와도 코드가 어긋난다. 원본 오류를 `cause` 로 붙이지 않는다 — 가드가 앞으로 어떤 오류를 던질지
          // 모르고 이 에러는 Activity API 로 나가는 노드 에러다. 사용자에게는 고정 문구를 낸다(CLE-T-E991S1).
          throw new IntegrationError(
            'INTEGRATION_CALL_FAILED',
            SSRF_GUARD_FAILED_CLIENT_MESSAGE,
          );
        }
        if (preflight === 'blocked') {
          // 차단 판정의 원문에는 차단된 host/IP 가 들어 있어 `cause` 로도 싣지 않는다(정찰 면 축소 — 일반화 문구만
          // 내보낸다). 연결 시점 차단(`promoteConnectTimeBlock`)과 같은 규칙이다.
          throw new IntegrationError(
            'DB_HOST_BLOCKED',
            DB_HOST_BLOCKED_MESSAGE,
          );
        }
      }

      driver = creds.driver ?? 'postgres';
      queryStarted = true;
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
    } catch (err_) {
      // [노드 취소](CLE-EXEC-CANCEL#노드-핸들러-의무) — in-flight 취소로
      // `executePostgres`/`executeMysql` 이 던진 `AbortError` (쿼리 취소로 driver 가
      // reject → AbortError 승격)는 D4 error-포트 매핑을 우회해 그대로 재throw →
      // 엔진이 노드를 `cancelled` 로 분류(규칙 19). 취소된 호출은 활동 로그를 남기지
      // 않으므로(규칙 3) `logUsage` 보다 먼저 판정한다. `abortSignal.aborted` 광의
      // 판정이 아니라 **실제 AbortError 만** 재throw 해, 취소와 무관한 실패
      // (resolve/SSRF/파라미터 파싱 등)를 오분류하지 않는다.
      if (isAbortErrorLike(err_)) {
        throw err_;
      }
      // 연결 시점 판정(`database-connection.ts` 의 stream 팩토리)이 막은 연결은 드라이버 오류로 감싸여 온다. usage
      // 로그보다 먼저 `DB_HOST_BLOCKED` 로 바꿔, 차단된 host/IP 가 담긴 원문이 usage 로그와 노드 에러에 나가지 않게 한다.
      const err = promoteConnectTimeBlock(err_);
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
      // 쿼리를 시작하기 전에 잡힌 그 밖의 예외(통합 조회 거절 `RESOURCE_NOT_FOUND`, 조회 중 일시 오류)는 드라이버
      // code 가 붙어 있어도 사용자 DB 의 실패가 아니다. 분류되지 않은 실패 `INTEGRATION_CALL_FAILED` 로 낸다(HTTP
      // Request · Cafe24 와 같다. [통합 노드 공통 「공통 에러 코드」](CLE-NODE-INT-COMMON-ERROR#공통-에러-코드)).
      const errorEnvelope = classifyExecuteError(err, queryStarted, driver);
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
    // mysql2 는 `?` 를 쓴다. 화면 안내의 PostgreSQL 식 `$N` 을 `?` 로 바꾸고 바인딩 배열을 번호대로 다시 만든다.
    // 연결을 얻기 전에 바꿔서 잘못된 번호(`INVALID_PARAMETERS`)는 쿼리를 보내지 않고 끝낸다.
    const { sql, values } = convertMysqlPlaceholders(query, parameters);
    const pool = this.resolveMysqlPool(integrationId, creds);
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
      const [rawRows, fields] = await connection.query(sql, values);
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
        ...buildMysqlConnection(creds),
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
      ...buildMysqlConnection(creds),
      connectionLimit: POOL_MAX_CONNECTIONS,
      idleTimeout: POOL_IDLE_TIMEOUT_MS,
      waitForConnections: true,
    });
    this.pools.set(integrationId, { driver: 'mysql', pool, credsHash });
    return pool;
  }
}

/**
 * 연결 시점 판정의 차단을 `DB_HOST_BLOCKED` 로 바꾼다(NERV Task `CLE-T-691T4G`). 드라이버는 소켓 오류를 그대로 또는
 * 감싸서 reject 하므로 `cause` 사슬에서 `SsrfBlockedError` 를 찾는다. 원문 상세는 서버 로그에만 남긴다. 이미
 * `IntegrationError` 면(앞선 preflight 판정 등) 그대로 둔다.
 */
function promoteConnectTimeBlock(err: unknown): unknown {
  if (err instanceof IntegrationError) return err;
  if (!findConnectTimeBlock(err, logger, 'database-query')) return err;
  return new IntegrationError('DB_HOST_BLOCKED', DB_HOST_BLOCKED_MESSAGE);
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

/** 실행 중 예외를 error 포트의 `{ code, message }` 로 분류한다. */
function classifyExecuteError(
  err: unknown,
  queryStarted: boolean,
  driver: 'postgres' | 'mysql',
): { code: string; message: string } {
  if (err instanceof IntegrationError) {
    return { code: err.code, message: sanitizeMessage(err.message) };
  }
  if (queryStarted) return mapDbError(err, driver);
  return {
    code: 'INTEGRATION_CALL_FAILED',
    message: sanitizeMessage(err instanceof Error ? err.message : String(err)),
  };
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
