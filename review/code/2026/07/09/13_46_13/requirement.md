# 요구사항(Requirement) Review — manual-trigger-default-param (2회차, 11:08 라운드 fix 반영 후)

검증 범위: 실질 코드 변경 15개 파일(CHANGELOG, execution-engine.service.ts, retry-turn.service.ts, load-trigger-parameter-schema.{ts,spec.ts}, schedule-runner.service.spec.ts, workflows.service.{ts,spec.ts}, e2e spec, trigger-configs.{tsx,test.tsx}, i18n en/ko, plan 문서 2건). 나머지 20개 파일은 이전(11:08) ai-review/consistency-check 라운드의 산출물(RESOLUTION.md·SUMMARY.md·각 관점 리포트)이며 이번 라운드 신규 코드가 아니라 별도 분석 대상에서 제외했다. `git diff origin/main...HEAD -- codebase/frontend/src/components/editor/settings-panel/node-settings-panel.tsx` 로 1차 CRITICAL(ED-SP-05 위반 즉시 store 커밋)이 순net-zero(추가 후 되돌림)로 반영돼 실제로 되돌려졌음을 직접 확인했다.

## 발견사항

- **[INFO]** 근본원인 3건 fix가 spec 본문·엔티티 구조와 line-level 로 일치함을 직접 확인 (조치 불필요, 검증 기록)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1464-1475`(`reentryWorkflowInput`) 및 3개 호출부(`:2102`,`:2434`,`:3216`) / `codebase/backend/src/modules/execution-engine/utils/load-trigger-parameter-schema.ts:33-35` / `codebase/backend/src/modules/workflows/workflows.service.ts:586-624`
  - 상세: (1) `Execution.inputData` 는 `codebase/backend/src/modules/executions/entities/execution.entity.ts:74` 에서 `@Column({ name: 'input_data', type: 'jsonb', nullable: true })` 로 선언된 durable 컬럼임을 확인 — "재기동 후 input 사라짐" 이라는 옛 주석이 틀렸고 신규 주석("durable 컬럼 재사용")이 맞다. 3개 재진입 호출부(`driveResumeAwaited`/`driveResumeFrame`/`driveStuckRedrive`) 모두 새 헬퍼 `reentryWorkflowInput(savedExecution)` 을 참조하도록 일관되게 바뀌어 있다(`grep` 확인, 3곳). (2) `NODE_TYPES.MANUAL_TRIGGER === 'manual_trigger'`(`node-types.constants.ts:11`) 이고, 프론트 `is-trigger.ts:8` 의 "category 누락 데이터 보호망" 코멘트도 실제로 존재해 인용이 정확하다. (3) `retry-turn.service.ts` 의 "AI multi-turn retry 는 `input:{}` 유지" 의도적 예외 주석이 인용하는 `spec/5-system/4-execution-engine.md:1387`("`_retryState` 는 ... 원본 nodeInput 을 포함하지 않으므로 `$input.*` 는 미해소 ... documented limitation")을 직접 확인 — 인용이 정확하다.
  - 제안: 없음(검증 완료).

- **[INFO]** spec §4/§5.1(`spec/4-nodes/7-trigger/1-manual-trigger.md:77-111`)의 실행 로직·output 구조가 e2e 로 정확히 재현·검증됨
  - 위치: `codebase/backend/test/manual-trigger-default-param.e2e-spec.ts`
  - 상세: `defaultValue` 해석(§4.1 어댑터 사전 해석) → `output.parameters`(§5.1) → `$node[...].output.parameters.<name>`/`$params.<name>`(§5.1 Expression 접근 예, line 148-150) 세 케이스를 트리거→transform 실그래프로 검증하고, 재진입(크래시 redrive) 케이스는 `_test/simulate-execution-run-redelivery` 훅으로 결정론적으로 재현한다. malformed 저장 400 케이스도 `INVALID_TRIGGER_PARAMETERS` 코드까지 assert. 세 근본원인 모두 회귀 테스트로 커버됨.
  - 제안: 없음.

- **[WARNING]** `[SPEC-DRIFT]` 저장 시점(`saveCanvas`)에 재사용된 `INVALID_TRIGGER_PARAMETERS` 최상위 에러코드가 spec §6 "처리 위치" 표에 반영돼 있지 않음
  - 위치: 코드 `codebase/backend/src/modules/workflows/workflows.service.ts:611-624`(`validateManualTrigger`, 신규 `invalid_schema` 게이트) vs spec `spec/4-nodes/7-trigger/1-manual-trigger.md:161-183`
  - 상세: spec §6 표(161-168행)는 `invalid_schema` reason 의 "시점"을 "handler.validate (저장 시점)"으로만 규정하고 top-level HTTP 에러코드는 규정하지 않는다. "처리 위치" 표(174-179행)는 오직 `missing_required`(실행 시점) reason 에 대해서만 어댑터별 코드를 나열하며, Manual 실행 경로의 `INVALID_TRIGGER_PARAMETERS`(176행)가 유일하게 문서화된 사용처다. 이번 diff 는 완전히 다른 시점·다른 reason(`invalid_schema`, 저장 시점, `saveCanvas`)에 **동일한 top-level `code: 'INVALID_TRIGGER_PARAMETERS'`** 를 재사용하는데, spec 은 이 확장을 명시하지 않는다. 코드 쪽은 합리적 선택(같은 도메인 에러, `details[]` 로 `INVALID_SCHEMA`/`MISSING_REQUIRED_FIELD` 구분 가능)이라 되돌릴 대상이 아니며, 오히려 spec §6 이 "저장 시점에 구조 위반을 잡는다"고 규정한 요구사항을 이번 fix 가 처음으로 실제 구현했다는 점에서 spec 요구사항 충족 방향의 개선이다. 즉 **코드가 맞고 spec 표가 이 확장된 사용처를 못 따라간 SPEC-DRIFT.**
  - 이미 추적됨: `plan/in-progress/spec-update-manual-trigger-save-time-error-code.md` 가 정확히 이 갭(§6 표 + `spec/data-flow/11-workflow.md` `POST /:id/save` 시퀀스 + `spec/data-flow/10-triggers.md:44-47` + `spec/5-system/3-error-handling.md:155`)을 project-planner 위임 대상으로 명시하고 있고, `review/code/2026/07/09/11_08_21/RESOLUTION.md` W5 도 동일 결론(코드 유지, spec 반영은 impl-done consistency 로 확인)이다.
  - 제안: 코드 변경 불필요. spec 반영은 위 plan 문서를 통해 project-planner 가 §6 "처리 위치" 표에 "저장 시점(`POST /:id/save`, `workflows.service.ts validateManualTrigger`) 발행" 행을 추가하고 `data-flow/11-workflow.md`/`10-triggers.md`/`error-handling.md` 를 동기화하면 해소.

- **[WARNING]** 이미 malformed `config.parameters` 로 영속된 기존 워크플로우는 신규 저장 게이트로 인해 (트리거와 무관한 편집이라도) 이후 모든 `/save` 가 400 으로 막히지만 백필/마이그레이션이 diff 에 없음
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:586-624`(`validateManualTrigger`, `restoreVersion` 예외 없이 신규 `/save` 전체에 적용)
  - 상세: 이 버그 자체가 "malformed 파라미터가 조용히 저장될 수 있었다"는 전제 위에 있으므로, 실 데이터에 이미 그런 워크플로우가 존재할 가능성이 있다. `restoreVersion` 은 `skipParamSchemaValidation=true` 로 예외 처리됐지만, 그 이후 사용자가 아무 노드나 옮기고 "Save" 를 누르면 트리거와 무관한 편집임에도 `400 INVALID_TRIGGER_PARAMETERS` 로 막혀 스스로 트리거 파라미터를 고치기 전까지는 저장이 전혀 안 된다. 정합성 강화라는 의도는 타당하나 하위 호환 마이그레이션 경로가 없다.
  - 이미 추적됨: `review/code/2026/07/09/11_08_21/RESOLUTION.md` W6 이 동일 항목을 "**restoreVersion 예외** 구현 완료, 잔존 데이터 정리 마이그레이션은 운영 후속" 으로 명시적으로 accept 했다. 신규 이슈가 아니라 이미 결정된 잔여 리스크.
  - 제안: 배포 전 실 데이터에서 malformed manual-trigger 파라미터를 가진 워크플로우 존재 여부를 조회하고, 있다면 배포와 함께 정리 스크립트를 검토(RESOLUTION.md 의 기존 권고와 동일, 추가 조치 촉구 아님).

