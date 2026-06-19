# 문서화(Documentation) 리뷰 결과

## 발견사항

### [INFO] `EngineDriver` 합집합 alias JSDoc — 구체 멤버 수치("12 멤버") stale 위험
- 위치: `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts`, `EngineDriver` 인터페이스 JSDoc
- 상세: `EngineDriver` JSDoc 에 "12 멤버"라는 구체 수치가 명시되어 있다. ISP 분해 이후 멤버 추가·제거가 발생하면 이 수치가 실제와 달라져 stale 주석이 된다. 자동 검증 수단이 없어 관리 표류 위험이 있다.
- 제안: 수치 대신 "소비자별 부분 인터페이스(`AiTurnEngineDriver`, `RetryEngineDriver`)의 합집합" 정도의 구조 설명으로 대체하고 구체 숫자를 제거한다.

### [INFO] `FormInteractionService` 클래스 JSDoc — `EngineDriver` 타입명 참조 미갱신
- 위치: `codebase/backend/src/modules/execution-engine/form-interaction.service.ts`, 클래스 JSDoc 내 "`EngineDriver`(token `ENGINE_DRIVER`, `useExisting: ExecutionEngineService`) 경유로 호출한다"
- 상세: `driver` 필드 타입이 `EngineDriver` → `InteractionEngineDriver` 로 변경됐으나 클래스 JSDoc 의 타입 이름이 여전히 `EngineDriver` 를 언급하고 있어 독자에게 오해를 줄 수 있다.
- 제안: 클래스 JSDoc 내 `EngineDriver` → `InteractionEngineDriver` 로 수정한다.

### [INFO] `ContinuationExecutionProcessor` 클래스 JSDoc — retry_last_turn 의 분기 경로 미언급
- 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-execution.processor.ts`, 클래스 상단 JSDoc (처리 흐름 설명)
- 상세: 클래스 JSDoc 에 dispatch 경로가 "단일 dispatch table" 로 설명돼 있으나, `retry_last_turn` 만 `ExecutionEngineService` 가 아닌 `RetryTurnService` 를 직접 호출한다는 사실이 클래스 레벨 문서에 언급되지 않는다. 생성자 인라인 주석(C-1 후속 ④)에는 있으나 클래스 문서와 통합되어 있지 않아 클래스 개요만 읽는 경우 정보 단절이 생긴다.
- 제안: 클래스 JSDoc 또는 `process()` 메서드 선두 주석에 "단, `retry_last_turn` 은 순환 DI 해소를 위해 `RetryTurnService` 를 직접 호출한다" 한 줄을 추가한다.

### [INFO] `execution-engine.service.ts` — 삭제된 메서드 JSDoc 의 spec 참조 이전 확인 필요
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- 상세: 삭제된 `retryLastTurn` / `applyRetryLastTurn` thin delegator 의 JSDoc 에는 `spec/5-system/6-websocket-protocol.md §4.2`, `spec/5-system/4-execution-engine.md §1.3`, `spec/4-nodes/3-ai/1-ai-agent.md §7.9` 등 spec 참조가 상세히 기록되어 있었다. 이 참조들이 `RetryTurnService` 의 실제 구현 메서드 JSDoc 에 동등하게 포함돼 있는지 확인이 필요하다.
- 제안: `retry-turn.service.ts` 의 `retryLastTurn` / `applyRetryLastTurn` JSDoc 에 동일 spec 참조가 유지되고 있는지 확인하고, 누락 시 추가한다. (현 diff 범위에서 해당 메서드 본문 변경이 없으므로 기존 JSDoc 이 잔류하는 것으로 추정되나, 명시적 확인 권장.)

### [INFO] spec-drift 예고 — EngineDriver ISP 분해의 spec Rationale 미반영
- 위치: 관련 spec 파일(`spec/5-system/4-execution-engine.md`)
- 상세: consistency check(INFO-6)에서 "EngineDriver ISP 분할 구현 완료 후 `§Rationale` 갱신" 이 후속 planner 작업으로 분류되어 있다. 인터페이스 파일 JSDoc 은 최신 구조를 반영하고 있으나, spec 문서의 `§Rationale` 에는 ISP 분해 결정의 배경·근거가 아직 기록되지 않았다. 이는 구현 선행 상태로 차단 요인은 아니나, spec-impl 간 drift 이다.
- 제안: 본 PR 완료 후 planner 가 `spec/5-system/4-execution-engine.md §Rationale` 에 ISP 분해 결정 배경을 추가하도록 후속 plan 을 생성한다.

## 요약

C-1 후속 ④(EngineDriver ISP 분해 + engine→Retry 순환 DI 제거) 변경은 전반적으로 문서화 수준이 양호하다. 신규 인터페이스(`CoreEngineDriver`, `InteractionEngineDriver`, `ReentryStateDriver`, `AiTurnEngineDriver`, `RetryEngineDriver`)에 목적·소비자·범위를 명확히 설명하는 JSDoc 이 추가됐고, 구현 파일의 생성자 인라인 주석을 통해 설계 배경이 충분히 기록돼 있다. 주요 미흡 사항은 `FormInteractionService` 클래스 JSDoc 내 `EngineDriver` 타입명 참조가 `InteractionEngineDriver` 로 갱신되지 않은 점과, `ContinuationExecutionProcessor` 클래스 문서에 `retry_last_turn` 의 분기 경로가 언급되지 않은 점이다. 두 항목 모두 INFO 수준이며 동작과 컴파일에는 영향이 없다. spec Rationale 갱신은 consistency check 에서 이미 planner 후속으로 분류돼 있어 현재 변경의 차단 요인이 아니다.

## 위험도

NONE
