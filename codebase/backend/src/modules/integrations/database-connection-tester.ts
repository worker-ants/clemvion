import { Logger } from '@nestjs/common';
import { Client as PgClient } from 'pg';
import { createConnection as mysqlCreateConnection } from 'mysql2/promise';

import {
  SsrfBlockedError,
  assertSafeOutboundHostResolved,
} from '../../nodes/integration/http-request/http-safety';
import {
  DB_HOST_BLOCKED_MESSAGE,
  buildMysqlSsl,
  buildPgConnection,
  type DbCredentials,
} from '../../nodes/integration/database-query/database-connection';
import { sanitizeMessage } from '../../nodes/integration/_base/integration-handler-base';
import { clampMessage } from './clamp-message';
import { CONNECTION_TEST_CODES } from './connection-test-codes';
import type { IntegrationTestResult } from './integrations.service';

const logger = new Logger('DatabaseConnectionTester');

/** Database 연결 테스트의 연결 · 쿼리 대기 상한(ms) — spec/2-navigation/4-integration.md §5.4. */
export const DB_TEST_TIMEOUT_MS = 10_000;

/**
 * 연결을 닫는 데 기다리는 상한(ms). 결과는 이미 정해졌으므로 짧다 — 넘기면 소켓을 파괴한다({@link closeWithin}).
 */
export const DB_TEST_CLOSE_GRACE_MS = 1_000;

/** 두 드라이버 모두 `connection.stream` 에 소켓을 둔다(pg `Client` · mysql2 promise `Connection`). */
type HasSocket = { connection?: { stream?: { destroy?: () => void } } };

/**
 * 연결을 닫되 기다림에 상한을 둔다. graceful close 는 서버의 응답에 기댄다 — mysql2 는 타임아웃된 쿼리가 커맨드 큐에
 * 남아 있으면 Quit 을 그 **뒤에** 세우고, pg 는 Terminate 를 보낸 뒤 서버가 소켓을 닫아야 끝난다. 응답하지 않는(또는
 * 일부러 무시하는) 서버면 영원히 끝나지 않아, 이 테스트를 감싼 연결 테스트 동시 상한 슬롯을 놓지 않는다. 상한을 넘기면
 * 소켓을 파괴한다. 결과를 바꾸지 않고 던지지 않는다.
 */
async function closeWithin(
  graceful: () => Promise<unknown>,
  handle: HasSocket,
): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const closed = await Promise.race([
    graceful().then(
      () => true,
      () => true,
    ),
    new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(false), DB_TEST_CLOSE_GRACE_MS);
    }),
  ]);
  clearTimeout(timer);
  if (closed) return;
  const stream = handle.connection?.stream;
  if (stream?.destroy) {
    stream.destroy();
    logger.warn(
      `Database connection test: close did not finish within ${DB_TEST_CLOSE_GRACE_MS}ms — destroyed the socket`,
    );
  } else {
    // 드라이버 내부 구조가 바뀌면 여기로 온다 — 조용히 넘어가지 않게 남긴다.
    logger.warn(
      'Database connection test: close did not finish and the driver socket was not found — the connection may linger',
    );
  }
}

/** PostgreSQL SQLSTATE class 28 — invalid authorization specification(`28000`) · invalid password(`28P01`). */
const PG_AUTH_SQLSTATE = /^28[0-9A-Z]{3}$/;

/** MySQL 인증 거부 — `ER_ACCESS_DENIED_ERROR`(1045) · `ER_DBACCESS_DENIED_ERROR`(1044). */
const MYSQL_AUTH_ERROR_CODES = new Set([
  'ER_ACCESS_DENIED_ERROR',
  'ER_DBACCESS_DENIED_ERROR',
]);

function isAuthFailure(driver: DbCredentials['driver'], err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  if (typeof code !== 'string') return false;
  return driver === 'mysql'
    ? MYSQL_AUTH_ERROR_CODES.has(code)
    : PG_AUTH_SQLSTATE.test(code);
}