- **[INFO]** `INVALID_TRIGGER_PARAMETERS` 가 프론트 `ERROR_KO` 매핑에 여전히 없음(이번 diff 로 새로 생긴 갭 아님)
  - 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts` (`grep` 결과 `GRAPH_VALIDATION_FAILED` 는 있으나 `INVALID_TRIGGER_PARAMETERS` 없음)
  - 상세: 이 코드는 실행 경로(`workflows.controller.ts` execute)에 이미 존재했던 코드이며 이번 diff 가 새로 만든 코드는 아니다. 다만 저장 경로에서도 같은 코드가 나오게 되어 노출 표면이 넓어졌다. 가드 테스트는 progressive allowlist 라 CI 실패는 아니다.
  - 제안: 선택사항 — `ERROR_KO`/`LOCALIZED_ERROR_CODES` 에 `INVALID_TRIGGER_PARAMETERS` 추가 검토(대부분의 경우 프론트 inline 검증(`trigger-configs.tsx`)이 먼저 막으므로 노출 빈도는 낮음).

- **[INFO]** 반환값·엣지케이스 점검 — 이상 없음
  - 위치: `validateTriggerParameterSchema`(`resolve-trigger-parameters.ts:61-98`), `loadTriggerParameterSchema`(`load-trigger-parameter-schema.ts:28-48`), `validateManualTrigger`(`workflows.service.ts:586-624`)
  - 상세: `params === undefined` → 검증 skip(과거 동작 유지, 빈 배열/누락 허용), `params === null` → `validateTriggerParameterSchema` 가 빈 배열 반환(정상), 비배열 → `(root)` 필드로 `invalid_schema`. `skipParamSchemaValidation=true` 여도 트리거 존재/유일성(0개·2개 이상) 체크는 그대로 유지되어 `restoreVersion` 이 구조적으로 깨진 스냅샷(트리거 자체가 없거나 중복인 경우)까지 통과시키지는 않는다 — 의도된 범위 축소로 보인다. TODO/FIXME/HACK/XXX 코멘트는 diff 전체에서 미검출(`grep` 확인).
  - 제안: 없음.

## 요약

핵심 버그(Manual Trigger `defaultValue` 가 실행에서 무시되던 문제)의 근본원인 3건 — 엔진 재진입 시 `Execution.inputData` durable 컬럼 미사용, `loadTriggerParameterSchema` 의 `category` 기반 조회 누락, `saveCanvas` 의 파라미터 스키마 미검증 — 은 spec `4-nodes/7-trigger/1-manual-trigger.md` §4/§5.1/§6 본문과 line-level 로 정확히 일치하며, 각 fix 의 근거(주석에 인용된 durable 컬럼 선언·`is-trigger.ts` fallback·`spec/5-system/4-execution-engine.md:1387` retry 미해소 문서화)를 코드베이스에서 직접 재확인했다. 11:08 라운드 ai-review 가 지적한 CRITICAL(하루 전 확정된 ED-SP-05/§8 R-3 를 위반한 즉시 store 커밋)은 실제로 되돌려져 `node-settings-panel.tsx` 가 main 대비 net-zero 임을 `git diff` 로 직접 확인했다. e2e(`manual-trigger-default-param.e2e-spec.ts`)·unit(`load-trigger-parameter-schema.spec.ts`, `workflows.service.spec.ts`)·프론트 테스트가 세 근본원인과 hardening(저장 시 400, 인라인 이름 검증) 모두를 정확히 타깃해 회귀를 방지한다. 유일한 미해소 사항은 저장 시점에 재사용된 `INVALID_TRIGGER_PARAMETERS` 코드가 spec §6 "처리 위치" 표에 아직 반영되지 않은 SPEC-DRIFT(코드가 spec 요구사항을 오히려 처음 충족시킨 방향이라 코드가 아니라 spec 갱신이 필요)와, 기존 malformed 데이터에 대한 백필 부재인데, 둘 다 이미 각각 `plan/in-progress/spec-update-manual-trigger-save-time-error-code.md`(project-planner 위임)와 `review/code/2026/07/09/11_08_21/RESOLUTION.md` W6(운영 후속)로 명시적으로 추적·수용된 잔여 리스크이며 신규로 발견된 차단 사유는 아니다.

## 위험도

LOW
