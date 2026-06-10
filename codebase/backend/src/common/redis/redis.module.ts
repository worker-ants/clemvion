import { Global, Module } from '@nestjs/common';
import { RedisConnectionProvider } from './redis-connection.provider';
import { IntegrationCacheBus } from './integration-cache-bus.service';

/**
 * 공유 command Redis 연결을 전역 제공 (ai-review INFO-12).
 * `@Global` 이므로 소비 모듈이 별도 import 없이 `RedisConnectionProvider` 를 주입 가능.
 * ConfigModule 은 app.module 에서 `isGlobal: true` 로 등록돼 있어 별도 import 불필요.
 *
 * {@link IntegrationCacheBus} 도 전역 제공 — `IntegrationsService`(publish) 와 노드
 * 핸들러(register)가 동일 싱글톤 bus 를 주입받아 credential 회전을 전 인스턴스에 전파한다.
 */
@Global()
@Module({
  providers: [RedisConnectionProvider, IntegrationCacheBus],
  exports: [RedisConnectionProvider, IntegrationCacheBus],
})
export class RedisModule {}
