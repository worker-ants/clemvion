# 아키텍처(Architecture) Review

## 발견사항

- **[WARNING]** 저장 시점 파라미터 스키마 검증이 기존 `NodeHandler.validate()` 다형적 진입점을 우회하고, 동일 검증 로직을 서비스 레이어에 중복 하드코딩 — OCP/단일 진입점 원칙 위반
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` `validateManualTrigger()` (L579-600, `validateTriggerParameterSchema` 직접 import) vs `codebase/backend/src/nodes/trigger/manual-trigger/manual-trigger.handler.ts` `validate()` (L85-100)
  - 상세: 이 코드베이스는 노드 타입별 검증을 `NodeHandler.validate()` 인터페이스로 캡슐화하는 다형적 구조를 이미 갖고 있고, `NodeHandlerRegistry` 는 실제로 다른 모듈(`workflow-assistant-stream.service.ts`)에서 cross-module 로 주입돼 재사용된 선례가 있어 `WorkflowsService` 에서도 같은 패턴을 쓸 수 있었다. 그런데 신규 저장 시점 게이트는 이 진입점을 거치지 않고 `execution-engine/utils/resolve-trigger-parameters.ts` 의 `validateTriggerParameterSchema` 를 직접 재호출하며, `ManualTriggerHandler.validate()` 가 함께 수행하는 `evaluateMetadataBlockingErrors(this.metadata, config)` 검사는 완전히 누락한다. 현재는 `manualTriggerMetadata` 에 blocking rule 이 없어 두 경로의 결과가 우연히 같지만, 향후 이 노드 타입에 blocking rule 이 추가되면 저장 게이트만 조용히 뒤처져 "저장은 통과, 실행은 실패"가 재발할 수 있다 — 이번 버그 자체가 "검증 로직이 여러 곳에 흩어져 있어 한쪽만 갱신됨" 유형이었다는 점에서 같은 계열의 위험을 새로 심는 셈이다. `saveCanvas` 가 특정 노드 타입(`MANUAL_TRIGGER_TYPE`)을 하드코딩해 검증하는 구조라, 다른 노드 타입에 "저장 시점 구조 검증"을 확장하려면 매번 `WorkflowsService` 를 노드 타입별로 특수화해야 해 개방-폐쇄 원칙에도 어긋난다.
  - 제안: `saveCanvas` 가 `NodeHandlerRegistry.get(node.type).validate(node.config)` 를 노드 타입 무관하게 호출하도록 일반화하거나, 최소한 `ManualTriggerHandler.validate()` 결과를 그대로 재사용해 save/execute 두 경로가 항상 동일한 판정을 내리도록 단일화한다.

- **[WARNING]** 파라미터 이름 식별자 규칙이 프론트/백엔드 양쪽에 독립 하드코딩 — SoT 부재
  - 위치: `codebase/frontend/src/components/editor/settings-panel/node-configs/trigger-configs.tsx:14` (`PARAM_NAME_RE`) vs `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts` 동일 정규식(`/^[A-Za-z_][A-Za-z0-9_]*$/`)
  - 상세: 프론트 주석 자체가 "Mirror of the backend identifier rule" 이라고 명시해 중복을 인지하고 있으나, 실제 공유 메커니즘은 두지 않았다. 이 모노레포는 `@workflow/graph-warning-rules` 처럼 프론트/백엔드가 동일 규칙을 import 하는 선례를 이미 갖고 있어(`codebase/frontend/src/lib/stores/editor-store.ts` ↔ `codebase/backend/src/nodes/core/graph-warning-rule.ts`), 이번 규칙만 그 패턴을 따르지 않았다. 백엔드 규칙이 바뀌면(예: 유니코드 허용) 프론트가 조용히 뒤처져 "프론트는 통과, 저장 시 400" 같은 회귀가 재발할 수 있다.
  - 제안: 식별자 정규식을 `codebase/packages/` 하위 공유 패키지로 옮기고 양쪽이 동일 소스를 import.

- **[INFO]** `skipParamSchemaValidation` boolean 플래그가 `saveCanvas` → `validateManualTrigger` 2단계로 관통 — 제어 플래그 인자 패턴
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` `saveCanvas(..., skipParamSchemaValidation = false)` (L388-396) → `validateManualTrigger(dto, skipParamSchemaValidation)` (L567-571) → `restoreVersion` 이 `true` 로 호출 (L553-559)
  - 상세: `restoreVersion` 이 레거시 스냅샷 복원 시 신규 게이트를 우회해야 한다는 요구 자체는 합리적이나, boolean 플래그를 공개 API 성격의 `saveCanvas` 시그니처에 추가해 관통시키는 방식은 호출부가 늘어날수록(향후 다른 검증이 추가될 때) 시그니처가 계속 불어나는 전형적인 냄새다. 현재는 단일 플래그라 심각하지 않으나, 두 번째·세 번째 조건부 검증이 생기면 조합 폭발로 이어지기 쉽다.
  - 제안: 지금 당장 조치는 불필요. 향후 조건부 검증이 하나 더 늘어난다면 `{ skipParamSchemaValidation }` 같은 options 객체로 전환하거나, `restoreVersion` 전용 내부 저장 경로(별도 private 메서드)로 분리하는 편이 확장성 있다.

