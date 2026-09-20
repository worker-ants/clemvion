import { Logger } from '@nestjs/common';
import { Client } from 'pg';
import { createConnection } from 'mysql2/promise';

import {
  assertSafeOutboundHostResolved,
  SsrfBlockedError,
} from '../../nodes/integration/http-request/http-safety';
import { DB_HOST_BLOCKED_MESSAGE } from '../../nodes/integration/database-query/database-connection';
import { MCP_ERROR_MESSAGE_MAX_LEN } from '../mcp/mcp-error-codes';
import {
  DB_TEST_CLOSE_GRACE_MS,
  DB_TEST_TIMEOUT_MS,
  testDatabaseConnection,
} from './database-connection-tester';

jest.mock('pg', () => ({ Client: jest.fn() }));
jest.mock('mysql2/promise', () => ({ createConnection: jest.fn() }));
// 가드 함수만 mock 하고 `SsrfBlockedError` 는 실물을 남긴다 — 테스터가 판정을 그 클래스로 가르므로, mock 이 클래스를 가리면
// 어떤 오류를 던져도 «판정 아님» 이 되어 차단 테스트가 통과 이유를 잃는다.
jest.mock('../../nodes/integration/http-request/http-safety', () => ({
  ...jest.requireActual('../../nodes/integration/http-request/http-safety'),
  assertSafeOutboundHostResolved: jest.fn(),
}));

/**
 * spec/2-navigation/4-integration.md §5.4 — Database 연결 테스트. 일회성 연결 + `SELECT 1`, 10초, SSL · SSRF 는 노드와 같게.
 * 결과 코드: `DB_HOST_BLOCKED` · `DB_AUTH_FAILED`(PG class 28 · MySQL 1045/1044) · `DB_CONNECT_FAILED`(그 밖).
 * 종전에는 이 테스터가 없어 구조만 맞으면 «Connection successful» 이었다 — 틀린 비밀번호도 통과했다.
 */
