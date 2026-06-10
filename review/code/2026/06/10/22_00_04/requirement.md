# 요구사항(Requirement) 리뷰

**리뷰 대상**: refactor-approved-batch (2026-06-10)
- 03 M-6: `registerContinuationHandlers` no-op 제거 + `ContinuationBusService.on()` 제거
- 03 m-2: `toEiaEvent` deprecated alias 제거 + `system-status.constants.ts` 상수 2건 제거
- 06 M-5: `ParallelExecutor` branch `nodeOutputCache` dev/test deep freeze

---

## 발견사항

### **[INFO]** [SPEC-DRIFT] `toChatChannelEvent` 함수명이 spec 시퀀스 다이어그램에 반영됐으나 spec 본문 서사가 미갱신
- 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` (alias 제거), `spec/data-flow/14-chat-channel.md` 라인 116
- 상세: `spec/data-flow/14-chat-channel.md:116` 의 시퀀스 다이어그램은 `toChatChannelEvent(event)` 를 이미 반영하고 있어 alias 제거와 정합된다. 테스트 파일(`chat-channel.dispatcher.spec.ts`)의 모든 `toEiaEvent` 호출도 `toChatChannelEvent` 로 일관되게 교체됐다. 기능 완전성에 문제 없음.
- `spec/conventions/chat-channel-adapter.md` 는 `toChatChannelEvent`/`toEiaEvent` 를 직접 언급하지 않으므로 추가 drift 없음.
- 제안: 코드 유지 + `spec/data-flow/14-chat-channel.md` 서사 본문(Overview 아닌 §1 구현 상태 메모 등)에 `toEiaEvent` deprecated alias 폐기 시점(2026-06-10) 주석이 있다면 정리. 현재로서는 별도 조치 불필요.

---

### **[INFO]** [SPEC-DRIFT] `ContinuationBusService.on()` 메서드 제거 — spec §7.4 는 이미 BullMQ 단일 경로만 기술하나, 코드 제거 사실이 spec 구현 상태 메모에 미반영
- 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-bus.service.ts` (on() 제거), `/Volumes/project/private/clemvion/spec/5-system/4-execution-engine.md §7.4`
- 상세: spec §7.4 "라우팅 원칙" 은 이미 "모든 진입점은 항상 BullMQ enqueue", "full B3 으로 in-process `pendingContinuations` Map 은 제거됐다" 고 기술한다. `on()` 메서드의 Phase 1 pub/sub 시대 역할은 폐기 완료로 spec 서술과 정합된다. 테스트에서 `on()` 호출부(Phase 2 부터 no-op 검증 블록)가 함께 제거된 것도 일관적.
- spec §7.4 의 구현 상태 메모 "(2026-06-06: 구현 완료 — PR-B2b)" 에 `on()` 제거(full B3 완성 단계)가 별도 언급되지 않는 것은 SPEC-DRIFT 로 볼 수 있으나, spec 이 이미 "full B3 완료 + in-memory 완전 제거" 를 선언하고 있으므로 실질적 내용 불일치는 없다.
- 제안: 코드 유지. spec §7.4 의 구현 상태 메모 날짜(2026-06-06)를 이번 PR 병합일(2026-06-10)로 갱신하는 것은 선택적 정리 사항. project-planner 트랙.

---

