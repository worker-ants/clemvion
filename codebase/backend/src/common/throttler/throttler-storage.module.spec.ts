import { describe, expect, it } from '@jest/globals';

import { shouldSkipThrottle } from '../utils/throttler-skip';
import type { RedisThrottlerStorage } from './redis-throttler.storage';
import {
  buildThrottlerOptions,
  DEFAULT_THROTTLER,
} from './throttler-storage.module';

describe('buildThrottlerOptions', () => {
  it('주입받은 저장소를 쓰고 기본 한도 · 건너뛰기 조건은 예전 forRoot 설정과 같다', () => {
    const storage = {} as RedisThrottlerStorage;

    const options = buildThrottlerOptions(storage);

    expect(options).toEqual({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 100 }],
      skipIf: shouldSkipThrottle,
      storage,
    });
    expect(DEFAULT_THROTTLER).toEqual({
      name: 'default',
      ttl: 60_000,
      limit: 100,
    });
  });
});
