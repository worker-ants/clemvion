# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] `as never` → `as unknown as RedisConnectionProvider` 캐스트 교체 (파일 1, 파일 2)
- 위치: `execution-seq-allocator.service.spec.ts` (diff 전체), `execution-seq-allocator-load.e2e-spec.ts` (beforeAll)
- 상세: 기존 `as never` 는 TypeScript 가 타입 검사를 완전히 포기하는 무조건 회피였다. 이번 변경은 `as unknown as RedisConnectionProvider` 이중 캐스트로 교체해, 중간에 `unknown` 을 거치면서 최소한 의미론적 명시성을 높였다. 런타임 동작은 동일하며(캐스트는 JS 런타임에 존재하지 않음), 부작용 없음. e2e 파일에서는 추가로 `makeProvider` 반환 타입을 `Pick<RedisConnectionProvider, 'getClient' | 'getClientOrNull'>` 로 지정해 두 메서드 시그니처가 인터페이스 drift 시 컴파일 에러로 포착되도록 개선됐다.
- 제안: 없음. 이 방향이 타입 안전 개선이다.

### [INFO] 모듈 수준 상수 추출 (파일 2: `LATENCY_WARMUP_COUNT`, `LATENCY_SAMPLE_COUNT`)
- 위치: `execution-seq-allocator-load.e2e-spec.ts` 43-44번째 라인 추가
- 상세: 이전에 `it` 블록 내 지역 변수(`const WARMUP = 20`, `const SAMPLES = 200`)였던 값이 파일 최상위 `const` 로 승격됐다. TypeScript `const` 선언이므로 모듈 수준 가변 상태(전역 `let` 이나 `var`)가 아니며 값도 원시 숫자다. 읽기 전용 참조 승격이라 부작용 없음. 다른 테스트가 이 상수를 공유해 충돌할 가능성도 없다(변경 불가 숫자 리터럴).
- 제안: 없음.

### [INFO] `EXPECTED_QUEUE_NAMES` 에 `'workspace-invitations-pruner'` 추가 (파일 3)
- 위치: `system-status.e2e-spec.ts` 88번째 라인
- 상세: e2e 어설션 배열에 새 큐 이름이 추가됐다. `system-status.constants.ts` 의 `MONITORED_QUEUES` 에 `WORKSPACE_INVITATIONS_PRUNER_QUEUE` 가 이미 등록돼 있으므로 실제 API 응답 큐 목록과 일치한다. 이 변경은 테스트 기대값 동기화이며 외부 부작용이 없다. 실 BullMQ 인프라가 없는 환경에서 이 테스트가 실행되면 실패하지만, 이는 기존 e2e 인프라 의존성과 동일한 전제 조건이다.
- 제안: 없음.

### [INFO] `plan/complete/trigger-review-deferred-fixes.md` frontmatter `spec_impact` 추가 (파일 4)
- 위치: plan 파일 frontmatter 4-7번째 라인
- 상세: 완료된 plan 문서에 메타데이터 필드만 추가됐다. 코드나 런타임 동작에 영향 없음. 이 필드는 project-planner 또는 추후 consistency-check 참조용이며, 파일시스템 부작용·API·네트워크 호출 없음.
- 제안: 없음.

## 요약

이번 변경은 전부 테스트 파일 및 plan 문서 수준의 수정이다. 핵심 변경은 (1) TypeScript 타입 캐스트를 `as never` 에서 `as unknown as RedisConnectionProvider` 로 교체해 타입 명시성을 높인 것, (2) 테스트 내 매직 넘버를 모듈 상수로 추출한 것, (3) 신규 큐 등록에 맞춰 e2e 기대값 목록을 동기화한 것이다. 세 가지 모두 런타임 동작을 변경하지 않으며, 전역 상태 변경·파일시스템 부작용·시그니처·공개 API·환경 변수·네트워크·이벤트 어느 관점에서도 의도치 않은 부작용이 발견되지 않는다.

## 위험도

NONE
