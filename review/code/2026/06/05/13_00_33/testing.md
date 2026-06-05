# Testing Review — PR-A3 user-defined variables durable park + rehydration

## 발견사항

### [INFO] 테스트 존재 여부 — 단위 테스트 충분히 추가됨
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` L9101~L9203
- 상세: `rehydrateContext` (user variables 복원), `NULL user_variables` 회귀 가드, `stageDurableResumeSnapshot` (thread + 사용자 변수 영속), `rehydrateUserVariables` normalizer 4개 단위 테스트가 추가됐다. 829개 모듈 테스트 green 확인됨.

### [WARNING] 커버리지 갭 — 실 park 경로(updateExecutionStatus 트랜잭션)에서 userVariables 가 DB save 되는지 assert 없음
- 위치: `execution-engine.service.spec.ts` — 기존 park 통합 테스트(L3049, L3582, L3761 등)
- 상세: `stageDurableResumeSnapshot` 가 `execution.userVariables` 를 설정하고 곧이어 `updateExecutionStatus` 가 `manager.save(Execution, execution)` 를 호출한다(`execution-engine.service.ts` L8663). 그러나 기존 park 통합 테스트 중 `mockExecutionRepo.save` 또는 `mockDataSource.transaction` 에서 `userVariables` 필드가 실제로 포함됐는지 assert 하는 케이스가 없다. `stageDurableResumeSnapshot` 단위 테스트는 private 메서드를 직접 호출하므로 "실제 park 흐름(form/button/AI) → DB 트랜잭션" 통합 경로를 커버하지 못한다.
- 제안: form park 통합 테스트(`§4.x — runExecutionFromQueue` 등) 중 한 곳에 `mockExecutionRepo.save` 또는 `manager.save` 호출 시 `userVariables` 필드가 포함됐는지 검증하는 assertion 추가. 예시: `expect(saveCalls).toEqual(expect.arrayContaining([expect.objectContaining({ userVariables: expect.any(Object) })]))`.

### [WARNING] 커버리지 갭 — rehydration 통합 시나리오에서 userVariables 복원 end-to-end 커버 없음
- 위치: `execution-engine.service.spec.ts` L3275 "Phase 2.7 — rehydration" 통합 테스트
- 상세: Phase 2.7 통합 테스트는 `rehydrateContext` 가 DB 에서 컨텍스트를 재구성하는 full end-to-end path 를 커버한다. 그러나 이 테스트의 mock Execution 객체에 `userVariables` 가 설정되어 있지 않고(`L3315` `mockExecutionRepo.findOneBy` 응답에 `userVariables` 미포함), park 이전 변수가 resume 후 노드에 올바르게 전달되는지 검증하지 않는다. 변수 복원은 핵심 data-flow 이므로 단위 테스트 외 통합 경로에서도 확인이 필요하다.
- 제안: Phase 2.7 통합 테스트에서 mock Execution 에 `userVariables: { counter: 5 }` 를 설정하고 resume 후 downstream 노드 핸들러가 `context.variables.counter === 5` 를 받았는지 검증하는 variant 추가. 또는 별도 통합 테스트 케이스 작성.

### [WARNING] 엣지 케이스 — 배열 값이 context.variables 에 있는 경우 stageDurableResumeSnapshot 테스트 미포함
- 위치: `execution-engine.service.spec.ts` L9149 `stageDurableResumeSnapshot` 테스트
- 상세: 현재 테스트는 `counter: 3`, `payload: { a: 1 }` (object value) 케이스를 커버한다. `context.variables` 에 배열 값(`tags: ['a', 'b']`)이나 `null` 값(`active: null`)이 있는 경우, `Object.entries` 기반 shallow copy 가 올바르게 동작하는지 테스트하지 않는다. `rehydrateUserVariables` 는 비객체 필터링은 하되 내부 중첩 객체는 shallow copy 하므로 mutability 버그 가능성이 있다.
- 제안: `stageDurableResumeSnapshot` 또는 `rehydrateUserVariables` 테스트에 `{ tags: ['a', 'b'], score: null }` 케이스 추가 + 값이 원본 배열과 레퍼런스 독립인지(혹은 의도적 shallow임을 문서화) 확인.

### [INFO] 엣지 케이스 — 빈 variables 객체({}) 경우 stageDurableResumeSnapshot 동작 테스트 없음
- 위치: `execution-engine.service.spec.ts` L9149
- 상세: 실행 중 변수를 전혀 설정하지 않은 경우(`context.variables = { __workspaceId: 'ws-1', __dryRun: false }`, 시스템 키만 존재) `stageDurableResumeSnapshot` 후 `execution.userVariables` 가 빈 객체 `{}` 여야 한다. 이 케이스가 명시적으로 테스트되지 않는다.
- 제안: `stageDurableResumeSnapshot` 테스트에 시스템 변수만 있는 케이스 추가 및 `userVariables === {}` 검증.

### [INFO] Mock 적절성 — `ctxSubject()` 패턴으로 private API 접근, 메서드 시그니처 타입 별칭 일원화
- 위치: `execution-engine.service.spec.ts` L8993~L9008 `RehydrateCtxSubject` 타입 별칭
- 상세: private 메서드(`rehydrateContext`, `stageDurableResumeSnapshot`, `rehydrateUserVariables`)를 `as unknown as RehydrateCtxSubject` 캐스팅으로 접근하는 기존 패턴을 유지했다. 메서드 시그니처 변경 시 타입 에러로 감지 가능하다. A1 패턴 재사용으로 일관성 있음. 다만 `rehydrateContext` 반환 타입에 `variables: Record<string, unknown>` 필드가 추가됐는데, 기존 테스트들이 이 인터페이스 변경을 올바르게 반영하고 있다.

### [INFO] 테스트 격리 — 각 테스트가 고유한 execution id 사용
- 위치: `execution-engine.service.spec.ts` L9103, L9126
- 상세: `exec-rehydrate-vars`, `exec-rehydrate-vars-null` 등 고유한 execution ID 를 사용하고 `deleteContext` 로 in-memory 컨텍스트를 명시적으로 제거한다. beforeEach 에서 mock 워크플로 응답 설정. 테스트 간 독립성 확보됨.

### [INFO] 테스트 가독성 — 한국어 주석과 의도 명확
- 위치: `execution-engine.service.spec.ts` L9100~L9203
- 상세: 테스트명이 "restores user-defined variables", "NULL user_variables → 사용자 변수 없이 시스템 __* 만" 등으로 의도를 명확히 표현. 인라인 주석이 `// 사용자 변수 복원 + 시스템 __* 동시 존재 (충돌 없음)`, `// 시스템 — 제외돼야 함`, `// 사용자 — 영속돼야 함` 으로 각 assertion 의 의도를 명확히 설명. 우수함.

