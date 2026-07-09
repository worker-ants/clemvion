# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** 3개 재진입 dispatch 지점의 `input: savedExecution.inputData ?? {}` 수정이 노리는 정확한 회귀 시나리오(재진입 시점에 Manual Trigger 가 아직 미완료)를 결정적으로 재현하는 테스트가 diff 안에 없음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2086`(`driveResumeAwaited`), `:2419`(`driveResumeFrame`), `:3203`(`driveStuckRedrive`) / 회귀 근거로 인용되는 `codebase/backend/test/execution-crash-redrive.e2e-spec.ts`, `codebase/backend/test/execution-stalled-redelivery.e2e-spec.ts`, `codebase/backend/test/manual-trigger-default-param.e2e-spec.ts`
  - 상세: `execution-stalled-redelivery.e2e-spec.ts` 헤더 주석이 스스로 명시하듯("정상 실행으로 완료 prefix(trigger·codeA)를 만든 뒤 frontier(codeB)를 삭제하고 ... 되감아") 이 suite 는 **트리거가 이미 완료된 뒤** frontier 재구동을 시뮬레이션한다 — 즉 Manual Trigger 는 `executedNodes`에 있어 `skipExecutedNodes` 가드로 skip 되고, 3곳 중 어느 곳도 이번 diff 가 바꾼 `input` 값을 실제로 소비하지 않는다(`execution-crash-redrive`/`execution-park-resume` 도 `grep`으로 `output.parameters`/`inputData` 관련 값 단언이 전혀 없음을 확인). 신규 `manual-trigger-default-param.e2e-spec.ts` 는 크래시·stall 을 유발하는 `_test/simulate-execution-run-redelivery` 류의 결정적 훅을 쓰지 않고 평범한 `execute → poll → completed` 흐름만 수행한다 — 파일 헤더 주석은 "단일 노드는 e2e 인프라의 stalled-redelivery 를 유발하므로 2노드 그래프를 쓴다"고 적어 두 노드 그래프가 stall 을 **피하는** 쪽으로 설계됐음을 시사한다. 따라서 이 신규 테스트가 실제로 `driveResumeAwaited`/`driveResumeFrame`/`driveStuckRedrive` 중 하나를 거치는지는 BullMQ 재시도/heartbeat 타이밍이라는 비결정적 요인에 달려 있다. plan/RESOLUTION 문서는 "crash-redrive·stalled·park e2e 246/246 무회귀"를 근거로 낮은 리스크를 주장하지만, 그 suite 들이 정확히 이 fix 가 고치는 시나리오(재진입 시 트리거가 아직 미완료)를 구조적으로 발생시키지 않는다는 점은 검토되지 않았다. 즉 세 호출부 중 실제로 "재진입 + 트리거 미완료" 조합을 결정적으로 검증하는 회귀 테스트는 현재 하나도 없다.
  - 제안: `execution-stalled-redelivery.e2e-spec.ts` 류 패턴을 본떠 "트리거(Manual Trigger, default 있는 파라미터) → 아직 완료 전에 stalled/crash 재구동" 을 `_test/simulate-*` 훅으로 결정적으로 유발하고, 재구동 후 `output.parameters`/다운스트림 값이 정상 해석되는지 단언하는 테스트를 추가해 이 fix 를 고정.

