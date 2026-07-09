# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 공개 API 동작 변경 — `POST /workflows/:id/save` 가 이전엔 통과시키던 malformed manual trigger 파라미터를 이제 `400 INVALID_TRIGGER_PARAMETERS` 로 거부
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` `validateManualTrigger()` (L586-), `saveCanvas()` 호출부(L399)
  - 상세: `saveCanvas`/`validateManualTrigger` 에 `skipParamSchemaValidation = false` 기본 파라미터가 추가됐다. 컨트롤러(`workflows.controller.ts:453`)는 새 인자를 넘기지 않으므로 기존 시그니처 호출부는 영향 없지만(하위호환 유지), **런타임 동작 자체가 바뀐다**: 지금까지 malformed `config.parameters`(빈 이름 슬롯 등)를 조용히 저장할 수 있었던 기존 클라이언트/자동화가 이제 저장 시점에 400 을 받는다. 의도된 버그 수정(spec §6 "저장 시점 검증"을 실제 이행)이며 `restoreVersion`(과거 스냅샷 복원)은 `skipParamSchemaValidation=true` 로 명시적으로 예외 처리돼 있고, e2e/unit 회귀 테스트·CHANGELOG·후속 spec 문서화 plan(`spec-update-manual-trigger-save-time-error-code.md`)까지 갖춰져 있어 잘 관리된 변경이다. 다만 "기존에 성공하던 요청이 이제 실패할 수 있다"는 인터페이스 동작 변경이므로 기록해 둔다.
  - 제안: 별도 조치 불필요(이미 CHANGELOG·후속 spec plan 반영됨). 배포 시 malformed 데이터가 잔존하는 기존 워크플로우가 있다면 재저장 시 400 을 받을 수 있음을 운영 공지에 포함하는 것을 고려.

- **[INFO]** `reentryWorkflowInput` fallback 범위가 Manual Trigger 진입 노드보다 넓다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `reentryWorkflowInput()`(L1414-1130) 및 3개 호출부(`driveResumeAwaited` 경로 L2100, `driveResumeFrame` 경로 L2431, crash-redrive 경로 L3212); `gatherNodeInput()`(L5974-6031)
  - 상세: `gatherNodeInput` 은 `workflowInput` 폴백을 (1) incoming edge 가 없는 진입 노드뿐 아니라 (2) incoming edge 가 1개인데 그 predecessor 가 아직 미실행인 노드(예: back-edge 루프 타깃의 첫 iteration), (3) 다중 predecessor 가 모두 미실행인 merge 노드에도 적용한다. 이번 수정으로 이 세 경우 모두, 재진입 시 `input:{}` 대신 durable `Execution.inputData`(`{parameters, __triggerSource, ...}`)를 받게 된다. 코드 주석은 "back-edge 재진입 타깃"까지 명시적으로 언급하며 의도된 범위임을 밝히고 있으나, 신규 테스트(unit `reentryWorkflowInput` 3케이스, e2e 재진입 케이스 1건)는 모두 **Manual Trigger 진입 노드** 시나리오만 검증하고 back-edge/다중-미실행-predecessor 노드가 재진입 시 트리거 입력을 받는 케이스는 직접 커버하지 않는다. 데이터 자체는 원래 fresh-run 진입 노드용으로 이미 쓰이던 것이라 신규 노출은 아니지만, 재진입 경로에서 다른 노드 타입의 입력 해석 결과가 바뀌는 범위는 서술된 것보다 넓다.
  - 제안: 필수 조치는 아님(회귀 위험 낮음, 의도 문서화됨). 다만 back-edge 루프/다중 predecessor 노드가 재진입 경로를 타는 e2e 케이스가 존재한다면 후속 회귀 테스트로 보강 권장.

- **[INFO]** `loadTriggerParameterSchema` 조회 조건 변경(`category=TRIGGER` → `type='manual_trigger'`)이 4개 호출부에 공통 영향
  - 위치: `codebase/backend/src/modules/execution-engine/utils/load-trigger-parameter-schema.ts` L28-34; 호출부 `executions.service.ts:394`, `hooks.service.ts:170`, `schedule-runner.service.ts:56`, `workflows.controller.ts:295`
  - 상세: 함수 시그니처는 변경 없음(내부 쿼리만 교체). 현재 `NodeCategory.TRIGGER` 카테고리를 갖는 노드 타입은 `manual_trigger` 하나뿐(`node-types.constants.ts` 확인)이라 정상 데이터에서는 동작 동등, category 누락/불일치 데이터에서는 오히려 버그 수정이다. 4개 호출부 모두 동일한 개선을 일관되게 받는다는 점에서 부작용이라기보다 의도된 파급이나, 함수가 여러 모듈에서 공유되는 유틸이므로 향후 category=TRIGGER 인 non-manual 트리거 타입이 추가될 경우 이 조회가 그 타입을 놓치게 됨을 유의할 필요는 있다(현재는 해당 없음).
  - 제안: 조치 불필요. 향후 새 트리거 타입 추가 시 이 함수의 "type 기반 조회 = manual_trigger 전용" 전제가 깨지지 않는지 재확인.

- **[INFO]** `retry-turn.service.ts` 는 의도적으로 fix 대상에서 제외(동일 패턴의 4번째 호출부)
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` L564-581
  - 상세: `runNodeDispatchLoop` 재진입 호출 패턴이 동일하게 존재하지만 `input: {}` 를 그대로 유지한다. 교차 참조 주석으로 사유(완료된 중간 AI 노드만 `_retryState` 로 재구동, 진입 트리거 재실행 안 함, `$input` 미해소는 spec 문서화된 동작)가 명시돼 있고 RESOLUTION.md(W8)에서도 검토됐다. 일관성 있는 의도적 배제로 판단되며 부작용 아님.
  - 제안: 없음(정보성 확인).