async function probePostgres(creds: DbCredentials): Promise<void> {
  const client = new PgClient({
    ...buildPgConnection(creds),
    connectionTimeoutMillis: DB_TEST_TIMEOUT_MS,
    query_timeout: DB_TEST_TIMEOUT_MS,
  });
  try {
    await client.connect();
    await client.query('SELECT 1');
  } finally {
    // 실패한 연결도 닫는다 — 결과는 바꾸지 않는다.
    await closeWithin(() => client.end(), client);
  }
}

async function probeMysql(creds: DbCredentials): Promise<void> {
  let connection: Awaited<ReturnType<typeof mysqlCreateConnection>> | undefined;
  try {
    connection = await mysqlCreateConnection({
      host: creds.host,
      port: creds.port,
      user: creds.username,
      password: creds.password,
      database: creds.database,
      ssl: buildMysqlSsl(creds.ssl),
      connectTimeout: DB_TEST_TIMEOUT_MS,
    });
    await connection.query({ sql: 'SELECT 1', timeout: DB_TEST_TIMEOUT_MS });
  } finally {
    if (connection) {
      // 클로저 안에서도 non-undefined 로 좁혀 두려고 const 로 다시 묶는다.
      const openedConnection = connection;
      await closeWithin(
        () => openedConnection.end(),
        openedConnection as unknown as HasSocket,
      );
    }
  }
}

/**
 * Database 통합 연결 테스트(spec/2-navigation/4-integration.md §5.4). 일회성 연결을 열어 `SELECT 1` 을 실행하고 닫는다 —
 * 노드 실행의 커넥션 풀과 별개이며 풀에 남지 않는다. SSL 매핑과 host 의 SSRF 가드는 Database 노드와 같다.
 *
 * - host 가 SSRF 가드에 막힘 → `DB_HOST_BLOCKED`(차단된 host/IP 는 메시지에 싣지 않는다)
 * - 인증 거부(PG class 28 · MySQL 1045/1044) → `DB_AUTH_FAILED`
 * - 그 밖(네트워크 · 타임아웃 · TLS · 없는 database 등) → `DB_CONNECT_FAILED`
 *
 * 던지지 않는다 — 결과를 돌려준다(`IntegrationsService.dispatchTest` 의 tester 계약).
 */
export async function testDatabaseConnection(
  credentials: Record<string, unknown>,
): Promise<IntegrationTestResult> {
  const creds = credentials as unknown as DbCredentials;
  if (creds.host) {
    try {
      await assertSafeOutboundHostResolved(creds.host);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      // 판정은 `SsrfBlockedError` 하나뿐이다 — 그 밖의 오류는 가드의 고장이지 차단이 아니므로 «당신의 host 가 막혔다» 로
      // 보고하지 않고 분류되지 않은 실패로 돌린다. 던지지 않는 계약은 그대로다(§아래 JSDoc).
      if (!(err instanceof SsrfBlockedError)) {
        logger.warn(`SSRF guard failed (database connection test): ${detail}`);
        return {
          success: false,
          code: CONNECTION_TEST_CODES.DB_CONNECT_FAILED,
          message: clampMessage(sanitizeMessage(detail)),
        };
      }
      logger.warn(`SSRF block (database connection test): ${detail}`);
      return {
        success: false,
        code: CONNECTION_TEST_CODES.DB_HOST_BLOCKED,
        message: DB_HOST_BLOCKED_MESSAGE,
      };
    }
  }

  const driver = creds.driver ?? 'postgres';
  try {
    if (driver === 'mysql') {
      await probeMysql(creds);
    } else {
      await probePostgres(creds);
    }
    return { success: true, message: 'Connection successful' };
  } catch (err) {
    return {
      success: false,
      code: isAuthFailure(driver, err)
        ? CONNECTION_TEST_CODES.DB_AUTH_FAILED
        : CONNECTION_TEST_CODES.DB_CONNECT_FAILED,
      message: clampMessage(err instanceof Error ? err.message : String(err)),
    };
  }
}
