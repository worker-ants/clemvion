/**
 * Database 통합 자격증명 → 드라이버 연결 옵션.
 *
 * 노드 실행(`database-query.handler.ts`)과 통합 연결 테스트(`modules/integrations/database-connection-tester.ts`)가
 * **같은 매핑**을 쓰도록 한 곳에 둔다 — 연결 테스트가 노드와 다른 SSL 이나 연결 판정을 쓰면 테스트 통과가 실행 성공을
 * 뜻하지 않는다.
 *
 * 이 모듈은 통합 모듈 · 핸들러에 의존하지 않는다. 핸들러는 `IntegrationsService` 를 import 하므로, 통합 모듈의 테스터가
 * 핸들러를 가져오면 순환 import 가 된다 — 둘이 함께 쓰는 것만 여기로 꺼냈다. 공용 SSRF 가드(`common/utils/ssrf`)만 쓴다.
 * pg · mysql2 소켓 어댑터는 그 공용 모듈(`socket-adapters.ts`)에 있고, 이 모듈은 플래그를 보고 빌더에 싣는다.
 */
import { safeOutboundLookup } from '../../../common/utils/ssrf/outbound-guard.js';
import {
  createGuardedMysqlStream,
  createGuardedPgStream,
  type MysqlStreamFactory,
  type PgStreamFactory,
} from '../../../common/utils/ssrf/socket-adapters.js';

// 연결 시점 판정 소켓 어댑터는 `common/utils/ssrf/socket-adapters.ts` 로 옮겼다(NERV Task `CLE-T-AM1H7X`). 이 모듈의
// 경로를 가리키는 스펙 · 호출부가 그대로 쓰도록 여기서도 내보낸다. 사설망 허용 플래그를 보고 어댑터를 실을지는 아래 빌더가 정한다.
export {
  createGuardedMysqlStream,
  createGuardedPgStream,
  type MysqlStreamFactory,
  type PgStreamFactory,
};

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
