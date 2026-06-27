# Testing Review

## 발견사항

### [INFO] `as never` → `as unknown as RedisConnectionProvider` 타입 캐스트 정제 (파일 1, 파일 2)
- 위치: `execution-seq-allocator.service.spec.ts` makeAllocator·getClient 테스트 3곳 + `execution-seq-allocator-load.e2e-spec.ts` beforeAll
- 상세: `as never` 는 TypeScript 에서 가장 관대한 탈출구로, 인터페이스 drift 를 컴파일 타임에 전혀 잡지 못한다. 이번 변경은 `as unknown as RedisConnectionProvider` 로 교체해 최소한 중간 단계(`unknown`)를 명시적으로 통과하도록 했다. e2e 파일의 `makeProvider` 는 `Pick<RedisConnectionProvider, 'getClient' | 'getClientOrNull'>` 로 타입을 제한해 두 메서드 시그니처가 인터페이스 drift 시 컴파일 에러로 잡히게 했다 — 이는 개선이다.
- 제안: 현재 방식으로 충분. 추가 개선 원한다면 unit spec 의 `makeRedisConn` 반환 타입도 `Pick<RedisConnectionProvider, 'getClient' | 'getClientOrNull'>` 로 명시적으로 타입하면 e2e 와 동일한 시그니처 검사 수준이 된다.

### [INFO] e2e 상수 추출 (`LATENCY_WARMUP_COUNT`, `LATENCY_SAMPLE_COUNT`) — 가독성 향상 (파일 2)
- 위치: `execution-seq-allocator-load.e2e-spec.ts` L43-44 및 warmup/latency 루프
- 상세: 인라인 리터럴(`WARMUP = 20`, `SAMPLES = 200`)을 모듈 상단 상수로 올린 변경이다. log 메시지의 `SAMPLES` 참조도 `LATENCY_SAMPLE_COUNT` 로 일관되게 수정됐다. 가독성·유지보수성 향상이며 기능 변경 없음.
- 제안: 개선 사항. 추가 조치 불필요.

### [INFO] `workspace-invitations-pruner` 큐 추가 — 누락 시 e2e 회귀 방지 (파일 3)
- 위치: `system-status.e2e-spec.ts` EXPECTED_QUEUE_NAMES 배열
- 상세: `WorkspaceInvitationsPrunerService` 신설에 맞춰 `EXPECTED_QUEUE_NAMES` 에 `'workspace-invitations-pruner'` 를 추가했다. 파일 상단 주석("큐 추가 시 본 목록도 갱신")이 안내하는 대로 정확히 동기화됐다. 이 e2e 테스트는 실제 BullMQ 인프라와 대조하므로 큐가 누락되면 `names` 비교(`toEqual`)가 즉시 실패해 회귀를 잡는다.
- 제안: 적절. `MONITORED_QUEUES` 상수 파일과 이 배열이 동기화되어야 한다는 사실을 CI에서 강제하는 자동화(예: 상수 파일을 파싱하는 스크립트 기반 테스트)가 있으면 인간 실수를 제거할 수 있으나, 현재 블랙박스 e2e 방식도 런타임에 실패를 충분히 포착한다.

### [INFO] `sanitize` private 정적 메서드 미테스트
- 위치: `execution-seq-allocator.service.ts` L153-157
- 상세: `sanitize(value)` 는 CR/LF/탭 제거 + 128자 cap 을 수행하며 로그 인젝션 방지 목적으로 사용된다. 현재 unit spec 에는 이 메서드에 대한 직접 테스트가 없다. 보안 관련 유틸리티지만 private static 이므로 인터페이스를 통한 간접 검증(즉 악의적 executionId 로 next/release 를 호출해 로그 경로를 통과시키는 방식)도 가능하다.
- 제안: 경계값(128자 초과 문자열, CR/LF/탭 포함 문자열) 을 executionId 로 사용하는 테스트 케이스 1~2개를 추가하면 커버리지 갭이 해소된다. 현 변경 범위 외이므로 별도 follow-up.

### [INFO] `release` 의 DEL 실패(catch) 경로 미검증
- 위치: `execution-seq-allocator.service.ts` L135-143
- 상세: `release` 내부 `client.del(key).catch(...)` 에서 DEL 실패 시 경고를 기록하는 경로가 unit spec 에서 검증되지 않는다. `del` mock 이 reject 를 반환하는 케이스가 없다.
- 제안: `del: jest.fn(async () => { throw new Error('DEL error'); })` 를 override 한 FakeRedis 를 사용하는 테스트 케이스 추가. 현 변경 범위 외이므로 별도 follow-up.

## 요약

이번 변경의 핵심은 `as never` → `as unknown as RedisConnectionProvider` 로의 캐스트 정제, e2e 상수 추출, 그리고 신규 큐의 e2e 목록 동기화이다. 모두 기능 변경이 아닌 타입 안전성·가독성·회귀 방지 개선이다. 기존 테스트 구조(단위/e2e 분리, FakeRedis 격리, provider mock 단일 레이어, afterEach 환경변수 복원, beforeAll/afterAll Redis 연결 생명주기)는 이미 높은 품질이며 이번 변경 후에도 유효하다. `sanitize` 및 `release` DEL 실패 경로는 기존 커버리지 갭이고 이번 변경과 무관하여 별도 follow-up 대상이다.

## 위험도

NONE
