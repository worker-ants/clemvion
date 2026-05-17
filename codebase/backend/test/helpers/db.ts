import { Client } from 'pg';

/**
 * docker-compose.e2e.yml 의 backend-e2e-runner 컨테이너 안에서 같은 network 의
 * postgres 에 직접 접속해 setup·verify 한다. ephemeral schema 이므로 누적 cleanup
 * 은 불필요하지만, 각 spec 이 충돌하지 않도록 unique email/workspace 접두를 권장.
 */
export function createDbClient(): Client {
  return new Client({
    host: process.env.DB_HOST ?? 'postgres',
    port: Number(process.env.DB_PORT ?? '5432'),
    user: process.env.DB_USERNAME ?? 'clemvion',
    password: process.env.DB_PASSWORD ?? 'clemvion-e2e',
    database: process.env.DB_DATABASE ?? 'clemvion_e2e',
  });
}

/**
 * 시나리오마다 호출해서 충돌 없는 식별자를 생성한다. 시각 + 난수로 같은 jest run
 * 내에서도 spec/test 간 충돌이 사실상 0 이다.
 */
export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.local`;
}

export function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}