- **[WARNING]** `driveResumeFrame`(execution-engine.service.ts:2417-2418) 주석의 상호 참조가 실제와 반대 — 인용된 `resumeGraphAfterRetry` 는 이 fix 를 **적용받지 않는** 유일한 4번째 재진입 지점
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2417-2419` vs `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:564-570`(`resumeGraphAfterRetry` 가 실제로 위치한 함수)
  - 상세: `driveResumeFrame` 의 신규 주석은 "Durable trigger input on re-entry (see runNodeDispatchLoop caller in resumeGraphAfterRetry) — keeps Manual Trigger output.parameters intact." 라고 적어, 마치 `resumeGraphAfterRetry` 도 동일하게 `savedExecution.inputData` 를 사용해 output.parameters 를 보존하는 것처럼 읽힌다. 그러나 `resumeGraphAfterRetry`(retry-turn.service.ts:484 이하)의 `runNodeDispatchLoop` 호출은 바로 이번 diff 에서 **의도적으로 `input: {}` 를 유지**한다(같은 파일의 새 주석: "다른 재진입 경로... 와 달리 `savedExecution.inputData` 를 쓰지 않는다"). 즉 주석이 인용하는 대상이 정확히 "이 fix 가 적용되지 않은 예외 지점"이라서, 향후 유지보수자가 이 주석만 보고 "4개 재진입 지점이 전부 동일하게 durable input 을 쓴다"고 오해해 `resumeGraphAfterRetry` 를 "일관성 있게" 고치려다 §retry 의 의도된 `$input` 미해소 동작을 깨뜨릴 위험이 있다.
  - 제안: `driveResumeFrame` 의 참조 대상을 `resumeGraphAfterRetry` 가 아니라 `driveResumeAwaited`(execution-engine.service.ts:2070, 같은 fix 를 최초로 상세히 설명하는 지점)로 정정.

- **[INFO]** (전회차 리뷰(11_08_21/side_effect.md) INFO 항목 — 여전히 미수정 상태로 남아 있음을 재확인) `input` 변경의 실제 영향 범위가 코드 주석보다 넓음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2070-2076,2417-2419,3199-3203` vs `gatherNodeInput`(:5960-6017)
  - 상세: 세 지점 모두 "미완료 진입 노드(Manual Trigger)에만 영향"이라고 서술하지만, `gatherNodeInput` 확인 결과 `workflowInput` 폴백은 (a) incoming edge 가 없는 진짜 entry 노드뿐 아니라 (b) incoming edge 가 1개인데 predecessor 가 아직 실행되지 않은 노드(back-edge 타깃의 첫 통과 등)에도 쓰이며, Manual Trigger 한정이 아니라 no-incoming 인 모든 트리거 타입(webhook/schedule/chat 등)에 동일 적용된다. `runExecution`(정상 경로)이 이미 동일 폴백을 쓰고 있어 새로운 미검증 동작이라기보다 정상 경로와의 일관성 회복에 가깝지만, 세 지점의 주석은 여전히 "Manual Trigger"/"진입 노드"로 범위를 축소해 서술한다 — 3개 커밋(fix 커밋 + ai-review fix 커밋 + 이번 커밋)을 거치는 동안 이 부정확성이 정정되지 않았다.
  - 제안: 필수는 아니나, 세 주석을 "predecessor 가 아직 실행되지 않은 모든 노드(entry 노드 및 back-edge 재진입 포함)"로 통일 정정 권장.

- **[INFO]** 저장 시점 `INVALID_TRIGGER_PARAMETERS` 게이트의 인터페이스 영향은 의도된 것으로 확인 — `restoreVersion` 예외 처리로 스코프 제한됨
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:386-399`(`saveCanvas` 신규 `skipParamSchemaValidation` 파라미터), `:472`(`restoreVersion` → `saveCanvas(..., true)`)
  - 상세: `saveCanvas` 시그니처에 5번째 선택적 파라미터(`skipParamSchemaValidation = false`)가 추가됐다. 기존 유일한 외부 호출부(`workflows.controller.ts:453`)는 인자 4개만 넘겨 기본값(`false`, 검증 ON)을 그대로 받으므로 하위 호환. `restoreVersion` 은 명시적으로 `true` 를 넘겨 과거 스냅샷 복원을 저장 게이트에서 예외 처리한다 — 이는 전회차 리뷰(api_contract.md WARNING, side_effect.md INFO)가 지적한 "기존 malformed 데이터 저장/복원 회귀" 를 restoreVersion 경로에 한해 해소한 것으로, RESOLUTION.md(W6)에도 명시돼 있다. 다만 malformed 트리거 파라미터가 이미 저장된 워크플로우를 (복원이 아니라) **트리거와 무관한 다른 노드만 고쳐서 `/save`** 하려는 케이스는 여전히 신규 400 을 받는다 — 이는 plan 문서에 "신규 `/save` 차단은 의도"로 명시된 accepted 동작이라 새로운 미검토 부작용은 아니다.
  - 제안: 조치 불요 — 확인 목적의 기록.

- **[INFO]** `loadTriggerParameterSchema` 조회 기준 변경(`category:TRIGGER` → `type:'manual_trigger'`)은 공유 유틸리티라 5개 호출부에 일괄 적용됨 — 확인 결과 전부 의도된 개선
  - 위치: `codebase/backend/src/modules/execution-engine/utils/load-trigger-parameter-schema.ts:33`, 호출부: `workflows.service.ts`, `workflows.controller.ts`, `schedule-runner.service.ts`, `hooks.service.ts`, `executions.service.ts`
  - 상세: 함수가 "Manual Trigger 전용"으로 명확히 문서화돼 있고, 5개 호출부 모두 실제로 manual-trigger 파라미터 스키마 조회 목적으로만 쓰인다(다른 트리거 타입 조회 용도로 재사용되는 곳 없음). 신규 유닛 테스트(`load-trigger-parameter-schema.spec.ts`)가 category 누락 케이스를 커버해 회귀 위험은 낮다.
  - 제안: 조치 불요.

- **[INFO]** `settings: { ...dto.settings } as Record<string, unknown>` → `{ ...dto.settings }` (타입 단언 제거)는 런타임 무영향
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:471`
  - 상세: 이 fix 의 스코프(Manual Trigger defaultValue)와 무관한 diff 이지만, 순수 컴파일 타임 타입 단언 제거라 런타임 동작·부작용은 없다.
  - 제안: 조치 불요 — 스코프 관련은 별도 scope 리뷰어 영역.

