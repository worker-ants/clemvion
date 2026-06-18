# Testing Review

## 발견사항

### [INFO] 변경 대상 파일 3종은 모두 타입/JSDoc 전용 변경 — 런타임 로직 없음
- 위치: engine-driver.interface.ts, execution-engine.service.ts (타입 삭제 섹션), types/graph-dispatch.types.ts, workflow-errors.ts
- 상세: 이번 변경의 핵심은 (1) `ExecutionGraphState` / `NodeDispatchLoopParams` 인터페이스를 `execution-engine.service.ts` 에서 `types/graph-dispatch.types.ts` leaf 모듈로 이동, (2) `engine-driver.interface.ts` 의 import 경로 교정, (3) `EngineDriver` 메서드 5종에 `@internal` JSDoc 추가, (4) `ExecutionCancelledError` 에 `@internal` JSDoc 추가. 런타임 동작 변경은 없으며 타입 재배치 + 문서화만 이루어졌다.
- 제안: 테스트 관점에서 별도 신규 테스트가 필요한 변경은 없음. 기존 테스트로 커버 충분.

### [INFO] 타입 이동(graph-dispatch.types.ts)에 대한 직접 테스트 파일 부재 — 정상
- 위치: `/codebase/backend/src/modules/execution-engine/types/graph-dispatch.types.ts`
- 상세: `ExecutionGraphState` / `NodeDispatchLoopParams` 는 순수 TypeScript 인터페이스로, 컴파일 타임 구조만 정의한다. 런타임 값이 없으므로 독립 spec 파일이 없는 것은 적절하다. 이 타입들의 계약은 `execution-engine.service.spec.ts` (1만4천 줄+) 에서 실제 호출 경로(`loadAndBuildGraph`, `runNodeDispatchLoop`) 테스트를 통해 간접 검증된다.
- 제안: 현 상태 유지 적합.

### [INFO] `@internal` JSDoc 추가 메서드 5종은 기존 테스트에서 mock / 직접 호출 형태로 커버됨
- 위치: engine-driver.interface.ts lines 98, 110, 120, 131, 143
- 상세: `rehydrateContext`, `loadAndBuildGraph`, `runNodeDispatchLoop`, `findActivatedBackEdge`, `clearLlmDefaultConfigCache` 에 `@internal` 태그가 추가됐다. 이 5개 메서드는 `retry-turn.service.spec.ts` 에서 `mockDriver` 로 모킹되어 호출 여부 단언이 이루어지고 있으며(`lines 80-84, 319-555`), `execution-engine.service.spec.ts` 에서는 실제 서비스 인스턴스를 통한 통합 경로로 `rehydrateContext` 직접 호출 테스트(`lines 4169-4271, 9695-9844`) 가 존재한다. JSDoc 변경이 mock 시그니처나 테스트 단언에 영향을 주지 않는다.
- 제안: 현 상태 유지 적합.

### [INFO] `ExecutionCancelledError @internal` 추가 — workflow-errors.spec.ts 에 해당 클래스 테스트 없음
- 위치: `workflow-errors.ts` line 2197, `workflow-errors.spec.ts`
- 상세: `workflow-errors.spec.ts` 는 `InvalidExecutionStateError`, `RetryLastTurnError`, `MessageTooLongError`, `FormValidationError` 4종을 테스트하지만 `ExecutionCancelledError` 는 테스트하지 않는다. `ExecutionCancelledError` 는 파라미터 없는 단순 sentinel 클래스로, `retry-turn.service.spec.ts:line 456-459` 에서 인스턴스 생성 + 예외 전파 테스트가 이루어지므로 기본 계약은 커버된다. 다만 `name` 프로퍼티 고정값(`'ExecutionCancelledError'`) 과 message 고정값(`'Execution cancelled while waiting for input'`) 의 독립 단언이 없다.
- 제안: 위험도 낮음. `workflow-errors.spec.ts` 에 `ExecutionCancelledError` 블록을 추가하면 sentinel 계약(name, message, instanceof Error)을 명시적으로 문서화할 수 있으나 필수 사항은 아님.

### [INFO] import 경로 교정(`engine-driver.interface.ts` line 36) — 기존 컴파일/테스트가 회귀 검증 역할
- 위치: `engine-driver.interface.ts` diff hunk (line 36: `from './execution-engine.service'` → `from './types/graph-dispatch.types'`)
- 상세: 이 변경은 타입 레벨 순환 해소가 목적이다. 컴파일 성공 여부가 변경의 핵심 검증 수단이며, Jest 테스트는 `ts-jest` 컴파일을 거치므로 `execution-engine.service.spec.ts` + `retry-turn.service.spec.ts` + `form-interaction.service.spec.ts` + `ai-turn-orchestrator.service.spec.ts` + `button-interaction.service.spec.ts` 가 통과하면 교정이 유효함을 확인한다.
- 제안: CI 빌드(`tsc --noEmit`) 통과 확인으로 충분.

### [INFO] `NodeDispatchLoopParams.dispatchMeta` 의 `mode: 'manual'` 리터럴 타입 제약 — 테스트 미검증
- 위치: `types/graph-dispatch.types.ts` line 1789 (`dispatchMeta: { startedAt?: string; mode: 'manual' }`)
- 상세: `mode` 필드가 `'manual'` 리터럴 타입으로 제약된 사항이 인터페이스 정의에 있으나, 이 제약이 실제로 호출자를 컴파일 타임에 차단하는지 테스트 코드가 확인하지 않는다. 런타임 영향은 없으므로 타입 테스트(`expect(type).toSatisfy()` 형태) 또는 컴파일 에러 픽스처(`// @ts-expect-error`) 로 문서화할 수 있으나 현 규모에서는 과잉.
- 제안: 해당 필드를 소비하는 통합 경로 테스트가 `execution-engine.service.spec.ts` 에 이미 존재하므로 추가 불필요.

## 요약

이번 변경은 `ExecutionGraphState` / `NodeDispatchLoopParams` 두 인터페이스를 `execution-engine.service.ts` 에서 `types/graph-dispatch.types.ts` leaf 모듈로 추출해 타입 레벨 순환을 해소하고, `EngineDriver` 계약 메서드 5종과 `ExecutionCancelledError` 에 `@internal` JSDoc 어노테이션을 추가한 순수 리팩터링이다. 런타임 동작 변경이 없으므로 신규 테스트 필요성은 없다. 기존 테스트(`execution-engine.service.spec.ts`, `retry-turn.service.spec.ts`, 각 interaction service spec)가 변경된 코드 경로를 충분히 커버하며, `ExecutionCancelledError` 의 sentinel 계약 단독 테스트가 `workflow-errors.spec.ts` 에 없다는 점이 유일한 미비 사항이지만 위험도는 낮다.

## 위험도
NONE
