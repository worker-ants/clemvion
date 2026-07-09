# 아키텍처(Architecture) Review

## 발견사항

- **[WARNING]** 저장 시점 검증이 `NodeHandler.validate()` 추상화를 우회하고 저수준 유틸을 직접 재구현 — OCP/DRY 위반
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` (신규 `validateManualTrigger` 블록, `import { validateTriggerParameterSchema } from '../execution-engine/utils/resolve-trigger-parameters'`)
  - 상세: 이 코드베이스는 이미 `NodeHandler` 인터페이스로 노드 타입별 검증을 다형적으로 캡슐화하고 있고, `ManualTriggerHandler.validate()`(`codebase/backend/src/nodes/trigger/manual-trigger/manual-trigger.handler.ts`)가 정확히 같은 `validateTriggerParameterSchema` 호출 + `evaluateMetadataBlockingErrors` 를 이미 수행한다. 엔진의 `executeNode` 는 실행 시점에 이 `handler.validate()` 를 모든 노드 타입에 공통으로 호출한다(plan 문서에도 "executeNode 가 모든 노드에 handler.validate() 호출" 로 명시). 그런데 신규 저장 시점 게이트는 이 다형적 진입점을 재사용하지 않고, `WorkflowsService` 가 execution-engine 의 로우레벨 함수(`validateTriggerParameterSchema`)를 직접 import 해 **manual_trigger 전용으로 하드코딩**했다 — `evaluateMetadataBlockingErrors` 검사는 누락됨. `NodeHandlerRegistry` 는 이미 다른 모듈(`workflow-assistant`)에서 cross-module 로 주입돼 쓰이고 있어 `WorkflowsService` 에서도 재사용이 가능했다. 현재는 `manualTriggerMetadata` 에 blockingRule 이 없어 두 경로의 결과가 우연히 같지만, 향후 스키마에 blocking rule 이 추가되면 저장 시점 게이트만 조용히 뒤처져 "저장은 통과, 실행은 실패"라는 정확히 이 버그가 고치려던 증상이 재발할 수 있다. 또한 이 설계는 매뉴얼 트리거 외 다른 노드 타입에 "저장 시점 구조 검증"을 확장할 때 `WorkflowsService.saveCanvas` 를 매번 노드 타입별로 특수화해야 해 개방-폐쇄 원칙을 어긴다.
  - 제안: `WorkflowsService.saveCanvas` 가 (트리거 한정이 아니라) `NodeHandlerRegistry.get(node.type).validate(node.config)` 를 제네릭하게 호출하도록 바꾸거나, 최소한 `ManualTriggerHandler.validate()` 를 그대로 재사용해 두 경로가 항상 동일한 검증 결과를 내도록 통일한다.

- **[WARNING]** 파라미터 이름 식별자 규칙이 프론트/백엔드에 이중 정의(SoT 부재)
  - 위치: `codebase/frontend/src/components/editor/settings-panel/node-configs/trigger-configs.tsx:PARAM_NAME_RE` vs `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts:77` (`/^[A-Za-z_][A-Za-z0-9_]*$/`)
  - 상세: 동일한 정규식 리터럴이 두 레이어에 독립적으로 하드코딩됐다. 프론트 코드 주석 자체가 "Mirror of the backend identifier rule" 이라고 명시해 저자도 중복을 인지하고 있다. 이 모노레포는 이미 `codebase/packages/graph-warning-rules`, `expression-engine` 등 프론트/백엔드가 공유하는 패키지로 바로 이런 종류의 비즈니스 규칙 드리프트를 막는 선례를 갖고 있다(`@workflow/graph-warning-rules` 는 `codebase/frontend/src/lib/stores/editor-store.ts` 와 `codebase/backend/src/nodes/core/graph-warning-rule.ts` 양쪽에서 참조). 이번 규칙은 그 패턴을 따르지 않고 각 레이어에 별도 리터럴로 박아 넣어, 향후 백엔드 규칙이 바뀌면(예: 유니코드 허용) 프론트가 조용히 뒤처져 "프론트에서는 통과했는데 저장 시 400" 같은 사용자 경험 저하가 재발할 수 있다.
  - 제안: 식별자 정규식을 `packages/` 하위 공유 패키지(또는 최소한 `packages/sdk`)로 옮기고 프론트/백엔드가 동일 소스를 import 하도록 정리.

- **[INFO]** 3개 재진입 dispatch 호출부에 동일 로직·동일 취지의 긴 주석이 중복
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (`driveResumeAwaited` 진입부 ~line 2077, `driveResumeFrame` ~line 2417, `driveStuckRedrive` ~line 3196) — 세 곳 모두 `input: savedExecution.inputData ?? {}` 로 변경
  - 상세: 동일한 한 줄 표현식(`savedExecution.inputData ?? {}`)과 그 근거를 설명하는 4~6줄짜리 주석이 세 호출부에 거의 그대로 반복된다. 로직 자체는 사소하지만, "durable input 을 어떻게 파생시키는가"라는 불변식이 3곳에 흩어져 있어 향후 이 파생 규칙이 바뀌면(예: `parameterValues` 오버라이드 병합이 필요해지는 경우) 세 곳을 모두 일관되게 고쳐야 한다. 이미 이 파일은 "`runNodeDispatchLoop` 가 공통 helper(PR #365 WARNING #10 해소)" 라는 주석대로 재진입 경로를 한 곳으로 모으려는 방향성을 갖고 있었는데, `input` 파생만은 그 공통화 경계 밖에서 각 호출부가 재계산한다.
  - 제안: `runNodeDispatchLoop` 호출자 공통 helper(예: `resolveReentryInput(savedExecution)`) 하나로 추출해 세 호출부가 동일 함수를 참조하게 하면 향후 변경 시 단일 지점만 수정하면 된다. (사소하므로 이번 릴리스를 막을 정도는 아님.)

- **[WARNING]** 프론트 `updateNodeConfig` 즉시 커밋 경로가 Undo(Command) 계약을 깨뜨림 — 동일 컴포넌트 내 상태 커밋 의미론 불일치
  - 위치: `codebase/frontend/src/components/editor/settings-panel/node-settings-panel.tsx` `handleConfigChange` (신규 `updateNodeConfig(nodeId, newConfig)` 호출)
  - 상세: 스토어의 `updateNodeConfig` 액션(`codebase/frontend/src/lib/stores/editor-store.ts:945`)은 `pushUndo()` 를 호출하지 않는다. 이 스토어의 기존 호출 관례는 "직접 커밋하는 액션을 쓰려면 호출자가 먼저 `pushUndo()` 를 명시적으로 호출한다"이며, 실제로 유일한 기존 호출부인 `workflow-canvas.tsx` 의 `disable` 케이스는 `pushUndo(); updateNodeConfig(...)` 순서를 지킨다. 이번 변경은 이 관례를 어기고 `pushUndo()` 없이 키 입력마다(디바운스도 없이) `updateNodeConfig` 를 호출해, Manual Trigger 파라미터 이름/기본값 편집이 Ctrl+Z 로 되돌릴 수 없는 상태가 됐다. 동시에 같은 `SettingsTab` 컴포넌트 안에서 라벨/노트/에러 정책은 여전히 로컬 state 로 버퍼링됐다가 "Save changes" 클릭 시 `pushUndo()` 후 한 번에 커밋되는 구조를 유지한다 — 하나의 설정 패널 안에 "필드군 A는 로컬 버퍼+명시적 저장+undo 가능", "필드군 B(노드별 config)는 즉시 커밋+undo 불가"라는 두 가지 다른 커밋 의미론이 공존하게 됐다. 버그 자체(설정이 저장 없이 유실되는 문제)를 고치는 방향은 타당하나, 이 구현은 상태 관리 계층의 기존 계약(직접 커밋 액션은 pushUndo 선행)을 지키지 않았다.
  - 제안: `handleConfigChange` 에서도 `updateNodeConfig` 호출 전 `pushUndo()` 를 호출하거나(다만 키 입력마다 undo 스택이 쌓이는 문제가 생기므로 debounce 필요), 혹은 `updateNodeConfigField` 류처럼 undo-aware 액션을 신설해 두 필드군의 커밋 의미론을 통일한다.

- **[INFO]** `WorkflowsService → execution-engine/utils,types` 직접 import 확장은 기존 선례(`workflows.controller.ts`)를 따른 것으로, 이번 PR이 새로 만든 결합은 아님
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` (신규 2개 import)
  - 상세: `workflows.controller.ts` 가 이미 `resolveTriggerParameters`/`loadTriggerParameterSchema`/trigger-parameter 타입을 `execution-engine` 모듈에서 직접 import 하고 있고, `workflows.module.ts` 도 이미 `ExecutionEngineModule` 을 import 한다. 이번 변경은 그 기존 단방향 결합(workflows → execution-engine)을 서비스 레이어로 한 단계 더 확장한 것이며, 순환 의존은 발견되지 않았다(execution-engine 쪽은 `Workflow` TypeORM 엔티티만 참조, `WorkflowsModule` 자체는 import하지 않음). 다만 "트리거 파라미터 스키마 검증"이라는 노드-설계-시점 관심사가 실행 엔진 모듈의 `utils/` 아래 있다는 배치 자체가 두 모듈의 경계를 흐리게 하는 근본 원인이며, 위 첫 번째 WARNING(handler.validate 우회)과 함께 보면 이 위치 선정이 재사용을 오히려 어렵게 만들고 있다.
  - 제안: 즉시 조치는 불요. 다만 장기적으로 트리거 파라미터 스키마 관련 타입/검증기를 `nodes/trigger/manual-trigger/` 아래(노드 정의와 함께) 두거나 `NodeHandler.validate()` 단일 진입점으로 수렴시키는 편이 모듈 경계상 더 자연스럽다.

