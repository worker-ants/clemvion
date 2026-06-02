# 성능(Performance) 코드 리뷰

## 발견사항

- **[WARNING]** `inspect()` 내에서 `getJobCounts`와 `isPaused`를 순차 호출
  - 위치: `codebase/backend/src/modules/system-status/system-status.service.ts` lines 628–642
  - 상세: `inspect()` 내부에서 `await handle.queue.getJobCounts(...)` 완료 후 `await handle.queue.isPaused()`를 순차적으로 호출한다. 두 호출은 서로 의존 관계가 없으므로 순차 실행은 불필요하다. 큐 1개당 Redis round-trip이 2회 발생하고, 현재 12개 큐를 `Promise.all`로 병렬 처리(`getOverview` line 604)하더라도 각 큐 내부에서 2 RTT가 직렬 발생한다.
  - 제안: `Promise.all([handle.queue.getJobCounts(...), handle.queue.isPaused()])` 로 병렬화하면 큐당 레이턴시를 절반으로 줄일 수 있다.

- **[INFO]** 5초 폴링에 결과 캐싱 없음 — 다중 사용자 시나리오에서 Redis 부하 선형 증가
  - 위치: `codebase/frontend/src/app/(main)/system-status/page.tsx` line 939 (`refetchInterval: 5000`), `system-status.service.ts`
  - 상세: 5초마다 `/system-status/overview`를 폴링하며, 서버 측에서 매 요청마다 12개 큐 × 2 Redis 호출이 발생한다. 결과 캐싱이 없으므로 N명 동시 접속 시 초당 N번의 12-큐 Redis 조회가 발생한다.
  - 제안: `getOverview()` 결과를 3~5초 TTL로 in-memory 캐싱하면 다중 사용자 시나리오에서 Redis 요청 수를 상수화할 수 있다. 관리자 모니터링 특성상 수초 오래된 데이터는 허용 가능하다.

- **[INFO]** 프론트엔드에서 `data.queues.filter()` 를 렌더마다 반복 실행
  - 위치: `codebase/frontend/src/app/(main)/system-status/page.tsx` lines 994–995
  - 상세: `GROUP_ORDER.map(group => data.queues.filter(q => q.group === group))` 는 4개 그룹 × 12개 큐 = 최대 48회 비교를 매 렌더마다 수행한다. 5초 폴링으로 인한 빈번한 리렌더에서 반복된다.
  - 제안: `useMemo(() => groupBy(data.queues, q => q.group), [data])` 로 그룹핑을 메모이제이션하면 불필요한 재연산을 방지할 수 있다. 현재 규모에서는 체감 영향이 없으나 큐 수 증가 시를 대비한 예방적 개선이다.

- **[INFO]** 에러 경로에서 `{ ...ZERO_COUNTS }` 불필요한 스프레드 복사
  - 위치: `codebase/backend/src/modules/system-status/system-status.service.ts` line 657
  - 상세: 에러 경로에서 `{ ...ZERO_COUNTS }` 로 새 객체를 생성하나, 이 DTO는 직렬화 후 버려지므로 불변 싱글턴을 직접 참조해도 안전하다.
  - 제안: `counts: ZERO_COUNTS` 로 직접 참조하거나, 방어적 복사가 의도라면 주석으로 이유를 명시한다.

- **[INFO]** 모듈 임포트 시점에 `process.env` 즉시 읽어 상수로 고정
  - 위치: `codebase/backend/src/modules/system-status/system-status.constants.ts` lines 197–198, 231–234
  - 상세: `FAILED_DEGRADED_THRESHOLD`, `DELAYED_DEGRADED_THRESHOLD`, `continuationConcurrency`가 모듈 로드 시 1회 읽혀 상수화된다. 테스트 환경에서 환경변수 변경 후 모듈 캐시로 인해 재로드되지 않아 임계값 변경 테스트 추가 시 격리가 깨질 수 있다.
  - 제안: 현재 유닛 테스트는 서비스 생성자에 핸들을 직접 주입하므로 문제없다. 임계값 조건부 테스트가 추가되면 서비스 생성자 파라미터로 주입 가능하게 리팩터링을 고려한다.

## 요약

전체적으로 성능 관점에서 설계가 양호하다. 12개 큐를 `Promise.all`로 병렬 처리하고 `sharedConnection: true`로 Redis 연결을 공유하는 구조는 올바른 선택이다. 가장 실질적인 개선 여지는 `inspect()` 내에서 `getJobCounts`와 `isPaused`를 순차 호출하는 부분으로, 두 호출을 `Promise.all`로 병렬화하면 큐당 1 Redis RTT를 절약할 수 있다. 5초 폴링에 캐싱이 없어 다중 사용자 시나리오에서 Redis 부하가 선형 증가할 가능성이 있으나, 관리자 모니터링 페이지 특성상 동시 접속자가 많지 않을 것으로 예상되어 현재 규모에서의 실질적 우려 수준은 낮다. 나머지 발견사항은 코드 정확성에 영향 없는 미세 최적화 수준이다.

## 위험도

LOW
