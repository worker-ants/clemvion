/**
 * Database 통합 자격증명 → 드라이버 연결 옵션.
 *
 * 노드 실행(`database-query.handler.ts`)과 통합 연결 테스트(`modules/integrations/database-connection-tester.ts`)가
 * **같은 매핑**을 쓰도록 한 곳에 둔다 — 연결 테스트가 노드와 다른 SSL 이나 연결 판정을 쓰면 테스트 통과가 실행 성공을
 * 뜻하지 않는다.
 *
 * 이 모듈은 통합 모듈 · 핸들러에 의존하지 않는다. 핸들러는 `IntegrationsService` 를 import 하므로, 통합 모듈의 테스터가
 * 핸들러를 가져오면 순환 import 가 된다 — 둘이 함께 쓰는 것만 여기로 꺼냈다. 공용 SSRF 가드(`common/utils/ssrf`)만 쓴다.
 */
import { connect, Socket, type LookupFunction } from 'node:net';
import { safeOutboundLookup } from '../../../common/utils/ssrf/outbound-guard.js';

export interface DbCredentials {
  driver: 'postgres' | 'mysql';
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: 'disable' | 'require' | 'verify-full';
}

/**
 * SSRF 가드가 DB host 를 막았을 때의 클라이언트 문구. 차단된 host/IP 는 싣지 않는다 — 정찰 면 축소
 * (원본 상세는 서버 로그에만). 노드(`DB_HOST_BLOCKED` 노드 에러)와 연결 테스트가 같은 문구를 쓴다.
 */
export const DB_HOST_BLOCKED_MESSAGE =
  'Database host resolves to a private/loopback address blocked by SSRF policy.';

/** pg `stream` 팩토리. pg 가 연결(풀의 새 클라이언트 포함)마다 불러 소켓을 받는다. */
export type PgStreamFactory = () => Socket;

/**
 * pg 연결 시점 판정 소켓 팩토리. pg 는 받은 소켓에 `connect(port, host)` 를 부르므로 그 호출을
 * `connect({ port, host, lookup })` 로 바꿔 연결할 때 푼 주소를 공용 대역표로 다시 판정한다. 그 밖의 소켓 동작(`setNoDelay` ·
 * keep-alive · 연결 타임아웃의 `destroy`)은 pg 가 그대로 한다. TLS 는 pg 가 이 소켓 위에서 `servername: host` 로 맺는다.
 * 호스트가 없는 호출(유닉스 소켓 경로)은 원래 `connect` 로 넘긴다.
 */
export function createGuardedPgStream(lookup: LookupFunction): PgStreamFactory {
  return () => {
    const socket = new Socket();
    const originalConnect = socket.connect.bind(socket) as (
      ...args: unknown[]
    ) => Socket;
    socket.connect = (...args: unknown[]) => {
      const [port, host] = args;
      if (
        (typeof port === 'number' || typeof port === 'string') &&
        typeof host === 'string'
      ) {
        return originalConnect({ port: Number(port), host, lookup });
      }
      return originalConnect(...args);
    };
    return socket;
  };
}

/** mysql2 `stream` 팩토리가 받는 인자 중 이 모듈이 읽는 부분. mysql2 는 `{ config }` 를 넘긴다. */
interface MysqlStreamFactoryOptions {
  config: {
    host?: string;
    port?: number;
    enableKeepAlive?: boolean;
    keepAliveInitialDelay?: number;
  };
}

/** mysql2 `stream` 팩토리. mysql2 가 연결(풀의 새 연결 포함)마다 불러 연결 중인 소켓을 받는다. */
export type MysqlStreamFactory = (opts: MysqlStreamFactoryOptions) => Socket;

/**
 * mysql2 연결 시점 판정 소켓 팩토리. `net.connect({ host, port, lookup })` 으로 소켓을 열어 연결할 때 푼 주소를 공용
 * 대역표로 다시 판정한다. mysql2 는 팩토리가 준 소켓에는 `setNoDelay` · keep-alive 를 걸지 않으므로 기본 연결과 같게
 * 여기서 건다(`lib/base/connection.js` 의 기본 경로와 같은 값). TLS 는 mysql2 가 이 소켓 위에서 `config.host` 를
 * servername 으로 맺는다.
 */
export function createGuardedMysqlStream(
  lookup: LookupFunction,
): MysqlStreamFactory {
  return ({ config }) => {
    const socket = connect({ host: config.host, port: config.port, lookup });
    if (config.enableKeepAlive) {
      socket.on('connect', () => {
        socket.setKeepAlive(true, config.keepAliveInitialDelay);
      });
    }
    socket.setNoDelay(true);
    return socket;
  };
}

/**
 * pg 연결 옵션. 사설망 허용 플래그(`ALLOW_PRIVATE_HOST_TARGETS=true`)가 꺼져 있으면 연결 시점 판정 `stream` 팩토리를
 * 함께 싣는다(NERV Task `CLE-T-691T4G`). 풀은 만들 때의 옵션을 새 연결마다 쓰므로 풀이 새 연결을 맺을 때마다 판정한다.
 */
export function buildPgConnection(creds: DbCredentials): {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean | { rejectUnauthorized: boolean };
  stream?: PgStreamFactory;
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
  const lookup = safeOutboundLookup();
  return {
    host: creds.host,
    port: creds.port,
    database: creds.database,
    user: creds.username,
    password: creds.password,
    ssl,
    ...(lookup ? { stream: createGuardedPgStream(lookup) } : {}),
  };
}

/**
 * mysql2 연결 옵션(연결 · 풀 공통 부분). {@link buildPgConnection} 과 같이 사설망 허용 플래그가 꺼져 있으면 연결 시점
 * 판정 `stream` 팩토리를 싣는다. 타임아웃 · 풀 크기 같은 호출별 옵션은 호출자가 더한다.
 */
export function buildMysqlConnection(creds: DbCredentials): {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: { rejectUnauthorized: boolean } | undefined;
  stream?: MysqlStreamFactory;
} {
  const lookup = safeOutboundLookup();
  return {
    host: creds.host,
    port: creds.port,
    user: creds.username,
    password: creds.password,
    database: creds.database,
    ssl: buildMysqlSsl(creds.ssl),
    ...(lookup ? { stream: createGuardedMysqlStream(lookup) } : {}),
  };
}

export function buildMysqlSsl(
  ssl: DbCredentials['ssl'],
): { rejectUnauthorized: boolean } | undefined {
  if (ssl === 'require' || ssl === 'verify-full') {
    return { rejectUnauthorized: true };
  }
  return undefined;
}
