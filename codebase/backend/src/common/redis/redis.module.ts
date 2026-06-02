import { Global, Module } from '@nestjs/common';
import { RedisConnectionProvider } from './redis-connection.provider';

/**
 * 공유 command Redis 연결을 전역 제공 (ai-review INFO-12).
 * `@Global` 이므로 소비 모듈이 별도 import 없이 `RedisConnectionProvider` 를 주입 가능.
 * ConfigModule 은 app.module 에서 `isGlobal: true` 로 등록돼 있어 별도 import 불필요.
 */
@Global()
@Module({
  providers: [RedisConnectionProvider],
  exports: [RedisConnectionProvider],
})
export class RedisModule {}