## 요약

이번 diff의 핵심 수정 3건(엔진 재진입 시 durable input 사용, 트리거 노드를 category 대신 type 으로 조회, 프론트 config 즉시 커밋)은 각각 독립적으로 타당한 버그 수정이며 근본 원인 진단도 설득력 있다. 다만 방어적으로 추가된 hardening 계층(저장 시점 검증, 프론트 인라인 검증)에서 아키텍처적 아쉬움이 보인다: (1) 저장 시점 검증이 이미 존재하는 `NodeHandler.validate()` 다형적 진입점을 재사용하지 않고 실행 엔진의 로우레벨 함수를 워크플로 서비스에 직접 하드코딩해 향후 검증 규칙 확장 시 두 경로가 갈라질 위험을 남겼고, (2) 식별자 정규식이 이미 확립된 프론트/백엔드 공유 패키지 패턴(`graph-warning-rules`)을 따르지 않고 양쪽에 중복 정의됐으며, (3) 프론트의 "즉시 커밋" 변경이 스토어의 undo 호출 관례를 깨 같은 패널 내에서 커밋 의미론이 두 갈래로 나뉘었다. 엔진 재진입 3개 호출부의 주석/로직 중복은 경미하다. 모듈 순환 의존은 없다.

## 위험도
MEDIUM