### [INFO] 회귀 테스트 — NULL 회귀 가드 명시적으로 포함됨
- 위치: `execution-engine.service.spec.ts` L9124 "NULL user_variables → 사용자 변수 없이 시스템 __* 만 (회귀 가드)"
- 상세: 배포 이전 row(userVariables=null) 에서 시스템 `__*` 만 존재하고 사용자 키가 없음을 검증. 기존 conversationThread NULL 회귀 가드(L9076)와 대칭 구조. 회귀 가드 충분.

### [INFO] 테스트 용이성 — private 메서드가 의존성 주입 없이 순수 로직 테스트 가능
- 위치: `execution-engine.service.ts` L8607~L8632
- 상세: `stageDurableResumeSnapshot` 은 `cloneThread` + 순수 객체 필터링, `rehydrateUserVariables` 는 완전한 순수 함수. 외부 의존성 없이 `ctxSubject()` 로 직접 호출 테스트 가능. 의존성 주입 없이 테스트 용이한 구조.

### [INFO] 마이그레이션 테스트 — migration-guard 통과 확인됨
- 위치: `codebase/backend/migrations/V085__execution_user_variables.sql`
- 상세: commit 메시지에 `migration-guard OK` 명시. `ALTER TABLE execution ADD COLUMN user_variables JSONB NULL` 은 nullable 추가라 무중단 배포 안전. 별도 마이그레이션 단위 테스트 없으나 migration-guard 체크로 충분(패턴 일관).

---

## 요약

PR-A3 는 새로 추가된 4개 단위 테스트(`rehydrateContext` user variables 복원, NULL 회귀 가드, `stageDurableResumeSnapshot` __* 제외, `rehydrateUserVariables` normalizer)가 핵심 로직을 잘 커버하며, 테스트 격리·가독성·회귀 가드 모두 양호하다. 주요 갭은 두 가지다. (1) form/button/AI park 통합 경로에서 `execution.userVariables` 가 실제 DB save 인자에 포함되는지 assert 하는 테스트가 없어 "스냅샷이 올바르게 영속되는지"를 통합 레벨에서 검증하지 못한다. (2) Phase 2.7 rehydration 통합 시나리오에 `userVariables` 가 설정된 mock Execution 이 없어 변수가 resume 후 downstream 노드에 실제 전달되는 end-to-end 경로가 커버되지 않는다. 두 갭 모두 기능 정확성에 영향을 줄 수 있으므로 추가 테스트가 권장된다.

---

## 위험도

LOW

STATUS: OK
