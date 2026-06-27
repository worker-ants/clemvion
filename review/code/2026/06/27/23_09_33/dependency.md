# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** `import type` 을 통한 내부 타입 참조 추가 (순수 타입 import, 런타임 의존성 없음)
  - 위치: `codebase/backend/src/modules/websocket/execution-seq-allocator.service.spec.ts` L2, `codebase/backend/test/execution-seq-allocator-load.e2e-spec.ts` L536
  - 상세: `RedisConnectionProvider` 를 `import type` 으로만 참조. 런타임 번들에 포함되지 않으며(테스트 파일이기도 함), 컴파일 이후 에미트가 없다. 기존 내부 모듈(`../../common/redis/redis-connection.provider`)을 재참조하므로 신규 외부 패키지 추가 없음.
  - 제안: 현 상태 유지. `import type` 패턴은 순환 의존·번들 크기 측면에서 권장되는 방식.

- **[INFO]** `as never` → `as unknown as RedisConnectionProvider` 캐스트 변경 — 내부 의존 관계 명시화
  - 위치: spec.ts 파일 내 `makeAllocator` 및 직접 생성 호출 지점 전체 (6개소), e2e 파일 `beforeAll` 내 2개소
  - 상세: 기존 `as never` 는 TypeScript 타입 시스템을 맹목적으로 우회하는 unsafe cast. 변경 후 `as unknown as RedisConnectionProvider` 는 중간 타입을 거치는 관용적 double-cast 로, 타입 명칭이 명시되어 인터페이스 drift 시 컴파일 에러로 탐지 가능하다. 내부 모듈 간 의존 관계(test → provider 타입)가 `import type` 으로 정확히 선언되어 의도가 드러난다.
  - 제안: 변경 방향이 올바름. e2e 파일의 `makeProvider` 가 `Pick<RedisConnectionProvider, 'getClient' | 'getClientOrNull'>` 로 반환 타입을 좁혀 두어, 두 메서드 시그니처는 컴파일 시 검사된다는 점이 추가 안전망이다.

- **[INFO]** `workspace-invitations-pruner` 큐 추가 (e2e 상수 목록 변경)
  - 위치: `codebase/backend/test/system-status.e2e-spec.ts` L789
  - 상세: `EXPECTED_QUEUE_NAMES` 배열에 문자열 리터럴 추가. 신규 외부 패키지 아님. BullMQ 는 이미 `bullmq ^5.76.6` 으로 고정되어 있으며 신규 큐 등록은 의존성 변경이 아닌 애플리케이션 설정 변경. 기존 BullMQ 의존성 범위 내에서 처리 가능.
  - 제안: 이상 없음.

- **[INFO]** 매직 넘버 상수화 (`LATENCY_WARMUP_COUNT`, `LATENCY_SAMPLE_COUNT`)
  - 위치: `codebase/backend/test/execution-seq-allocator-load.e2e-spec.ts` L492-494
  - 상세: 파일 상단에 모듈 스코프 상수로 추출. 의존성 변경 없음. 가독성 향상.
  - 제안: 이상 없음.

- **[INFO]** 신규 외부 패키지 추가 없음 — `package.json` 변경 없음
  - 위치: `codebase/backend/package.json`
  - 상세: diff 범위 4개 파일 중 `package.json` 변경이 없다. 기존 `ioredis`(ioredis 패키지는 `bullmq` 피어 의존으로 이미 존재), `@jest/globals`, `supertest` 모두 기존 의존성.
  - 제안: 이상 없음.

## 요약

이번 변경은 테스트 파일 3개와 plan 문서 1개로 구성되며, 신규 외부 패키지 추가가 전혀 없다. 핵심 의존성 변화는 `as never` 캐스트를 `as unknown as RedisConnectionProvider` 로 교체하면서 기존 내부 모듈 타입을 `import type` 으로 명시 참조한 것뿐이다. 이는 런타임 의존성이 아니며 번들 크기·빌드 시간·라이선스·취약점에 아무 영향이 없다. 내부 의존 관계 측면에서는 test 계층이 provider 인터페이스를 타입 레벨에서 명시적으로 참조하도록 개선되어 drift 탐지 능력이 향상된다.

## 위험도

NONE