- **[INFO]** 신규 e2e 스펙이 `_test/simulate-execution-run-redelivery` 백도어 엔드포인트를 사용
  - 위치: `codebase/backend/test/manual-trigger-default-param.e2e-spec.ts` (해당 부분은 diff 크기 제한으로 payload 에 포함되지 않아 git diff 로 직접 확인)
  - 상세: 이 엔드포인트는 이번 PR 이전부터 존재하는 test-only 백도어로, `NODE_ENV==='test' && E2E_TEST_HOOKS==='1'` 이중 게이트 + `@Roles('owner')` 인가로 프로덕션에 노출되지 않는다(`executions.controller.ts` 확인). 이번 변경은 기존 인프라를 재사용할 뿐 신규 프로덕션 노출을 만들지 않는다.
  - 제안: 없음(확인 목적).

- **[INFO]** 새 전역 상수/모듈 스코프 변수는 순수 상수·정규식으로 부작용 없음
  - 위치: `codebase/frontend/src/components/editor/settings-panel/node-configs/trigger-configs.tsx` L14 `PARAM_NAME_RE`
  - 상세: 모듈 스코프 정규식 상수 추가는 읽기 전용이며 상태·부작용 없음. 백엔드 식별자 규칙(`resolve-trigger-parameters.ts`)과 별도로 하드코딩되어 두 곳에서 독립 유지되는 점은 RESOLUTION.md(W4)에서 이미 후속 백로그로 확인됨(공유 패키지 추출) — 부작용이 아니라 유지보수성 이슈이므로 이 리뷰 관점에서는 정보성으로만 남긴다.
  - 제안: 없음.

- **[NONE]** 나머지 변경(테스트 파일, i18n 사전, mdx 문서, plan/*.md, review/*.md, CHANGELOG.md)은 순수 데이터/문서/테스트 추가로 런타임 부작용 없음. 새 전역 변수·환경 변수 읽기/쓰기·의도치 않은 네트워크 호출·이벤트/콜백 변경은 발견되지 않음. 파일시스템 쓰기(`plan/in-progress/*.md`, `review/code/2026/07/09/11_08_21/RESOLUTION.md`)는 프로젝트 워크플로 규약상 예상된 산출물이며 코드 실행 중 부작용이 아니다.

## 요약

이번 변경은 Manual Trigger `defaultValue` 미적용 버그를 세 지점(엔진 재진입 durable input, 트리거 조회 조건, 저장 시점 검증)에서 방어적으로 고친 버그 수정이다. 함수 시그니처 변경(`saveCanvas`/`validateManualTrigger` 에 옵션 파라미터 추가, `reentryWorkflowInput` 신설)은 모두 기본값으로 하위호환을 유지하며 내부 단일 호출부만 존재해 외부 파급이 없다. 다만 (1) `POST /:id/save` 가 이제 이전에 통과하던 malformed 파라미터를 400 으로 거부하는 의도된 동작 변경이 있고(문서화·테스트·후속 spec plan 완비), (2) 재진입 시 durable input 을 넘기는 `reentryWorkflowInput` 의 실제 영향 범위가 `gatherNodeInput` 의 폴백 규칙상 Manual Trigger 진입 노드뿐 아니라 back-edge/다중-미실행-predecessor 노드까지 미치는데 이 부분에 대한 직접 테스트 커버리지는 진입 노드 케이스에 한정되어 있다. 두 항목 모두 의도가 코드 주석·plan·RESOLUTION.md 에 잘 남아 있고 위험도가 낮아 차단 사유는 아니다. 전역 상태·환경 변수·네트워크 호출·파일시스템 관련 의도치 않은 부작용은 발견되지 않았다.

## 위험도

LOW