describe('testDatabaseConnection', () => {
  const MockedClient = Client as unknown as jest.Mock;
  const mockedCreateConnection = createConnection as unknown as jest.Mock;
  const mockedGuard = assertSafeOutboundHostResolved as unknown as jest.Mock;

  // 드라이버 내부 소켓(`connection.stream`) — 닫기가 끝나지 않을 때 파괴하는 자리.
  const pg = {
    connect: jest.fn(),
    query: jest.fn(),
    end: jest.fn(),
    connection: { stream: { destroy: jest.fn() } },
  };
  const mysql = {
    query: jest.fn(),
    end: jest.fn(),
    connection: { stream: { destroy: jest.fn() } },
  };
  const never = () => new Promise<never>(() => {});

  const pgCreds = {
    driver: 'postgres',
    host: 'db.example.com',
    port: 5432,
    database: 'app',
    username: 'reader',
    password: 's3cret-pw',
    ssl: 'disable',
  };
  const mysqlCreds = { ...pgCreds, driver: 'mysql', port: 3306 };

  function driverError(code: string, message: string): Error {
    return Object.assign(new Error(message), { code });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGuard.mockResolvedValue(undefined);
    pg.connect.mockResolvedValue(undefined);
    pg.query.mockResolvedValue({ rows: [{ '?column?': 1 }] });
    pg.end.mockResolvedValue(undefined);
    MockedClient.mockImplementation(() => pg);
    mysql.query.mockResolvedValue([[{ 1: 1 }], []]);
    mysql.end.mockResolvedValue(undefined);
    mockedCreateConnection.mockResolvedValue(mysql);
  });

  describe('postgres', () => {
    it('연결 · SELECT 1 이 되면 성공하고, 노드와 같은 연결 옵션 + 10초 대기(연결 · 쿼리)로 연결한 뒤 반드시 닫는다', async () => {
      const result = await testDatabaseConnection(pgCreds);

      expect(result).toEqual({
        success: true,
        message: 'Connection successful',
      });
      expect(MockedClient).toHaveBeenCalledWith({
        host: 'db.example.com',
        port: 5432,
        database: 'app',
        user: 'reader',
        password: 's3cret-pw',
        ssl: false,
        connectionTimeoutMillis: DB_TEST_TIMEOUT_MS,
        query_timeout: DB_TEST_TIMEOUT_MS,
      });
      expect(DB_TEST_TIMEOUT_MS).toBe(10_000);
      expect(pg.query).toHaveBeenCalledWith('SELECT 1');
      expect(pg.end).toHaveBeenCalledTimes(1);
      // 제때 닫히면 소켓을 파괴하지 않는다.
      expect(pg.connection.stream.destroy).not.toHaveBeenCalled();
    });

    it('SELECT 1 에 답하고 종료는 무시하는 서버 — 닫기를 상한까지만 기다리고 소켓을 파괴한 뒤 결과를 돌려준다', async () => {
      jest.useFakeTimers();
      try {
        pg.end.mockImplementation(never);

        const pending = testDatabaseConnection(pgCreds);
        await jest.advanceTimersByTimeAsync(DB_TEST_CLOSE_GRACE_MS);

        await expect(pending).resolves.toEqual({
          success: true,
          message: 'Connection successful',
        });
        expect(pg.connection.stream.destroy).toHaveBeenCalledTimes(1);
      } finally {
        jest.useRealTimers();
      }
    });

    it('닫기가 끝나지 않는데 드라이버 소켓을 못 찾으면(내부 구조 변경) 결과는 그대로 돌려주고 경고를 남긴다', async () => {
      jest.useFakeTimers();
      const warn = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      const socketHolder = pg as { connection?: unknown };
      const original = socketHolder.connection;
      socketHolder.connection = undefined;
      try {
        pg.end.mockImplementation(never);

        const pending = testDatabaseConnection(pgCreds);
        await jest.advanceTimersByTimeAsync(DB_TEST_CLOSE_GRACE_MS);

        await expect(pending).resolves.toEqual({
          success: true,
          message: 'Connection successful',
        });
        expect(warn).toHaveBeenCalledWith(
          expect.stringContaining('driver socket was not found'),
        );
      } finally {
        socketHolder.connection = original;
        warn.mockRestore();
        jest.useRealTimers();
      }
    });

    it('driver 가 비어 있으면 노드처럼 postgres 로 연결한다', async () => {
      const { driver: _omit, ...noDriver } = pgCreds;
      await testDatabaseConnection(noDriver);
      expect(MockedClient).toHaveBeenCalledTimes(1);
      expect(mockedCreateConnection).not.toHaveBeenCalled();
    });

    it('SSL 매핑은 노드와 같다 — verify-full 은 인증서 검증을 켠다', async () => {
      await testDatabaseConnection({ ...pgCreds, ssl: 'verify-full' });
      expect(MockedClient).toHaveBeenCalledWith(
        expect.objectContaining({ ssl: { rejectUnauthorized: true } }),
      );
    });

    it('host 가 SSRF 가드에 막히면 DB_HOST_BLOCKED — 연결을 시도하지 않고, host 를 메시지에 싣지 않는다', async () => {
      mockedGuard.mockRejectedValue(new SsrfBlockedError('10.0.0.5'));

      const result = await testDatabaseConnection({
        ...pgCreds,
        host: 'internal.db',
      });

      expect(result).toEqual({
        success: false,
        code: 'DB_HOST_BLOCKED',
        message: DB_HOST_BLOCKED_MESSAGE,
      });
      expect(result.message).not.toContain('internal.db');
      expect(result.message).not.toContain('10.0.0.5');
      expect(MockedClient).not.toHaveBeenCalled();
    });

    /**
     * 가드가 던지는 «판정» 은 `SsrfBlockedError` 하나뿐이다(`http-safety.ts`). 그 밖의 오류는 가드의 고장이지 차단이 아니므로
     * `DB_HOST_BLOCKED`(= 사용자에게 «당신의 host 가 막혔다») 로 보고하면 거짓이다 — 분류되지 않은 실패로 돌린다.
     * 던지지 않는 계약은 그대로다(`dispatchTest` 의 tester 계약).
     */
    it('가드가 판정 아닌 오류를 던지면 DB_HOST_BLOCKED 가 아니라 DB_CONNECT_FAILED — 던지지 않는다', async () => {
      mockedGuard.mockRejectedValue(
        new TypeError('hostname.toLowerCase is not a function'),
      );

      const result = await testDatabaseConnection({
        ...pgCreds,
        host: 'internal.db',
      });

      expect(result).toEqual({
        success: false,
        code: 'DB_CONNECT_FAILED',
        message: 'hostname.toLowerCase is not a function',
      });
      expect(MockedClient).not.toHaveBeenCalled();
    });

    it.each([
      ['28P01', 'password authentication failed for user "reader"'],
      ['28000', 'no pg_hba.conf entry for host'],
    ])('SQLSTATE %s(class 28) 는 DB_AUTH_FAILED', async (code, message) => {
      pg.connect.mockRejectedValue(driverError(code, message));

      const result = await testDatabaseConnection(pgCreds);

      expect(result).toEqual({
        success: false,
        code: 'DB_AUTH_FAILED',
        message,
      });
      expect(pg.end).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['ECONNREFUSED', 'connect ECONNREFUSED 203.0.113.9:5432'],
      ['3D000', 'database "app" does not exist'],
      ['08001', 'could not connect to server'],
    ])('%s 는 DB_CONNECT_FAILED(인증이 아닌 실패)', async (code, message) => {
      pg.connect.mockRejectedValue(driverError(code, message));

      const result = await testDatabaseConnection(pgCreds);

      expect(result).toEqual({
        success: false,
        code: 'DB_CONNECT_FAILED',
        message,
      });
    });

    it('연결 대기 초과(드라이버의 timeout 오류)는 DB_CONNECT_FAILED', async () => {
      pg.connect.mockRejectedValue(
        new Error('Connection terminated due to connection timeout'),
      );
      const result = await testDatabaseConnection(pgCreds);
      expect(result).toMatchObject({
        success: false,
        code: 'DB_CONNECT_FAILED',
      });
    });

    it('연결 뒤 SELECT 1 이 실패해도 DB_CONNECT_FAILED 이고 연결을 닫는다', async () => {
      pg.query.mockRejectedValue(
        driverError('57P01', 'terminating connection'),
      );

      const result = await testDatabaseConnection(pgCreds);

      expect(result).toMatchObject({
        success: false,
        code: 'DB_CONNECT_FAILED',
      });
      expect(pg.end).toHaveBeenCalledTimes(1);
    });

    it('닫기가 실패해도 결과를 바꾸지 않고 던지지 않는다', async () => {
      pg.end.mockRejectedValue(new Error('already closed'));
      await expect(testDatabaseConnection(pgCreds)).resolves.toEqual({
        success: true,
        message: 'Connection successful',
      });
    });

    it('드라이버 메시지는 길이를 제한한다', async () => {
      pg.connect.mockRejectedValue(
        driverError('08006', 'x'.repeat(MCP_ERROR_MESSAGE_MAX_LEN + 50)),
      );
      const result = await testDatabaseConnection(pgCreds);
      expect(result.message).toHaveLength(MCP_ERROR_MESSAGE_MAX_LEN);
    });
  });

  describe('mysql', () => {
    it('일회성 연결(10초) + SELECT 1 로 성공하고 반드시 닫는다', async () => {
      const result = await testDatabaseConnection(mysqlCreds);

      expect(result).toEqual({
        success: true,
        message: 'Connection successful',
      });
      expect(mockedCreateConnection).toHaveBeenCalledWith({
        host: 'db.example.com',
        port: 3306,
        user: 'reader',
        password: 's3cret-pw',
        database: 'app',
        ssl: undefined,
        connectTimeout: DB_TEST_TIMEOUT_MS,
      });
      expect(mysql.query).toHaveBeenCalledWith({
        sql: 'SELECT 1',
        timeout: DB_TEST_TIMEOUT_MS,
      });
      expect(mysql.end).toHaveBeenCalledTimes(1);
      expect(mysql.connection.stream.destroy).not.toHaveBeenCalled();
      expect(MockedClient).not.toHaveBeenCalled();
    });

    /**
     * SSL 매핑은 Database 노드와 **공유**하는 보안 매핑이다(`buildMysqlSsl`) — postgres 쪽만 보면 mysql 쪽이 인증서 검증을 끄는
     * 변경이 통과한다. mysql 은 `require` 도 검증을 켠다(노드와 같다).
     */
    it.each([
      ['require', { rejectUnauthorized: true }],
      ['verify-full', { rejectUnauthorized: true }],
      ['disable', undefined],
    ])('SSL %s → 노드와 같은 매핑(%j)', async (ssl, expected) => {
      await testDatabaseConnection({ ...mysqlCreds, ssl });
      expect(mockedCreateConnection).toHaveBeenCalledWith(
        expect.objectContaining({ ssl: expected }),
      );
    });

    it('쿼리 타임아웃 뒤 end() 가 끝나지 않아도(타임아웃된 쿼리 뒤에 Quit 이 줄 선다) 상한 뒤 소켓을 파괴하고 결과를 돌려준다', async () => {
      jest.useFakeTimers();
      try {
        mysql.query.mockRejectedValue(
          driverError('PROTOCOL_SEQUENCE_TIMEOUT', 'Query inactivity timeout'),
        );
        mysql.end.mockImplementation(never);

        const pending = testDatabaseConnection(mysqlCreds);
        await jest.advanceTimersByTimeAsync(DB_TEST_CLOSE_GRACE_MS);

        await expect(pending).resolves.toEqual({
          success: false,
          code: 'DB_CONNECT_FAILED',
          message: 'Query inactivity timeout',
        });
        expect(mysql.connection.stream.destroy).toHaveBeenCalledTimes(1);
      } finally {
        jest.useRealTimers();
      }
    });

    it.each([
      [
        'ER_ACCESS_DENIED_ERROR',
        "Access denied for user 'reader'@'x' (using password: YES)",
      ],
      [
        'ER_DBACCESS_DENIED_ERROR',
        "Access denied for user 'reader'@'%' to database 'app'",
      ],
    ])('%s 는 DB_AUTH_FAILED', async (code, message) => {
      mockedCreateConnection.mockRejectedValue(driverError(code, message));

      const result = await testDatabaseConnection(mysqlCreds);

      expect(result).toEqual({
        success: false,
        code: 'DB_AUTH_FAILED',
        message,
      });
    });

    it.each([
      ['ETIMEDOUT', 'connect ETIMEDOUT'],
      ['ER_BAD_DB_ERROR', "Unknown database 'app'"],
    ])('%s 는 DB_CONNECT_FAILED', async (code, message) => {
      mockedCreateConnection.mockRejectedValue(driverError(code, message));

      const result = await testDatabaseConnection(mysqlCreds);

      expect(result).toEqual({
        success: false,
        code: 'DB_CONNECT_FAILED',
        message,
      });
    });

    it('연결 뒤 SELECT 1 이 실패해도 연결을 닫는다', async () => {
      mysql.query.mockRejectedValue(
        driverError('PROTOCOL_CONNECTION_LOST', 'lost'),
      );

      const result = await testDatabaseConnection(mysqlCreds);

      expect(result).toMatchObject({
        success: false,
        code: 'DB_CONNECT_FAILED',
      });
      expect(mysql.end).toHaveBeenCalledTimes(1);
    });
  });
});
