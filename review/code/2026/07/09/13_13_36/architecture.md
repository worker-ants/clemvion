# 아키텍처(Architecture) Review

## 발견사항

- **[WARNING]** 저장 시점 검증(`validateManualTrigger`)이 여전히 `NodeHandler.validate()` 다형적 진입점을 우회 — 부분 재구현으로 인한 divergence 위험 잔존
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` `validateManualTrigger()` (L579-611) vs `codebase/backend/src/nodes/trigger/manual-trigger/manual-trigger.handler.ts` `validate()` (L86-97)
  - 상세: `ManualTriggerHandler.validate()`는 `evaluateMetadataBlockingErrors(this.metadata, config)` + `validateTriggerParameterSchema(cfg.parameters)` 두 단계를 실행한다. 신규 `WorkflowsService.validateManualTrigger()`는 이 중 후자만 직접 import(`validateTriggerParameterSchema`)해 재호출하고 `evaluateMetadataBlockingErrors`는 호출하지 않는다. 확인 결과 `WorkflowsService`는 이미 `NodeComponentRegistry`를 `this.registry`로 주입받아 `applyConfigDefaults`/`graphWarningRules` 등 다른 검증에 재사용하고 있고, 그 내부의 `NodeHandlerRegistry.get(type): NodeHandler`를 통해 등록된 핸들러 인스턴스(정확히 이 `validate()`)에 이를 수 있는 배선이 이미 존재한다 — 즉 "레지스트리가 없어서" 우회한 게 아니라 편의상 로우레벨 유틸을 직접 부른 것이다. 현재 `manualTriggerMetadata`에 `blockingRule`이 없어(확인함) 두 경로의 결과가 우연히 동일하지만, 향후 blocking rule이 추가되면 저장 시점 게이트만 조용히 뒤처져 "저장은 통과, 실행은 실패"라는 이번에 고치려던 것과 같은 유형의 증상이 재발할 수 있다. (선행 리뷰 라운드에서 동일 사안이 WARNING으로 지적됐고, `details[]` 구조화된 에러 포맷을 보존하기 위해 `handler.validate()`의 flat string[] 대신 유틸 직접 호출을 택했다는 근거 있는 판단으로 수용됐다 — 그 판단 자체는 타당하나, `evaluateMetadataBlockingErrors` 누락이라는 좁은 완전성 갭은 그 판단과 무관하게 별도로 남아 있다.)
  - 제안: 급하지 않음(현재 동작 영향 없음). `handler.validate()`가 반환하는 flat string[]과 `validateTriggerParameterSchema`가 반환하는 구조화된 `TriggerParameterError[]`를 함께 얻고 싶다면, `ManualTriggerHandler.validate()`를 두 결과(구조화 스키마 에러 + blocking 에러)를 함께 반환하도록 확장하거나, `evaluateMetadataBlockingErrors` 결과도 `validateManualTrigger`에서 병행 호출해 두 경로의 완전성을 맞춘다.

- **[WARNING]** 파라미터 이름 식별자 정규식이 프론트/백엔드에 여전히 이중 정의(SoT 부재)
  - 위치: `codebase/frontend/src/components/editor/settings-panel/node-configs/trigger-configs.tsx:15` (`PARAM_NAME_RE`) vs `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts:77` — 두 곳 모두 `/^[A-Za-z_][A-Za-z0-9_]*$/` 리터럴을 독립적으로 하드코딩.
  - 상세: 실제 소스로 재확인해도 여전히 두 파일에 동일 정규식이 별도 리터럴로 존재한다. 이 모노레포는 `@workflow/graph-warning-rules` 같은 프론트/백엔드 공유 패키지로 정확히 이런 종류의 비즈니스 규칙 drift를 막는 선례를 갖고 있는데, 이번 규칙은 그 패턴을 따르지 않는다. 백엔드 규칙이 바뀌면(예: 유니코드 허용) 프론트가 조용히 뒤처져 "프론트 통과 → 저장 시 400" 회귀가 재발할 수 있다. (선행 리뷰에서 동일 지적 → RESOLUTION.md가 "저위험, 백로그"로 명시적으로 이연시킨 항목이며 이번 라운드에도 코드상 미해결로 남아 있음을 확인.)
  - 제안: 식별자 정규식을 `packages/`(또는 `packages/sdk`) 공유 모듈로 추출해 프론트/백엔드가 동일 소스를 import. 백로그 처리 방침 자체는 합리적이므로 이번 PR을 막을 사안은 아니다.

- **[INFO]** 엔진 재진입 3개 호출부의 "durable input" 파생 로직이 여전히 각자 리터럴로 중복
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L2086, L2419, L3203 — 세 곳 모두 `input: savedExecution.inputData ?? {}`.
  - 상세: 동일한 한 줄 표현식과 그 근거를 설명하는 주석이 세 호출부에 반복돼 있다. 이 파일 자체가 "`runNodeDispatchLoop`가 공통 helper(PR #365 WARNING #10 해소)"라는 주석대로 재진입 경로를 한 곳으로 모으는 방향성을 갖고 있는데, `input` 파생만은 그 공통화 경계 밖에서 각 호출부가 재계산한다. `retry-turn.service.ts`는 의도적으로 이 fallback을 쓰지 않는데(AI multi-turn retry는 진입 트리거를 재실행하지 않음, spec 문서화된 `$input` 미해소 동작) 이 비대칭은 주석으로 잘 근거가 남아 있어 문제는 아니다.
  - 제안: `resolveReentryInput(savedExecution)` 같은 private helper 하나로 추출해 `execution-engine.service.ts`의 3개 호출부가 동일 함수를 참조하게 하면, 이 durable-input 불변식이 바뀔 때 단일 지점만 수정하면 된다. `retry-turn.service.ts`는 계속 의도적으로 helper를 쓰지 않아도 됨(현재 주석이 그 이유를 명확히 설명). 사소하므로 이번 릴리스를 막을 사안은 아니다.

- **[INFO]** `saveCanvas`의 `skipParamSchemaValidation` boolean 플래그 파라미터 — flag-argument 패턴, 호출부 가독성 저하
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` `saveCanvas(id, workspaceId, userId, dto, skipParamSchemaValidation = false)` (L386-390), 호출부 `restoreVersion` → `this.saveCanvas(workflowId, workspaceId, userId, dto, true)` (L472)
  - 상세: `saveCanvas`는 컨트롤러(`workflows.controller.ts`)가 직접 호출하는 공개 서비스 메서드이자, `restoreVersion`이 내부적으로 재사용하는 공유 경로이기도 하다. 이번 변경으로 이 메서드가 "사용자 명시 저장(검증 on)"과 "버전 복원(검증 off)"이라는 두 가지 모드를 하나의 trailing boolean으로 분기하게 됐다. `restoreVersion`의 호출부(`..., true)`)만 봐서는 그 인자가 무엇을 의미하는지 시그니처를 보지 않고는 알기 어렵다(classic boolean trap). 기능적으로는 문제없고, 이미 파라미터명이 서술적이라(named default) 심각한 문제는 아니다.
  - 제안: 급하지 않음. 필요하면 `{ skipParamSchemaValidation }` 형태의 options object로 바꾸거나, `saveCanvas`/`restoreVersion`이 공유하는 내부 `persistCanvas(dto, { validateParams })` 같은 private 메서드로 분리해 두 공개 진입점의 의미를 분리하는 것도 고려 가능.

