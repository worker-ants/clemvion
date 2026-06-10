# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] `toEiaEvent` deprecated alias 완전 제거 — 이름-의미 불일치 해소
- 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` (제거된 마지막 7줄)
- 상세: `toEiaEvent`는 실제로 chat-channel-internal variant도 반환하는 함수를 가리켰으므로 함수명이 반환 의미를 정확히 반영하지 못했다. 이번 변경에서 alias를 완전 제거하고 모든 호출부를 `toChatChannelEvent`로 일원화하여 함수명과 반환 의미가 일치하게 되었다. 유지보수성 관점에서 긍정적인 개선이다.
- 제안: 없음. 변경 방향이 올바르다.

### [INFO] 테스트 파일 `describe` 블록 제목 일관성 개선
- 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts` — 전체 diff
- 상세: `describe('toEiaEvent — ...')` 형태 제목이 여러 곳에 분산되어 있었는데 모두 `toChatChannelEvent`로 일관되게 수정되었다. 테스트 실패 메시지에서 어떤 함수 계약이 깨진 것인지 즉시 식별 가능해진다.
- 제안: 없음.

### [INFO] `deepFreeze` / `freezeSharedCacheValues` 헬퍼 — 함수 분리 적절
- 위치: `codebase/backend/src/modules/execution-engine/containers/parallel-executor.ts` (신규 추가 블록)
- 상세: 재귀 freeze 로직을 `deepFreeze`에, 조건부 적용 로직을 `freezeSharedCacheValues`에 분리한 구조는 단일 책임 원칙을 잘 따른다. 두 함수 모두 10줄 이하이며 중첩 깊이도 2 이하로 낮다.
- 제안: 없음.

### [WARNING] `FREEZE_BRANCH_CACHE` 상수 — 모듈 최상단 위치의 가시성 우려
- 위치: `codebase/backend/src/modules/execution-engine/containers/parallel-executor.ts`, `const FREEZE_BRANCH_CACHE = process.env.NODE_ENV !== 'production';`
- 상세: 해당 상수는 dev/test 전용 guard를 위해 존재하지만, 모듈 스코프 상수로 선언되어 있어 이 파일을 import하는 외부 코드가 직접 참조하거나 오용할 가능성이 있다. 파일 내부에서만 사용되는 값이므로 `export` 없이 모듈 프라이빗임은 보장되나, 파일 레벨에 배치된 `process.env.NODE_ENV` 의존은 모듈 로드 시점에 한 번만 평가된다는 점이 테스트 환경에서 예상치 못한 결과를 낳을 수 있다(테스트가 `process.env.NODE_ENV`를 바꾸더라도 이미 평가된 값은 변경되지 않음).
- 제안: 중요도가 높지는 않지만, `freezeSharedCacheValues` 내부에서 `process.env.NODE_ENV !== 'production'`을 직접 평가하거나, 상수 이름을 `IS_DEV_OR_TEST_ENV`처럼 더 일반적인 의미로 짓는 것도 고려 가능하다.

### [INFO] `registerContinuationHandlers` no-op stub 완전 제거 — dead code 정리
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (제거된 블록), `codebase/backend/src/modules/execution-engine/continuation/continuation-bus.service.ts` (제거된 `on()` 메서드)
- 상세: Phase 2 이행 후에도 하위 호환용으로 남아 있던 `registerContinuationHandlers()` empty stub과 `ContinuationBusService.on()` no-op 메서드가 삭제되었다. 관련 테스트 훅 호출(`registerContinuationHandlers()` 직접 호출 2건)도 동반 제거되어 코드가 현재 아키텍처(BullMQ Worker 기반)를 정확히 반영한다. deprecated 코드가 제거되어 미래 개발자가 혼란을 겪을 여지가 줄었다.
- 제안: 없음.

### [INFO] `system-status.constants.ts` — deprecated 상수 2건 제거
- 위치: `codebase/backend/src/modules/system-status/system-status.constants.ts` (제거된 마지막 4줄)
- 상대: `FAILED_DEGRADED_THRESHOLD`, `DELAYED_DEGRADED_THRESHOLD` 두 deprecated 상수가 제거되었다. 이들을 가리키던 JSDoc에 이미 "getter를 사용하세요"라는 안내가 있었으므로, 제거 후에도 기능 손실이 없다. 유지보수성 관점에서 모듈 로드 시점에 env를 평가하는 부작용 있는 상수를 게터 함수로 대체한 기존 방향이 더 올바르며, 이번 제거가 그 방향을 완성한다.
- 제안: 없음.

### [INFO] `continuation-bus.service.spec.ts` — no-op `on()` 테스트 제거
- 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-bus.service.spec.ts` (제거된 `describe('on() — Phase 2 부터 no-op')` 블록)
- 상세: 제거된 테스트는 이미 no-op이 된 `on()` 메서드의 존재 여부를 검증하던 것으로, 메서드 자체가 삭제됨에 따라 이 테스트도 함께 제거되었다. 존재하지 않는 API를 검증하는 테스트는 오히려 혼란을 야기하므로 제거가 맞다.
- 제안: 없음.

### [INFO] 주석 동기화 — `websocket.service.ts`, `websocket.service.spec.ts` JSDoc 갱신
- 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:49` 및 `websocket.service.spec.ts:370`
- 상세: `toEiaEvent` → `toChatChannelEvent` 이름 변경이 인라인 JSDoc 및 테스트 주석까지 빠짐없이 반영되어 있다. 주석과 코드가 일치하지 않으면 읽기 혼란이 생기는데, 이번 변경은 그 위험을 제거한다.
- 제안: 없음.

### [INFO] plan 파일 상태 갱신 — `[ ]` → `[x]` 완료 마킹
- 위치: `plan/in-progress/refactor/03-maintainability.md`, `plan/in-progress/refactor/06-concurrency.md`
- 상세: 구현 완료된 항목(M-6, M-5)이 `[x]`로 마킹되고, planner 선행이 필요한 항목(M-1, m-4)이 `⏭️` 기호와 함께 이유 및 후속 조치가 명기되었다. 이는 계획 추적의 가독성을 높이는 긍정적 변경이다.
- 제안: 없음.

---

## 요약

이번 변경은 주로 세 가지 범주로 구성된다. (1) `toEiaEvent` deprecated alias 및 관련 no-op dead code(`registerContinuationHandlers`, `ContinuationBusService.on()`, deprecated 상수 2건) 완전 제거, (2) parallel branch cache에 dev/test 전용 deep freeze 가드(`freezeSharedCacheValues`) 추가, (3) 이름 변경(`toEiaEvent` → `toChatChannelEvent`)을 모든 호출부·주석·테스트에 일관 반영. 코드 복잡도와 중첩 깊이 모두 낮고, 함수 길이도 적정하다. dead code 제거와 이름 정렬이 유지보수성을 실질적으로 개선하였으며, 새로 추가된 `deepFreeze` / `freezeSharedCacheValues` 헬퍼도 단일 책임 원칙을 준수한다. 유일한 경미한 주의 사항은 `FREEZE_BRANCH_CACHE`가 모듈 로드 시 env를 한 번만 평가하는 구조인데, 테스트에서 `NODE_ENV`를 동적으로 변경하는 경우 예상과 다를 수 있다는 점이다.

---

## 위험도

LOW

STATUS: SUCCESS
