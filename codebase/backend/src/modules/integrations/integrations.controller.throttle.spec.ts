import { PATH_METADATA } from '@nestjs/common/constants';
// 패키지 루트는 이 상수를 export 하지 않아서 내부 상수를 쓴다(password-recheck-throttle.spec.ts 와 같다).
import {
  THROTTLER_LIMIT,
  THROTTLER_TTL,
} from '@nestjs/throttler/dist/throttler.constants';

import { IntegrationsController } from './integrations.controller';

/**
 * 연결 테스트 두 경로는 사용자 기준 분당 20회로 제한한다. 사용자가 적은 공개 host 에 실제로 접속하고
 * 실패 원인을 코드로 구분해 돌려주므로 탐색에 쓰일 수 있어서다. 위험은 받아들이고 빈도만 묶는다.
 *
 * 테스트 환경(`NODE_ENV=test`)은 요청 빈도 제한을 건너뛰어 e2e 로는 한도를 확인할 수 없다. 그래서 데코레이터가 남긴
 * 메타데이터를 본다. 근거: NERV CLE-INT-MANAGE-RUN 「연결 테스트의 탐색 위험을 받아들인다」, CLE-API-CONV-RATE §7
 * (CLE-T-SG4GRQ)
 */
const CONNECTION_TEST_THROTTLE = { limit: 20, ttl: 60_000 } as const;

const CONNECTION_TEST_ROUTES = [
  {
    handler: IntegrationsController.prototype.previewTest,
    path: 'preview-test',
  },
  {
    handler: IntegrationsController.prototype.testConnection,
    path: ':id/test',
  },
] as const;

describe('연결 테스트 라우트의 요청 빈도 제한', () => {
  it.each(CONNECTION_TEST_ROUTES)(
    'POST /integrations/$path 는 분당 20회 한도를 건다',
    ({ handler, path }) => {
      // 목록의 경로가 실제 핸들러와 맞는지 먼저 본다. 핸들러 이름이 바뀌어도 목록이 엉뚱한 라우트를 가리키지 않게 한다.
      expect(Reflect.getMetadata(PATH_METADATA, IntegrationsController)).toBe(
        'integrations',
      );
      expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(path);
      expect(Reflect.getMetadata(`${THROTTLER_LIMIT}default`, handler)).toBe(
        CONNECTION_TEST_THROTTLE.limit,
      );
      expect(Reflect.getMetadata(`${THROTTLER_TTL}default`, handler)).toBe(
        CONNECTION_TEST_THROTTLE.ttl,
      );
    },
  );
});