- **[INFO]** 되돌려진 프론트 즉시 커밋 시도(CRIT-1) 이후 재작업이 레이어 경계를 정확히 지킴 — 회귀 없음 확인
  - 위치: `codebase/frontend/src/components/editor/settings-panel/node-configs/trigger-configs.tsx`
  - 상세: 선행 라운드에서 "설정 즉시 store 커밋"이 `spec/3-workflow-editor/0-canvas.md` R-3(저장은 "Save changes" 클릭 시에만 반영)를 위반한다는 CRITICAL로 되돌려졌다. 이번 diff의 최종 형태는 순수 인라인 검증(에러 메시지 표시)만 추가하고 `onChange`/store 커밋 경로는 건드리지 않아, 프레젠테이션 레이어(입력 검증 피드백)와 상태 커밋 레이어(명시적 저장)의 책임 분리가 유지된다. 조치 불필요, 참고용.

- **[INFO]** 모듈 경계: `WorkflowsService → execution-engine/utils,types` 직접 import가 서비스 레이어까지 확장됨 (기존 패턴의 연장, 순환 의존 없음)
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` 신규 2개 import(`validateTriggerParameterSchema`, `toTriggerParameterErrorDetails`)
  - 상세: `workflows.controller.ts`가 이미 `execution-engine` 모듈에서 트리거 파라미터 관련 함수/타입을 직접 import하고 `workflows.module.ts`도 이미 `ExecutionEngineModule`을 import하므로 이번 변경이 새로운 결합 방향을 만든 것은 아니다(단방향 workflows → execution-engine, 역방향 참조 없음 확인). 다만 "트리거 파라미터 스키마 검증"이라는 노드-설계-시점 관심사가 `execution-engine/utils/` 아래 위치한다는 배치 자체가 두 모듈의 경계를 흐리게 하는 근본 원인이며, 첫 번째 WARNING(handler.validate 우회)과 결합해서 보면 이 위치 선정이 재사용을 오히려 어렵게 만들고 있다.
  - 제안: 즉시 조치 불필요. 장기적으로 트리거 파라미터 스키마 검증기를 `nodes/trigger/manual-trigger/` 아래로 옮기거나 `NodeHandler.validate()` 단일 진입점으로 수렴시키는 편이 모듈 경계상 더 자연스럽다.

## 요약

이번 diff의 핵심 버그 수정 3건(엔진 재진입 시 durable `Execution.inputData` 사용, 트리거 노드 조회를 `category`에서 `type` 기준으로 전환, 프론트 인라인 이름 검증)은 근본 원인 진단이 실측(e2e)에 근거해 설득력 있고 레이어 책임도 각자의 경계 안에 머문다 — 엔진 수정은 엔진의 기존 공통화 방향(`runNodeDispatchLoop`)과 일치하고, 프론트 수정은 이전 라운드에서 지적된 "즉시 store 커밋" 아키텍처 위반을 재도입하지 않았다. 방어적으로 추가된 hardening 계층(저장 시점 검증)에는 이전 라운드에서 이미 지적·검토된 두 항목 — `NodeHandler.validate()` 다형적 진입점을 우회하고 로우레벨 유틸을 워크플로 서비스에 직접 재구현한 점(향후 blocking rule 추가 시 divergence 위험), 식별자 정규식의 프론트/백엔드 이중 정의 — 이 코드 확인 결과 여전히 남아 있으나, 둘 다 RESOLUTION.md에서 근거를 갖고 백로그로 명시적으로 이연된 항목이며 현재 동작에 영향은 없다. 신규로 확인한 사소한 사항으로 `saveCanvas`의 boolean flag 인자(`skipParamSchemaValidation`)와 엔진 재진입 3개 호출부의 `input` 파생 로직 중복이 있으나 둘 다 INFO 수준이다. 모듈 순환 의존은 없다.

## 위험도
LOW
