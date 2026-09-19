import { Logger } from '@nestjs/common';
import { Client as PgClient } from 'pg';
import { createConnection as mysqlCreateConnection } from 'mysql2/promise';

import { assertSafeOutboundHostResolved } from '../../nodes/integration/http-request/http-safety';
import {
  DB_HOST_BLOCKED_MESSAGE,
  buildMysqlSsl,
  buildPgConnection,
  type DbCredentials,
} from '../../nodes/integration/database-query/database-connection';
import { clampMessage } from './clamp-message';
import type { IntegrationTestResult } from './integrations.service';

const logger = new Logger('DatabaseConnectionTester');

/** Database 연결 테스트의 연결 · 쿼리 대기 상한(ms) — spec/2-navigation/4-integration.md §5.4. */
export const DB_TEST_TIMEOUT_MS = 10_000;

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
    await client.end().catch(() => {});
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
    await connection?.end().catch(() => {});
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
      logger.warn(`SSRF block (database connection test): ${detail}`);
      return {
        success: false,
        code: 'DB_HOST_BLOCKED',
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
      code: isAuthFailure(driver, err) ? 'DB_AUTH_FAILED' : 'DB_CONNECT_FAILED',
      message: clampMessage(err instanceof Error ? err.message : String(err)),
    };
  }
}
