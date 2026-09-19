/**
 * Database 통합 자격증명 → 드라이버 연결 옵션.
 *
 * 노드 실행(`database-query.handler.ts`)과 통합 연결 테스트(`modules/integrations/database-connection-tester.ts`)가
 * **같은 매핑**을 쓰도록 한 곳에 둔다 — 연결 테스트가 노드와 다른 SSL 을 쓰면 테스트 통과가 실행 성공을 뜻하지 않는다.
 *
 * 이 모듈은 의존성이 없어야 한다. 핸들러는 `IntegrationsService` 를 import 하므로, 통합 모듈의 테스터가 핸들러를
 * 가져오면 순환 import 가 된다 — 둘이 함께 쓰는 것만 여기로 꺼냈다.
 */

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

export function buildPgConnection(creds: DbCredentials): {
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

export function buildMysqlSsl(
  ssl: DbCredentials['ssl'],
): { rejectUnauthorized: boolean } | undefined {
  if (ssl === 'require' || ssl === 'verify-full') {
    return { rejectUnauthorized: true };
  }
  return undefined;
}