- **[INFO]** (긍정) 엔진 재진입 3개 호출부의 `input` 파생 로직이 `reentryWorkflowInput()` 헬퍼로 추출돼 중복이 해소됨
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L1417-1439 (`reentryWorkflowInput`), 3개 호출부(`driveResumeAwaited`/`driveResumeFrame`/`driveStuckRedrive`)가 모두 이 메서드 참조
  - 상세: "재진입 시 durable trigger input 을 재사용한다"는 불변식이 이제 한 곳(JSDoc 포함)에만 존재하고, 세 호출부는 짧은 참조 주석만 남긴다 — 이전 라운드에서 지적됐던 "동일 로직 3중 반복 설명" 문제를 해소한 정상적인 리팩터링. 다만 구조적으로 동일한 4번째 재진입 지점(`retry-turn.service.ts` `resumeGraphAfterRetry`)은 의도적으로 이 헬퍼를 쓰지 않고 `input: {}` 를 유지하며, 그 이유는 교차 참조 주석으로 명시돼 있다(`_retryState` 기반 재구동이라 진입 트리거 재실행 없음). 헬퍼가 `ExecutionEngineService` 의 private 메서드라 다른 서비스가 재사용할 수 없는 구조인데, 지금은 의도적으로 재사용하지 않는 케이스라 문제는 아니다.
  - 제안: 조치 불필요. 향후 `retry-turn.service.ts` 쪽에도 같은 종류의 파생이 필요해지면, 이 헬퍼를 순수 함수(예: `utils/reentry-workflow-input.ts`)로 승격해 두 서비스가 공유하는 편이 좋다.

- **[INFO]** 트리거 파라미터 스키마 검증 유틸의 모듈 배치가 실행 엔진과 워크플로 설계-시점 관심사의 경계를 흐림
  - 위치: `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts`, `.../trigger-parameter.types.ts` — `workflows.service.ts`(설계 시점) 와 `manual-trigger.handler.ts`(실행 시점) 양쪽에서 import
  - 상세: "Manual Trigger 파라미터 스키마 구조가 유효한가"는 노드 정의(`nodes/trigger/manual-trigger/`)에 속하는 개념인데 실제 코드는 `execution-engine/utils/` 아래 있다. `workflows` 모듈이 `execution-engine` 의 로우레벨 유틸을 직접 import 하는 것 자체는 기존에도 `workflows.controller.ts` 가 하던 선례라 이번 PR 이 새로 만든 결합은 아니고, `execution-engine` 쪽은 `Workflow`/`Node` TypeORM 엔티티만 참조하므로 순환 의존은 없다. 다만 위 첫 번째 WARNING(handler.validate 우회)과 맞물려 보면, 이 배치가 재사용을 오히려 어렵게 만드는 근본 원인 중 하나다.
  - 제안: 즉시 조치 불요. 장기적으로 트리거 파라미터 스키마 타입/검증기를 `nodes/trigger/manual-trigger/` 아래로 옮기거나 `NodeHandler.validate()` 단일 진입점으로 수렴시키면 모듈 경계가 더 명확해진다.

## 순환 의존성 / 레이어 확인

`WorkflowsService → execution-engine/utils,types` 방향의 단방향 결합만 확장됐으며(기존 컨트롤러 레벨 결합의 서비스 레벨 확장), `execution-engine` 모듈이 `workflows` 모듈을 import 하는 역방향 경로는 없어 순환 의존은 발견되지 않았다. 프레젠테이션(`trigger-configs.tsx`)/비즈니스(`workflows.service.ts`, `execution-engine.service.ts`)/데이터(TypeORM `Node`/`Execution` 엔티티) 레이어 책임 분리는 대체로 준수됐고, 신규 인라인 검증은 프론트에서 서버 응답을 기다리지 않는 UX 개선 계층으로 적절히 위치했다(다만 서버 검증을 대체하지 않는 이중 방어 구조 — 정상 패턴).

## 요약

이번 diff 의 핵심 버그 수정 3건(엔진 재진입 시 durable `Execution.inputData` 재사용, 트리거 노드를 `category` 대신 `type` 으로 조회, 저장 시점 파라미터 스키마 hard-fail 게이트 신설)은 근본 원인에 정확히 대응하는 국소적 수정이며, 특히 재진입 input 파생 로직을 `reentryWorkflowInput()` 헬퍼로 추출해 이전 라운드에서 지적된 3중 주석 중복을 해소한 점은 긍정적이다. 다만 저장 시점 검증 게이트가 이미 존재하는 `NodeHandler.validate()` 다형적 진입점(및 그것이 함께 수행하는 `evaluateMetadataBlockingErrors`)을 우회하고 execution-engine 의 로우레벨 함수를 워크플로 서비스에 직접 재구현한 것은 OCP 관점에서 지속적인 위험 요소로 남아 있다 — 지금은 결과가 우연히 동일하지만 두 경로가 구조적으로 분리돼 있어 향후 검증 규칙이 늘어나면 다시 갈라질 수 있다. 파라미터 이름 정규식이 프론트/백엔드에 이중 정의된 것도 이미 확립된 모노레포 공유 패키지 패턴을 따르지 않은 채 남아 있다. 순환 의존은 없고 레이어 책임 분리는 전반적으로 양호하다.

## 위험도

LOW
