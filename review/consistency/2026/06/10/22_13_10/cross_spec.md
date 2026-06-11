# Cross-Spec 일관성 검토 결과

검토 대상: `spec/5-system/4-execution-engine.md`, `spec/data-flow/14-chat-channel.md`, `spec/5-system/16-system-status-api.md`, `spec/4-nodes/1-logic/10-parallel.md`
검토 범주: dead code 제거 (03 M-6·m-2) + parallel branch dev/test deep freeze (06 M-5)
diff-base: origin/main

---

## 발견사항

### INFO-1: `toChatChannelEvent` 함수명 — spec 에 이미 반영됨, alias 제거 일치

- target 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` — `toEiaEvent` alias 삭제
- 충돌 대상: `spec/data-flow/14-chat-channel.md` 116행
- 상세: `spec/data-flow/14-chat-channel.md` 는 이미 `toChatChannelEvent` 를 기준 함수명으로 사용한다 (`renderNode(toChatChannelEvent(event), config)`). `toEiaEvent` alias 삭제는 이 spec 과 일치한다. 다른 spec 영역에서 `toEiaEvent` 를 참조하는 곳은 발견되지 않는다.
- 제안: 충돌 없음. 정합 완료 상태.

---

### INFO-2: `ContinuationBusService.on()` 메서드 삭제 — spec 이미 BullMQ 단일 경로 기술

- target 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-bus.service.ts` — `on()` 메서드 제거
- 충돌 대상: `spec/5-system/4-execution-engine.md §7.4` Continuation Bus 절
- 상세: spec §7.4 는 "모든 진입점은 항상 BullMQ enqueue" 및 "full B3 — in-process `pendingContinuations` Map 은 제거됐으므로 같은 인스턴스 local resolve 분기 자체가 더 이상 존재하지 않는다" 고 명시한다. `ContinuationBusService.on()` 이라는 pub/sub 시대의 listener 등록 API 는 이 spec 과 의미 불일치 상태였으므로 삭제는 spec 과 일치한다. `spec/data-flow/3-execution.md` 의 `ContinuationBusService` 언급도 `.publish()` 기반으로만 기술되어 있다.
- 제안: 충돌 없음.

---

### INFO-3: `ExecutionEngineService.registerContinuationHandlers()` no-op stub 삭제 — spec 과 일치

- target 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `registerContinuationHandlers` 메서드 전체 및 `onModuleInit` 호출부 제거
- 충돌 대상: `spec/5-system/4-execution-engine.md §7.4`
- 상세: spec §7.4 는 "옛 pub/sub 기반 listener 등록은 완전 폐기됨 (full B3)" 을 명시한다. stub 유지의 명시적 이유는 없었으며 삭제는 spec 과 정합한다. test 코드에서 `registerContinuationHandlers()` 를 직접 호출하던 setup 훅도 함께 제거됐다.
- 제안: 충돌 없음.

---

### INFO-4: `FAILED_DEGRADED_THRESHOLD` / `DELAYED_DEGRADED_THRESHOLD` exported 상수 삭제

- target 위치: `codebase/backend/src/modules/system-status/system-status.constants.ts` — `FAILED_DEGRADED_THRESHOLD` / `DELAYED_DEGRADED_THRESHOLD` 두 `@deprecated` 상수 삭제
- 충돌 대상: `spec/5-system/16-system-status-api.md §3`
- 상세: spec §3 은 상수 이름 `FAILED_DEGRADED_THRESHOLD` / `DELAYED_DEGRADED_THRESHOLD` 를 코드상수 ↔ env 매핑 설명에 참조 표기한다 (`FAILED_DEGRADED_THRESHOLD` ← `SYSTEM_STATUS_FAILED_THRESHOLD`). 삭제된 것은 **모듈-로드 시점 고정 값 export** 이고, getter 함수 `getFailedDegradedThreshold()` / `getDelayedDegradedThreshold()` 는 유지됐다. spec §3 의 상수명 언급은 "코드 내 상수 이름" 을 가리키는 용도인데, getter 로 대체된 내부 구현 상수를 상징적으로 지칭한 것이라면 문제 없다. 그러나 spec 본문이 직접 "코드상수 이름" 으로 `FAILED_DEGRADED_THRESHOLD` 를 노출하고 있으므로 해당 이름이 코드에서 사라졌을 때 spec 독자가 혼동할 수 있다.
- 제안: `spec/5-system/16-system-status-api.md §3` 의 상수 매핑 문장을 `getFailedDegradedThreshold()` / `getDelayedDegradedThreshold()` getter 로 갱신하거나, spec 표기를 "env-driven 동적값" 으로 추상화 수준을 높여 코드 이름 종속을 제거하는 것을 권장한다.

