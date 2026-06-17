# 정식 규약 준수 검토 결과

검토 모드: `--impl-done`, scope=`spec/5-system/4-execution-engine.md`, diff-base=`claude/engine-split-s3-formbutton`

대상 변경: `RetryTurnService` 추출 (C-1 step4) — `engine-driver.interface.ts`, `execution-engine.module.ts`, `execution-engine.service.ts`, `execution-engine.service.spec.ts`, `retry-turn.service.ts`(신규), `retry-turn.service.spec.ts`(신규)

---

## 발견사항

### **[INFO]** `ExecutionCancelledError` 위치 이동 — `@internal` 주석이 공개 export 와 상충

- target 위치: `execution-engine.service.ts` diff 상단, `ExecutionCancelledError` import 추가 (`workflow-errors.ts` 에서 import)
- 위반 규약: `spec/conventions/error-codes.md §1` (의미 기반 명명·클라이언트 계약 표면)
- 상세: `ExecutionCancelledError` 는 이전에 `execution-engine.service.ts` 안에 `private class` 로 정의돼 있었으나, 이번 diff 에서 `workflow-errors.ts` 로 이동했다 (해당 파일의 line 288). `retry-turn.service.ts` 와 `execution-engine.service.ts` 양쪽에서 import 해야 하므로 이동 자체는 타당한 refactoring이다. 다만 `workflow-errors.ts` 의 다른 exported class 들(`InvalidExecutionStateError`, `RetryLastTurnError` 등)은 `ExecutionError` 추상 베이스를 통해 `code` 필드를 가지고 에러 코드 규약을 준수하는 반면, `ExecutionCancelledError` 는 `Error` 를 직접 상속하며 `code` 필드가 없다. 이것 자체는 기존 동작과 동일해 이번 diff 에서 새로 도입된 위반은 아니다 — 하지만 `workflow-errors.ts` 로 편입되면서 다른 규약 준수 에러 클래스와 같은 파일에 노출됐으므로, 이 클래스가 내부 sentinel 용도라는 점을 주석으로 명확히 하는 것이 규약의 "클라이언트 계약" 명확성 원칙(`error-codes.md §1`)과 일치한다. 현재 코드에는 `@internal` 주석이 없다.
- 제안: `ExecutionCancelledError` 클래스 선언부에 `/** @internal — 엔진 내부 sentinel. 에러 코드(code) 없음; WS/API surface 에 발행되지 않음. */` 형태의 JSDoc 를 추가해 `workflow-errors.ts` 의 다른 public 에러 클래스와 구분을 명확히 한다. 또는 규약 갱신이 적절하다면 `error-codes.md §4` (내부 전용 분류 코드 레지스트리)에 `ExecutionCancelledError` 를 등재해 "내부 sentinel, 코드 없음" 을 공식 등록한다.

---

### **[INFO]** `EngineDriver` 인터페이스 신규 멤버 — `@internal` 주석이 인터페이스 계약과 충돌하는 표현

- target 위치: `engine-driver.interface.ts` diff, `rehydrateContext` / `loadAndBuildGraph` / `runNodeDispatchLoop` / `findActivatedBackEdge` / `clearLlmDefaultConfigCache` 신규 멤버 JSDoc
- 위반 규약: `spec/conventions/execution-context.md §1` (설계 원칙 — 책임 경계 명확화); `spec/conventions/swagger.md §1-4` (API 문서 데코레이터 패턴) — 직접 위반은 아니나 경계 설계 규약 관점
- 상세: 신규 메서드 5개의 implementation(`execution-engine.service.ts`)에 `@internal — EngineDriver 계약(ENGINE_DRIVER)을 통해서만 호출. 모듈 외부 직접 참조 금지.` 주석이 달려 있다. 그러나 `EngineDriver` 인터페이스 측에는 동일한 주석이 없다 — 인터페이스 선언을 보는 소비자는 이 멤버들이 내부용임을 알 수 없다. `EngineDriver` 인터페이스는 `ENGINE_DRIVER` 토큰을 통해 DI 되는 공개 계약 표면이지만, 이들 5개 멤버는 `RetryTurnService` 만 소비하는 협소한 용도로 추가됐다. 인터페이스에 이 맥락이 부재해 향후 다른 소비자가 `EngineDriver` 를 통해 이들을 호출할 때 의도치 않은 결합이 발생할 수 있다.
- 제안: `engine-driver.interface.ts` 의 5개 신규 멤버 JSDoc 에도 `@internal — RetryTurnService 경유 전용. 다른 소비자는 호출하지 않는다.` 를 추가한다 (implementation 쪽 주석과 대칭). 규약 갱신이 필요하다면 `spec/conventions/execution-context.md` 또는 `spec/5-system/4-execution-engine.md §1.3` 에 "EngineDriver 협소 캐파빌리티 패턴" 결정을 Rationale 로 기록한다.

---

### **[INFO]** `ExecutionGraphState` / `NodeDispatchLoopParams` 의 `export` 승격 — spec 공개 계약 미반영

- target 위치: `execution-engine.service.ts` diff, `interface ExecutionGraphState` → `export interface`, `interface NodeDispatchLoopParams` → `export interface`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §1` (spec 문서 frontmatter의 `code:` 경로가 변경을 반영해야 함)
- 상세: 두 인터페이스는 이번 diff 에서 `private` → `export` 로 승격됐다. `spec/5-system/4-execution-engine.md` frontmatter 의 `code:` 는 `codebase/backend/src/modules/execution-engine/**` 글로브로 이미 포함하고 있어 spec 자체의 coverage 위반은 없다. 다만 `export` 승격으로 `RetryTurnService` 의 constructor 타입 시그니처가 이들을 직접 참조하게 되면서, 이 두 타입이 사실상 모듈 간 계약 표면이 됐다. 이는 spec §1.3의 "엔진 잔류 capability 최소 노출" 설계의 범위를 조용히 넓힌다. spec 문서에 이 결정의 근거(Rationale)가 없다.
- 제안: 이번 PR 의 변경 규모에 비추어 CRITICAL/WARNING 은 아니나, `spec/5-system/4-execution-engine.md §1.3` 의 Rationale 섹션에 "`ExecutionGraphState` / `NodeDispatchLoopParams` 가 모듈 경계를 넘는 이유 — `RetryTurnService` 가 `EngineDriver` 경유 호출 시 타입 안전성을 위해 export 승격" 을 한 줄 추가하는 것을 권장한다.

---

## 요약

이번 C-1 step4 변경(`RetryTurnService` 추출)은 정식 규약 직접 위반 사항이 없다. 에러 코드(`RETRY_STATE_NOT_FOUND`, `NODE_NOT_RETRYABLE`, `RETRY_TOO_EARLY`, `INVALID_EXECUTION_STATE`)는 모두 `spec/conventions/error-codes.md §1` 의 `UPPER_SNAKE_CASE` 의미 기반 명명 원칙을 준수한다. `RetryTurnService` 파일명·클래스명은 NestJS 모듈 명명 패턴을 따른다. `spec/5-system/4-execution-engine.md` frontmatter의 `code:` 글로브는 신규 파일들을 포함한다. `node-output.md` Principle 0의 내부 필드 허용 예외(`_retryState`, `_resumeState`)도 정확히 준수됐다. 발견된 3건은 모두 INFO 등급으로, 주석 보강 및 Rationale 문서화 관련 제안이다 — 규약 자체를 위반하거나 다른 시스템의 invariant를 깨는 사항은 없다.

## 위험도

NONE
