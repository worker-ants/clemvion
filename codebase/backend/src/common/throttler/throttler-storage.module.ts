import { Module } from '@nestjs/common';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';

import { shouldSkipThrottle } from '../utils/throttler-skip';
import { RedisThrottlerStorage } from './redis-throttler.storage';

/** 전역 요청 빈도 제한의 기본 한도. 사용자(또는 IP)당 60초에 100회다. */
export const DEFAULT_THROTTLER = {
  name: 'default',
  ttl: 60_000,
  limit: 100,
} as const;

/**
 * `ThrottlerModule.forRootAsync` 의 옵션. 저장소만 주입받고 나머지는 예전 `forRoot` 설정과 같다.
 *
 * `skipIf`: e2e 는 단일 컨테이너 IP 에서 빠른 register 호출이 100/60s 한계에 걸려 suite 가
 * `RATE_LIMITED` 로 깨진다. 그래서 `NODE_ENV=test` 일 때만 건너뛴다. production · development 는 건너뛰지 않는다.
 */
export function buildThrottlerOptions(
  storage: RedisThrottlerStorage,
): ThrottlerModuleOptions {
  return {
    throttlers: [{ ...DEFAULT_THROTTLER }],
    skipIf: shouldSkipThrottle,
    storage,
  };
}

/**
 * {@link RedisThrottlerStorage} 를 Nest provider 로 둔다. provider 라서 종료 훅이 불려 메모리 폴백의
 * 타이머가 정리된다. 공유 Redis 연결(`RedisModule`)과 지표(`MetricsModule`)는 `@Global` 이라 import 하지 않는다.
 */
@Module({
  providers: [RedisThrottlerStorage],
  exports: [RedisThrottlerStorage],
})
export class ThrottlerStorageModule {}