---

### WARNING-1: `FREEZE_BRANCH_CACHE` / `freezeSharedCacheValues` — spec 에 미기술

- target 위치: `codebase/backend/src/modules/execution-engine/containers/parallel-executor.ts` — `FREEZE_BRANCH_CACHE` export 상수 + `deepFreeze` + `freezeSharedCacheValues` 신규 추가
- 충돌 대상: `spec/4-nodes/1-logic/10-parallel.md §4 실행 로직 4번` / P1 구현 상태 섹션
- 상세: `spec/4-nodes/1-logic/10-parallel.md` 는 branch context 격리를 "`variables` 는 `structuredClone` deep clone, `nodeOutputCache` 는 shallow copy 격리" 로 기술하고, code comment 내 "spec `4-nodes/1-logic/10-parallel.md` 명시 설계" 를 freeze 도입 근거로 인용한다. 그러나 spec 에는 `FREEZE_BRANCH_CACHE` 환경별 활성화, `deepFreeze`, "값 내부 mutate 금지 invariant 를 dev/test 에서 기계 강제" 동작이 **기술되어 있지 않다**. code JSDoc 이 spec 을 근거로 인용하지만 실제 spec 에는 freeze 메커니즘이 없다. spec `structuredOutputCache` 필드도 spec 문서에는 등장하지 않는다 (execution-context.md 에는 `nodeOutputCache` 만 언급).
- 잠재 영향: (a) 외부 기여자가 spec 만 읽으면 dev/test 환경에서 branch cache 값 mutate 시 TypeError 를 맞닥뜨릴 이유를 알 수 없다. (b) 향후 node handler 작성 시 "값 내부 mutate 금지" invariant 가 spec 에 명시되지 않아 위반 핸들러가 추가될 수 있다.
- 제안: `spec/4-nodes/1-logic/10-parallel.md §4 실행 로직 4번` 또는 `spec/conventions/execution-context.md` 에 "branch-local `nodeOutputCache` / `structuredOutputCache` 의 값 객체는 공유됨 — handler 는 값 내부를 mutate 해서는 안 된다 (dev/test 환경에서 `Object.freeze` 로 기계 강제)" 를 추가할 것을 권장한다. 동시에 `structuredOutputCache` 필드를 `spec/conventions/execution-context.md §1` 에 추가한다.

---

## 요약

이번 구현 변경(dead code 제거 M-6·m-2 + parallel branch freeze M-5)에서 직접적인 spec 모순은 발견되지 않는다. `toEiaEvent` alias 삭제·`ContinuationBusService.on()` 삭제·`registerContinuationHandlers` stub 삭제는 각각 `spec/data-flow/14-chat-channel.md` 와 `spec/5-system/4-execution-engine.md §7.4` 의 현행 기술과 일치한다. 다만 두 가지 동기화 권장 항목이 있다: (1) `spec/5-system/16-system-status-api.md §3` 가 코드에서 삭제된 exported 상수명 `FAILED_DEGRADED_THRESHOLD` / `DELAYED_DEGRADED_THRESHOLD` 를 여전히 직접 참조하고 있어 독자 혼동이 생길 수 있고, (2) `spec/4-nodes/1-logic/10-parallel.md` 및 `spec/conventions/execution-context.md` 에 `FREEZE_BRANCH_CACHE` 기반 dev/test invariant 가드와 `structuredOutputCache` 필드 정의가 누락되어 있어 spec-impl 괴리가 발생한다. 두 항목 모두 운영 방해 수준은 아니나 spec 단일 진실 원칙상 동기화가 권장된다.

## 위험도

LOW
