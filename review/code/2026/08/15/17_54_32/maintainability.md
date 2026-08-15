# 유지보수성(Maintainability) Review

## 발견사항

- **[WARNING]** `TYPE_TO_EVENT` 매핑 헬퍼(3줄 매핑 + 동일한 3줄 설명 주석)가 같은 파일 안에서 **글자 그대로 두 번** 정의된다.
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts:788-797` (첫 번째 정의, `emittedTypesOuter`), 그리고 `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts:963-972` (두 번째 정의, `emittedTypes`)
  - 상세: 두 `describe` 블록 각각에서 `TYPE_TO_EVENT`(completed/failed/cancelled → `ExecutionEventType`) 상수와 그 위 3줄 주석("파사드는 `type`…")이 완전히 동일하게 반복된다. `emitTerminalExecution` 도입으로 기존 `emittedTypes()`/`emittedTypesOuter()` 헬퍼를 되매핑해야 했던 사정은 이해되지만, 이 매핑 자체는 어떤 `describe`-지역 상태에도 의존하지 않으므로 지역 정의로 남길 이유가 없다.
  - 제안: 파일 상단(다른 `describe` 밖, 최상위 `describe('RetryTurnService', ...)` 진입부 또는 파일 스코프)에 `TYPE_TO_EVENT` 상수 하나만 두고 두 헬퍼가 이를 공유하게 한다. 향후 `ExecutionEventType` 값이 바뀌거나 새 종결 타입이 추가될 때 한 곳만 고치면 되도록.

- **[INFO]** plan 문서의 설계 섹션이 실제 구현과 다른 메서드명을 쓴다.
  - 위치: `plan/in-progress/eia-terminal-emit-facade.md:72` ("## 설계" 절, `` `emitTerminalExecutionEvent(executionId, payload)` `` 로 표기) vs 실제 구현 `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts:87` (`emitTerminalExecution`)
  - 상세: 같은 문서의 "조치" 체크리스트(`- [x] ExecutionEventEmitter.emitTerminalExecution 추가`, 100번 줄)와 `spec-sync-external-interaction-api-gaps.md` 쪽은 정확한 이름(`emitTerminalExecution`)을 쓰는데, "설계" 절 코드 스니펫만 초안 단계 이름(`emitTerminalExecutionEvent`)이 남아 있다. 코드 자체에는 영향 없지만, 이 plan 문서를 나중에 참조해 시그니처를 찾는 사람이 실제 심볼명과 다른 이름을 보고 혼동할 수 있다.
  - 제안: 문서 내 함수명을 실제 구현과 통일(`emitTerminalExecution`)한다.

- **[INFO]** `emitTerminalExecution` 내부에서 조립하는 출력(`wire`)이 `Record<string, unknown>` 이라, 이 리팩터가 강조하는 "컴파일 타임 강제"는 **입력**(`TerminalEventPayload`)에만 적용되고 **조립 결과**는 구조적 타입 검증을 받지 않는다.
  - 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts:94-121` (`emitTerminalExecution` 본문 — `const wire: Record<string, unknown> = {...}` 이후 `if (payload.type === 'failed') wire.error = ...` / `else if (payload.type === 'cancelled') { wire.result = ...; if (payload.error) wire.error = ...; }`)
  - 상세: 이 파일의 JSDoc(12-30번 줄)은 "필수 필드를 컴파일 타임에 막는다"를 반복 강조하는데, 정작 wire 조립부는 `Record<string, unknown>` 에 문자열 키로 값을 대입하는 구조라 `wire.eror` 같은 오타가 나도 `tsc` 가 잡지 못한다. 지금은 이 함수 하나에 로직이 응집돼 있어 실질 위험은 낮지만(단일 지점·신규 위 4건 회귀 테스트가 wire 형태를 고정), 향후 필드가 늘어나는 변경에서는 잠재적 취약점이다.
  - 제안: `wire` 를 `Record<string, unknown>` 대신 명시적 union 리턴 타입(예: 세 분기 각각 알맞은 리터럴 타입)으로 구성하거나, 최소한 `wire` 대입부에 필드명 오타를 방지할 헬퍼 타입을 두면 이 리팩터의 취지가 조립부까지 일관되게 적용된다. (현재도 테스트로 방어되므로 급하지 않음.)

## 요약

핵심 변경은 `ExecutionEventEmitter.emitTerminalExecution` 이라는 판별 union 파사드를 도입해, 8곳의 호출부(`execution-engine.service.ts` 6곳, `retry-turn.service.ts` 2곳)에 흩어져 있던 `{status, durationMs, error?, result?}` 수작업 조립을 제거한 리팩터다. 각 호출부는 `type` 하나만 고르면 되고 `status`/이벤트명 파생과 `cancelledBy`/`error` 키 부재 규칙은 파사드 한 곳에 응집됐다 — 이는 실제로 반복 결함(#1170/#1171/#1172)의 근본 원인을 제거하는 정공법이며, 죽은 import(`ExecutionEventType` in `retry-turn.service.ts`)도 함께 정리됐다. 순환 import로 인한 "모듈 스코프 파생 금지" 제약과 그 이유를 함수 안에 명시적으로 남긴 점, 그리고 wire 형태(특히 user-cancel 시 `error` 키 자체 부재)를 `Object.keys` 로 직접 단언하는 신규 테스트 4건은 유지보수성 관점에서 모범적이다. 남은 흠은 경미한 수준 — 테스트 파일 내 헬퍼 중복 1건(WARNING)과 문서 네이밍 드리프트·출력 타입 느슨함(INFO 2건)뿐이며, 전체적으로 이 PR은 유지보수성을 개선하는 방향의 변경이다.

## 위험도
LOW