### **[INFO]** [SPEC-DRIFT] `registerContinuationHandlers` 제거 — spec §7.4 서사와 코드 일치, 그러나 spec 내 `registerContinuationHandlers` 언급 잔재 가능성
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`, `/Volumes/project/private/clemvion/spec/5-system/4-execution-engine.md`
- 상세: `execution-engine.service.ts` 의 `onModuleInit()` 에서 `this.registerContinuationHandlers()` 호출 제거 및 메서드 자체 제거가 완료됐다. `execution-engine.service.spec.ts` 의 두 테스트 훅(`:524`, `:14214`)도 함께 제거됐다. spec §7.4/§7.5 는 in-memory 경로가 아닌 BullMQ Worker 단일 경로만 기술하므로 구현·spec 방향 일치.
- 단, spec 본문에 `registerContinuationHandlers` 이름을 직접 언급하는 잔재가 있을 경우 dead reference 가 된다. 현재 grep 결과상 spec 에서 해당 심볼 직접 언급은 확인되지 않았다.
- 제안: 코드 유지. PR 리뷰 시 `spec/` 전체 grep(`registerContinuationHandlers`) 으로 잔재 여부 일회성 확인 권장.

---

### **[INFO]** [SPEC-DRIFT] `system-status.constants.ts` — `FAILED_DEGRADED_THRESHOLD` / `DELAYED_DEGRADED_THRESHOLD` 정적 상수 제거 vs spec §3 코드상수 언급
- 위치: `codebase/backend/src/modules/system-status/system-status.constants.ts` (상수 2건 제거), `/Volumes/project/private/clemvion/spec/5-system/16-system-status-api.md` §3 라인 94
- 상세: spec `16-system-status-api.md:94` 는 "코드상수 ↔ env 매핑: `FAILED_DEGRADED_THRESHOLD` ← `SYSTEM_STATUS_FAILED_THRESHOLD`(기본 1), `DELAYED_DEGRADED_THRESHOLD` ← `SYSTEM_STATUS_DELAYED_THRESHOLD`(기본 50)" 로 코드 상수 이름을 직접 참조한다. 이번 변경으로 해당 상수는 `@deprecated` getter 호출 권장 주석과 함께 삭제됐고, getter 함수 `getFailedDegradedThreshold()` / `getDelayedDegradedThreshold()` 가 계속 존재한다. spec 이 코드 상수 이름을 SoT 로 기술하고 있으나 해당 상수가 사라진 상태다.
- 이 상수들은 `@deprecated` 로 표기돼 있었고 삭제 이유(getter 를 써야 테스트 격리·런타임 반영 보장)가 파일 내 남은 JSDoc 으로 충분히 기술돼 있다. 기능 동작(degraded 판정)은 getter 를 통해 동일하게 동작한다. 따라서 "코드가 맞고 spec 이 낡음" 방향의 SPEC-DRIFT.
- 제안: 코드 유지. `spec/5-system/16-system-status-api.md §3` 라인 94 의 "`FAILED_DEGRADED_THRESHOLD` ← ..." 표현을 "`getFailedDegradedThreshold()` 함수 (env `SYSTEM_STATUS_FAILED_THRESHOLD`, 기본 1)" 형태로 갱신해야 spec 단일 진실 원칙이 복원된다. project-planner 트랙.

---

### **[INFO]** `ParallelExecutor` M-5: `deepFreeze` 가 배열 엘리먼트는 처리하지 않음 — dev/test 검출 불완전 가능성
- 위치: `codebase/backend/src/modules/execution-engine/containers/parallel-executor.ts`, `deepFreeze` 함수
- 상세: `deepFreeze` 는 `Object.values(value as Record<string, unknown>)` 로 객체 속성만 순회한다. `nodeOutputCache` 값이 배열을 포함하는 경우(`{ output: { items: [...] } }`) 배열 엘리먼트 내부 객체는 deep freeze 대상에서 빠진다. 테스트 케이스는 `{ output: { count: 1 } }` 단순 중첩 객체이므로 이 엣지 케이스를 커버하지 않는다.
- 실용 관점에서는 cache 값이 직렬화 가능한 output envelope 이라는 코드 주석과 일치하고, spec §10-parallel.md 는 freeze 동작 자체를 규정하지 않는다. dev/test 용 invariant 가드이므로 배열 엘리먼트까지 완전 freeze 되지 않아도 운영 영향은 없다. 단, freeze 가드의 목적(invariant 위반 즉시 검출)이 불완전할 수 있다는 INFO 수준 한계.
- 제안: 필수 수정은 아님. `deepFreeze` 에서 배열 처리를 추가하려면 `Array.isArray(value)` 분기를 추가하거나 `Object.values` 를 배열에도 적용하면 된다. 현재 `Object.values([1,2,3])` 는 `['1','2','3']` 형태가 아닌 원소를 반환하므로 배열의 경우 `value` 자체를 iterate 해야 한다.

---

### **[INFO]** `ContinuationBusService.on()` 제거 후 `ContinuationType` 열거가 `on()` 시그니처에서만 소비되던 것은 아닌지 확인
- 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-bus.service.ts`
- 상세: `on()` 메서드 제거로 `ContinuationType` 이 `on()` 의 파라미터 타입으로만 쓰이던 경우 타입 export 가 불필요 dead export 가 될 수 있다. 그러나 `ContinuationMessage.type` 필드 타입으로도 사용되므로 이번 변경 범위에서는 문제 없음. 확인 완료.

---

## 요약

이번 변경은 크게 세 그룹이다. (1) `toEiaEvent` deprecated alias 제거와 테스트 파일 내 호출 교체 — 기능 완전성에 영향 없고 spec `data-flow/14-chat-channel.md:116` 의 시퀀스 다이어그램과 정합된다. (2) `registerContinuationHandlers` no-op + `ContinuationBusService.on()` + 관련 테스트 훅 제거 — spec §7.4 "full B3 완료 + in-memory 완전 제거" 서사와 완전히 일치하며 기능 동작에 영향이 없다. (3) `ParallelExecutor` M-5 dev/test deep freeze 추가 — spec §10-parallel.md 의 shallow copy 결정(production 동작)을 변경하지 않고 dev/test 한정으로 invariant 위반 즉시 검출을 추가한 방어적 구현으로 의도와 구현이 일치한다. 주된 발견은 spec drift 4건으로, 모두 "코드가 옳고 spec 서술이 아직 반영하지 못한" 방향이다 — 특히 `system-status.constants.ts` 상수 제거는 `spec/5-system/16-system-status-api.md §3:94` 의 코드상수 직접 언급을 무효화하므로 project-planner 트랙의 spec 갱신이 권장된다. 기능 요구사항 관점에서 Critical/Warning 발견사항 없음.

---

## 위험도

LOW