- **[INFO]** 프론트 `handleConfigChange` 즉시 store 커밋(undo 파괴) — 전회차 CRITICAL 로 지적됐던 부작용은 되돌림으로 완전히 해소됨
  - 위치: 커밋 `0b185cc8c refactor(manual-trigger): apply ai-review — revert spec-violating live-commit...`
  - 상세: `main...HEAD` diff 에 `node-settings-panel.tsx` 변경이 더 이상 존재하지 않음을 확인(`git diff --stat main...HEAD` 에 해당 파일 없음) — 전회차 side_effect.md 가 MEDIUM 위험도의 핵심 근거로 삼았던 undo 파괴 부작용은 이번 diff 범위에 없다.
  - 제안: 조치 불요 — 확인 목적의 기록.

- **[INFO]** 신규 review/consistency 산출물(`review/code/2026/07/09/11_08_21/**`, `review/consistency/2026/07/09/11_39_56/**`) 파일 생성은 저장소 관례(코드 리뷰/일관성 검토 산출물 경로)에 부합, 애플리케이션 런타임에 영향 없음
  - 위치: 파일 16-35
  - 상세: 전부 markdown/json 리포트이며 시크릿·자격증명 등 민감정보 포함 여부를 훑어봤으나 발견되지 않음.
  - 제안: 조치 불요.

## 요약

핵심 백엔드 fix(재진입 dispatch 의 durable input 사용, Manual Trigger 노드를 `type` 기준으로 조회)는 근본 원인에 부합하고 부작용 범위도 대체로 통제돼 있다 — `saveCanvas` 시그니처 변경은 하위 호환(선택적 파라미터, 유일 호출부 확인 완료)이고, 전회차 CRITICAL 이었던 프론트 undo 파괴 부작용은 되돌림으로 해소됐다. 다만 이번 라운드에서 새로 확인한 두 가지가 남는다: (1) 3개 재진입 dispatch 지점이 고치는 정확한 시나리오(재진입 시점에 트리거가 아직 미완료)를 결정적으로 재현·단언하는 테스트가 diff 안에 없다 — 인용되는 기존 crash-redrive/stalled-redelivery e2e 는 트리거를 항상 먼저 완료시킨 뒤 frontier 만 재구동하도록 설계돼 있어 이 fix 의 코드 경로를 통과시키지 않고, 신규 e2e 는 결정적 크래시/stall 훅 없이 정상 실행 경로에 의존한다. (2) `driveResumeFrame` 의 신규 주석이 `resumeGraphAfterRetry`(실제로는 이 fix 를 의도적으로 적용받지 않는 4번째 재진입 지점)를 "동일 동작"인 것처럼 잘못 인용해, 향후 유지보수자가 두 경로를 혼동할 위험을 남긴다. 두 항목 모두 즉시 기능 결함은 아니지만 "이 fix 가 실제로 검증됐다"는 근거의 신뢰도를 낮추므로 WARNING 으로 표기한다.

## 위험도

MEDIUM
