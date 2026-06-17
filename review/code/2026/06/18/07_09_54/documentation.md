# Documentation Review — C-1 step4 RetryTurnService 추출

## 발견사항

### [INFO] `EngineDriver` 인터페이스 모듈 수준 독스트링이 step2 설명에 고정됨
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/execution-engine/engine-driver.interface.ts` 라인 147–159
- 상세: 인터페이스 JSDoc 첫 줄이 "C-1 step2 — `AiTurnOrchestrator` 가 추출되면서…" 로 시작한다. step4 까지 완료된 현재 RetryTurnService 도 본 인터페이스를 소비하지만 JSDoc 은 step2 맥락에만 머물러 있다. `ENGINE_DRIVER` DI 토큰의 JSDoc 역시 "orchestrator↔엔진 결합" 만 언급하고 retry 서비스는 누락됐다(라인 271–276).
- 제안: 인터페이스 JSDoc 첫 단락에 "step4 에서 `RetryTurnService` 가 graph loop / context rehydration / LLM cache 정리 표면을 추가로 소비한다" 를 한 문장 보완. `ENGINE_DRIVER` 토큰 JSDoc 에 "RetryTurnService" 를 소비자 목록에 추가. 기능적 영향은 없으나 인터페이스의 소비자 파악 진입점이 누락되어 오해 가능성이 있음.

### [INFO] `ExecutionEngineService` 의 thin delegator 메서드에 새 위치 참조 추가 권장
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `retryLastTurn` / `applyRetryLastTurn` delegator 영역 (diff 기준 `// C-1 step4 — 외부 진입점 thin delegator.` 주석)
- 상세: 두 delegator 의 인라인 주석에 "본문은 `retry-turn.service.ts` 참조" 가 이미 존재한다. 그러나 공개 메서드 시그니처 바로 앞의 **JSDoc 블록**(삭제된 기존 JSDoc)이 제거되어 IDE hover 시 반환 타입·파라미터 설명이 노출되지 않는다. 특히 `retryLastTurn` 의 원본 JSDoc 은 250줄 이상이었는데 완전히 제거됐고, 현재는 단발 인라인 주석만 남아 있다.
- 제안: delegator 메서드에 최소한 `@see RetryTurnService.retryLastTurn` / `@see RetryTurnService.applyRetryLastTurn` 형태의 축약 JSDoc 을 추가해 IDE 에서 참조 위치를 탐색 가능하게 한다. 동작 문서화는 `retry-turn.service.ts` 에 전이됐으므로 중복 없이 `@see` 하나로 충분.

### [INFO] `ExecutionGraphState` / `NodeDispatchLoopParams` export 사유 주석의 위치가 구현과 분리됨
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 라인 870–882 (diff 기준 `export interface ExecutionGraphState` / `export interface NodeDispatchLoopParams`)
- 상세: `// C-1 step4 — ... 참조하므로 export` 인라인 주석이 인터페이스 선언 바로 앞에 있어 가독성은 양호하다. 그러나 두 인터페이스 모두 기존 `interface` 앞의 JSDoc 블록은 온전히 유지되고 있으므로 JSDoc 내부에 `@remarks export 이유` 를 통합하면 IDE hover 에서도 이유가 노출된다. 현재는 JSDoc 에 없고 라인 주석에만 있어 hover 에서 보이지 않음.
- 제안: JSDoc `@remarks` 로 "RetryTurnService 가 EngineDriver 경유로 호출하므로 export 됨 (C-1 step4)" 를 한 줄 추가. 문서화 완결성 향상이며 기능 영향 없음.

### [INFO] `retry-turn.service.spec.ts` 에 `applyRetryLastTurn` / `resumeGraphAfterRetry` 테스트 범위 부재에 대한 명시적 설명이 부분적임
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts` 라인 1539–1557 (파일 상단 블록 주석)
- 상세: 파일 상단 블록 주석이 `applyRetryLastTurn` / `resumeGraphAfterRetry` 의 테스트가 엔진 spec 에 잔류하는 이유("driver/orchestrator 를 모두 mock 해야 해 테스트 의미가 소실됨")를 명확히 서술하고 있다. 이는 우수한 문서화다. 다만, 이 설명이 실제로 엔진 spec 내 어떤 `describe` 블록에서 해당 메서드를 검증하는지 파일명/describe 이름을 참조하지 않아 유지보수자가 바로 찾기 어렵다.
- 제안: 블록 주석에 "엔진 spec 의 `describe('applyRetryLastTurn (...)')` / `describe('resumeGraphAfterRetry (...)')` 블록에서 위임 경유로 검증됨 (execution-engine.service.spec.ts)" 형태의 교차 참조 한 줄을 추가.

### [INFO] `completeRetryExecution` / `failRetryExecution` 의 `@internal` 표기 누락
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/execution-engine/retry-turn.service.ts` 라인 414–446, 620–653
- 상세: `completeRetryExecution` 에는 JSDoc 내 `@internal` 태그와 호출 제한 설명이 있다(라인 428–431). 그러나 `failRetryExecution` 의 JSDoc 에는 `@internal` 이 없고, 접근 수준을 `private` 으로만 표시한다. TypeScript `private` 이 런타임 보호를 제공하지 않으며 테스트에서 `as unknown as` 우회가 가능하므로, `@internal` 추가로 문서화 일관성을 확보하는 것이 바람직하다.
- 제안: `failRetryExecution` JSDoc 에 `@internal — applyRetryLastTurn 의 catch 블록에서만 호출된다` 한 줄 추가.

## 요약

C-1 step4 변경은 문서화 관점에서 전반적으로 양호하다. 새로 추출된 `RetryTurnService` 는 클래스 수준 JSDoc 이 충실하고, 공개 메서드 3개(`retryLastTurn` / `applyRetryLastTurn`)와 `private` 핵심 helper 2개 모두 독스트링이 존재하며 spec 섹션 참조도 포함되어 있다. `EngineDriver` 인터페이스에 추가된 5개 멤버도 개별 JSDoc 을 보유한다. 테스트 파일의 상단 블록 주석이 테스트 범위 결정 사유를 투명하게 설명하는 점도 우수하다. 단, `EngineDriver` 인터페이스의 모듈 수준 JSDoc 이 step2 맥락에 고정되어 step4 소비자가 누락되고, thin delegator 로 전환된 두 엔진 메서드의 JSDoc 이 완전 제거되어 IDE hover 에서 참조 위치가 보이지 않는 점, 그리고 두 내부 helper 간 `@internal` 표기 일관성 부재가 INFO 수준으로 남아있다. README / CHANGELOG / API 문서 업데이트 필요성은 없다(내부 리팩터링, 외부 인터페이스 변경 없음).

## 위험도

LOW
