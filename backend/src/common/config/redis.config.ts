import { registerAs } from '@nestjs/config';

/**
 * Redis 연결 설정 — ioredis 인스턴스 생성 시 사용.
 *
 * 인증 redis 도입 시 본 구성을 사용하는 모든 Redis client 가 동일하게 password
 * / tls 옵션을 받도록 단일 source 로 묶었다. 옛 코드는 host/port 만 노출해
 * `Cafe24InstallNonceCache` 같이 독립적으로 Redis client 를 만드는 곳이 인증
 * 정보를 전달하지 못해 ECONNREFUSED 후 graceful-degrade 로 replay 검증을 무음
 * 비활성화 하던 문제 (W-72) 가 있었다.
 *
 * tls 는 `REDIS_TLS=true` 또는 `rediss://` URL 도입 시 활성. password 가
 * 비어 있으면 password 옵션을 누락 (ioredis 가 AUTH command skip).
 */
export const redisConfig = registerAs('redis', () => {
  const password = process.env.REDIS_PASSWORD;
  const useTls = process.env.REDIS_TLS === 'true';
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    ...(password ? { password } : {}),
    ...(useTls ? { tls: {} } : {}),
  };
});
