# 신규 식별자 충돌 검토 — spec/5-system/14-external-interaction-api.md (impl-done)

## 범위 요약

- diff-base `origin/main` 대비 spec 변경은 **1줄**(§6 종결 이벤트 필드 집합 표의 `result.cancelledBy` 행) — `retry-turn.service.ts` 누락 해소를 서술로 반영한 것뿐, 새 요구사항 ID·엔티티·endpoint·이벤트명·ENV var·파일 경로를 spec 이 새로 선언하지 않는다.
- 코드 diff(`execution-event-emitter.service.ts` / `execution-engine.service.ts` / `retry-turn.service.ts`)가 실질 변경의 대부분이며, 신규 식별자는 `TerminalEventPayload`(타입) 와 `emitTerminalExecution`(메서드) 두 개뿐이다. 아래는 이 둘을 기존 코드베이스·spec 전체에서 grep 하여 다른 의미로 이미 쓰이는지 대조한 결과다.

## 발견사항

- **[WARNING]** `emitTerminalExecution` (신규) 이 기존 `emitTerminalExecutionMetrics` 와 접두어가 거의 동일
  - target 신규 식별자: `ExecutionEventEmitter.emitTerminalExecution(executionId, payload: TerminalEventPayload)` — `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts:104`
  - 기존 사용처: `ExecutionEngineService.emitTerminalExecutionMetrics(execution, newStatus, persisted)` (private) — `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8732`, 호출부는 `:8651`·`:8721`. `git log -S`로 확인한 도입 시점은 #600 (NF-OB-07 도메인 비즈니스 메트릭, 이번 PR 과 무관한 훨씬 이전 기능).
  - 상세: 두 메서드는 클래스도(`ExecutionEventEmitter` vs `ExecutionEngineService`) 목적도(EIA §6 wire 이벤트 조립 vs Prometheus/OTel 스타일 `clemvion.execution.total{status}` 메트릭 기록) 완전히 다르지만, 이름이 `emitTerminal` 접두어를 공유하고 `Execution`/`ExecutionMetrics` 로만 갈린다. 두 호출 모두 같은 파일(`execution-engine.service.ts`)에서 발생한다 — `this.eventEmitter.emitTerminalExecution(...)` (8회, 예: `:663`, `:1113`, `:2414`, `:3398`, `:5027`) 과 `this.emitTerminalExecutionMetrics(...)` (`:8651`, `:8721`) 이 동일 소스 파일에 공존한다. `grep -n "emitTerminal"` 한 번으로 두 계열이 뒤섞여 나오고, 어느 쪽 docstring 도 상대를 교차 참조하지 않는다 — `emitTerminalExecution` 의 JSDoc(§6/§6.5 근거, `TerminalEventPayload` 링크)과 `emitTerminalExecutionMetrics` 의 JSDoc(NF-OB-07 근거) 이 서로를 언급하지 않아, 리뷰어·후속 개발자가 자동완성/grep 만으로 오인할 여지가 있다. 단, TypeScript 시그니처가 달라(전자는 `TerminalEventPayload` union, 후자는 `execution/newStatus/persisted` 3-tuple) 컴파일 타임에는 서로 대체 불가능하므로 **런타임 오동작으로 이어지는 CRITICAL 은 아니다**.
  - 제안: `emitTerminalExecution` 의 JSDoc(또는 `emitTerminalExecutionMetrics` 의 JSDoc) 에 "Not to be confused with ExecutionEngineService.emitTerminalExecutionMetrics(#600, NF-OB-07 메트릭 전용)" 형태의 상호 참조 한 줄을 추가해 grep/추론 시 오인을 방지할 것을 권장. 이름 자체를 바꿀 필요는 없음(각각의 명명은 자기 파일 내에서는 자연스러움).

- **[INFO]** `TerminalEventPayload` 가 기존 `TerminalErrorPayload` 와 한 단어 차이 — 이미 자체 인지·문서화됨
  - target 신규 식별자: `TerminalEventPayload` (판별 union) — `execution-event-emitter.service.ts:31`
  - 기존 사용처: `TerminalErrorPayload` (`codebase/backend/src/shared/utils/terminal-error-payload.ts`, `toTerminalErrorPayload` 로 광범위 소비 — `execution-engine.service.ts`, `retry-turn.service.ts`, `chat-channel.dispatcher.ts` 등)
  - 상세: 두 이름은 `Event`/`Error` 한 단어만 다르고, 실제로 `TerminalEventPayload` 의 `failed` variant 가 `error: TerminalErrorPayload | null` 필드로 **후자를 포함**하는 관계라 혼동 가능성이 실재한다. 다만 이 PR 의 코드 자체가 JSDoc 에서 "`TerminalErrorPayload`(에러 봉투)를 **포함하는** 관계다 — 이름을 한 단어 차이로 두면 둘을 혼동한다" 라고 명시적으로 인지·경고하고 있어, 뜻하지 않은 충돌이 아니라 의도적으로 받아들인 트레이드오프다.
  - 제안: 현행 유지 가능(이미 문서화됨). 더 명확히 하려면 `TerminalEventPayload` → `TerminalEmitPayload` 또는 `TerminalWirePayload` 같은 대안도 고려할 수 있으나 필수는 아님.

- **[없음]** 요구사항 ID / API endpoint / 이벤트명 / ENV var·config key / spec 파일 경로 — 이번 diff 는 이 카테고리에서 신규 식별자를 도입하지 않음
  - EIA-* 요구사항 ID 신규 부여 없음(§6 표 셀 텍스트 수정뿐).
  - `execution.completed`/`failed`/`cancelled` 등 wire 이벤트명은 `ExecutionEventType.EXECUTION_COMPLETED = 'execution.completed'` 등 기존 enum 값을 그대로 재사용(`websocket.service.ts:71-73`) — 새 문자열 상수 없음. `TerminalEventPayload.type`(`'completed'|'failed'|'cancelled'`) 은 TS 판별자 전용 내부 필드이며 `emitTerminalExecution` 이 조립하는 `wire` 객체에는 포함되지 않아(코드 확인: `execution-event-emitter.service.ts:126-137`) wire-level 명칭 충돌도 없음.
  - 새 REST endpoint·SSE/webhook 이벤트명·ENV var·spec 파일 경로 도입 없음.

## 요약

이번 diff 는 spec 문서 자체에는 신규 식별자를 사실상 도입하지 않으며(1줄 서술 갱신), 코드 레벨에서 신규 도입된 `TerminalEventPayload`/`emitTerminalExecution` 두 식별자도 요구사항 ID·API·이벤트명·ENV var·파일 경로 차원의 충돌은 없다. 유일한 실질 발견은 `emitTerminalExecution`(신규, 이벤트 emit facade) 이 같은 파일에서 함께 호출되는 기존 `emitTerminalExecutionMetrics`(#600, 메트릭 전용, 무관)와 이름이 근접해 grep/육안으로 혼동될 수 있다는 점이며, 타입 시그니처가 달라 컴파일 타임 오용은 불가능하므로 WARNING 수준이다. `TerminalEventPayload` vs `TerminalErrorPayload` 근접 명명은 코드 자체가 이미 인지·서술한 의도적 트레이드오프라 INFO 로 하향한다.

## 위험도
LOW
