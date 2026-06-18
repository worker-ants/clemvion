# Security Review

## 발견사항

### 파일 2: execution-engine.service.ts

- **[INFO]** `failFirstSegmentSetup` — 에러 메시지를 `Execution.error` 에 직접 저장
  - 위치: `execution-engine.service.ts` `failFirstSegmentSetup` 메서드 (~라인 848)
  - 상세: `const errMessage = error instanceof Error ? error.message : String(error)` 를 그대로 `row.error = { message: errMessage }` 로 DB 에 저장하고, `EXECUTION_FAILED` WebSocket 이벤트 payload 에도 `error: errMessage` 로 포함한다. 이 패턴은 신규 변경이 아닌 기존 코드이며, 이번 diff 에 포함되지 않지만 전체 컨텍스트 상 가시적이다. 핸들러 내부 예외 메시지가 stack trace, 파일 경로, 외부 서비스 URL 등 민감 정보를 담을 경우 WS 이벤트를 통해 클라이언트에 노출될 수 있다.
  - 제안: 기존 코드 유지(이번 변경 범위 외)이나, 향후 `errMessage` 를 sanitize 하거나 고정 fallback 문자열로 교체하고 원본은 서버 로그에만 기록하는 방어 레이어 도입을 권장한다. `ExecutionError` 계층의 `serverDetail` 분리 정책(`workflow-errors.ts` 에 이미 확립)을 `failFirstSegmentSetup` 에도 적용하면 일관성이 높아진다.

- **[INFO]** `rehydrateAndResume` — `RehydrationError` 에러 구조화 로깅 (이번 변경 범위 외 기존 코드)
  - 위치: `execution-engine.service.ts` `rehydrateAndResume` catch 블록 (~라인 1335)
  - 상세: `err.code`, `executionId`, `nodeExecutionId` 를 structured params 로 분리해 로그에 남기고, `err.message` 는 로그에 포함하지 않는 설계(코드 주석 W19 참조)는 이미 적절하게 구현되어 있다. 이번 diff 에서 변경되지 않은 기존 코드이며 보안 관점에서 올바른 패턴이다.

- **[INFO]** `assertSameWorkspace` — workspace isolation 미완성(기존 코드, 이번 diff 미포함)
  - 위치: `execution-engine.service.ts` `assertSameWorkspace` 메서드 (~라인 906)
  - 상세: `callerWorkspaceId` 가 없으면 경고 로그만 남기고 통과(`fail-open`)한다. 이번 변경과 무관한 기존 설계이며, 코드 주석에도 "점진적 도입" 의도가 명시되어 있다. 호출자가 workspaceId 를 누락한 채 sub-workflow 를 호출하는 경우 workspace 격리가 우회된다.
  - 제안: 이번 diff 범위 외이나, 모든 호출자가 `parentWorkspaceId` 를 전달하도록 정착된 후 fail-closed 로 전환하는 계획이 명시된 대로 후속 PR 에서 이행되어야 한다.

### 파일 4: workflow-errors.ts

- **[INFO]** `ExecutionCancelledError` `@internal` annotation 추가 — 보안 관점 중립
  - 위치: `workflow-errors.ts` 라인 284 부근
  - 상세: `@internal` JSDoc 추가는 코드 계약 문서화 변경이다. `ExecutionCancelledError` 자체는 메시지 `'Execution cancelled while waiting for input'` 고정 문자열만 포함해 민감 정보 누출 없음. 보안 관점의 실질 위험 없음.

### 파일 1: engine-driver.interface.ts

- **[INFO]** `@internal` annotation 4건 추가 + import path 변경 — 보안 관점 중립
  - 위치: `rehydrateContext`, `loadAndBuildGraph`, `runNodeDispatchLoop`, `findActivatedBackEdge`, `clearLlmDefaultConfigCache` 메서드 JSDoc
  - 상세: `@internal` 어노테이션은 TypeScript 컴파일러가 강제하지 않는 문서 힌트이다. 실제 접근 제어는 DI 토큰(`ENGINE_DRIVER`) 경계로 이루어지며, 이번 변경은 그 계약을 문서화하는 것이다. 보안 관점의 실질 위험 없음.
  - 제안: `@internal` 만으로는 런타임 접근을 차단하지 못한다. 모듈 외부 직접 참조를 기술적으로 방지하려면 NestJS 모듈 exports 에서 `EngineDriver` 를 노출하지 않고 DI 토큰만 노출하는 현재 설계가 실질적인 경계이므로, 현 구조가 적절히 유지되는지 주기적으로 확인하는 것이 좋다.

### 파일 3: types/graph-dispatch.types.ts

- **[INFO]** 신규 leaf 타입 파일 — 타입 전용, 보안 관점 중립
  - 위치: `codebase/backend/src/modules/execution-engine/types/graph-dispatch.types.ts` 전체
  - 상세: `import type` 만 사용하는 순수 타입 인터페이스 파일이다. 런타임 코드 없음. 인젝션 취약점, 시크릿 하드코딩, 인증/인가, 입력 검증 등 모든 보안 항목 해당 없음.

---

## 요약

이번 변경은 실행 엔진 내부 타입 인터페이스(`ExecutionGraphState`, `NodeDispatchLoopParams`)를 중립 leaf 모듈로 분리하고, `EngineDriver` 인터페이스 및 `ExecutionCancelledError` 에 `@internal` JSDoc 어노테이션을 추가하는 리팩터링이다. 신규 취약점을 도입하지 않는다. 다만 기존 코드(`failFirstSegmentSetup` 에러 메시지 WS 전파, `assertSameWorkspace` fail-open 설계)에 잠재적 정보 노출 및 권한 우회 가능성이 있으나, 이는 이번 diff 범위 외 사항이며 코드베이스에서 이미 인지하고 있는 점진적 개선 대상이다. 이번 변경 자체의 보안 위험도는 없다.

## 위험도

NONE
