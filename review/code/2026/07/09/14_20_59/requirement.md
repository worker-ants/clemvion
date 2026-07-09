# 요구사항(Requirement) Review — manual-trigger-default-param (2026-07-09 14:20:59 세션)

이 diff는 이미 두 차례 리뷰(코드리뷰 `review/code/2026/07/09/11_08_21` + consistency-check
`review/consistency/2026/07/09/11_39_56`)를 거쳐 CRITICAL 1건(spec ED-SP-05 위반 — 노드 설정
즉시 store 커밋)을 되돌리고, WARNING 다수를 라운드 2/3 커밋(`7454a817c`, `41663bebd`)으로
추가 반영한 최종 상태다. 이번 세션은 그 최종 상태를 독립적으로 재검증한다. 실제 코드
(`git diff origin/main...HEAD -- codebase/`)를 직접 열람해 diff 서술과 대조했다.

## 발견사항

- **[INFO]** 세 근본원인 fix(엔진 재진입 durable input / type 기반 트리거 조회 / 저장 시점
  스키마 검증) 모두 코드 열람으로 주장이 실측 확인됨 — 기능 완전성 문제 없음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1417-1438`
    (`reentryWorkflowInput`, 3개 호출부 `driveResumeAwaited`/`driveResumeFrame`/`driveStuckRedrive`
    모두 이 helper 참조로 통일됨), `codebase/backend/src/modules/execution-engine/utils/load-trigger-parameter-schema.ts:29-34`,
    `codebase/backend/src/modules/workflows/workflows.service.ts:585-609`
  - 상세: `Execution.inputData` 는 `@Column({ name: 'input_data', type: 'jsonb', nullable: true })`
    durable 컬럼(엔티티 확인 완료)이라 "재진입 후 소멸" 주석이 틀렸다는 근본원인 진단이
    정확하다. `NODE_TYPES.MANUAL_TRIGGER === 'manual_trigger'` 확인 완료, 프론트
    `is-trigger.ts` fallback 근거와 일치. `ManualTriggerHandler.validate()`(실행 pre-flight)와
    `WorkflowsService.validateManualTrigger()`(저장 시점) 양쪽 모두 동일 SoT
    `validateTriggerParameterSchema`(`resolve-trigger-parameters.ts`)를 호출해 두 경로 결과가
    항상 동형임을 코드로 재확인(아키텍처 리뷰가 우려한 "두 경로가 갈릴 위험"은 현재 시점엔
    실제로 발생하지 않음 — manual_trigger 는 blockingRule 이 없어 `evaluateMetadataBlockingErrors`
    분기도 결과 동등).
  - e2e(`codebase/backend/test/manual-trigger-default-param.e2e-spec.ts`)가 세 fix 각각을
    결정론적으로 재현: (1) type 조회 정상 실행 경로, (2) `DELETE node_execution` +
    `UPDATE execution SET status='running'` 로 "트리거 실행 전 크래시"를 합성 후
    `_test/simulate-execution-run-redelivery` 훅으로 재진입시켜 `output.parameters` 보존
    검증(타이밍 비의존), (3) 빈 이름 파라미터 저장 시 400 확인. `reentryWorkflowInput` 자체의
    unit 회귀(`execution-engine.service.spec.ts` `reentryWorkflowInput` describe 블록)도
    durable-verbatim / null·undefined→{} 두 경계값을 커버.
  - 조치 불필요 — 기록용.

- **[WARNING]** `[SPEC-DRIFT 아님 — 회색지대에 가까운 spec 공백]` 저장 시점(`POST /:id/save`)
  구조 위반에 재사용된 `INVALID_TRIGGER_PARAMETERS` 의 HTTP 응답 코드/처리 위치가
  spec §6 어디에도 명시되지 않음
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:595-601`
    (`validateManualTrigger` 신규 `BadRequestException({code:'INVALID_TRIGGER_PARAMETERS', ...})`)
    vs `spec/4-nodes/7-trigger/1-manual-trigger.md:161-179`
  - 상세: §6 상단 표(161-168행)는 구조 위반(`invalid_schema`) 4행에 "시점"만
    `handler.validate (저장 시점)`로 적을 뿐 top-level HTTP `error.code`는 규정하지 않는다.
    하단 표(172-179행)는 제목 자체가 "**실행 시점** 어댑터별 누락(`missing_required`)의
    HTTP 응답 코드"로 범위를 execute-path·missing_required reason 으로 한정하며, 여기서만
    `INVALID_TRIGGER_PARAMETERS`(Manual 실행 경로, `workflows.controller.ts`)가 등장한다.
    즉 spec 은 애초에 "구조 위반(`invalid_schema`)의 HTTP 코드가 무엇인지" 자체를 규정한
    적이 없다 — 이번 PR 이 처음으로 그 gap(저장 시점 구조 검증 자체가 부재했던 버그)을
    채우면서 기존 실행-경로 코드를 재사용하기로 선택했다. 코드 선택 자체는 불합리하지
    않고(동일 도메인 문제), spec 이 규정을 아예 갖고 있지 않았던 지점이라 "코드가 spec 을
    어겼다"고 보기는 어렵다. 다만 클라이언트/문서 독자가 `INVALID_TRIGGER_PARAMETERS` 를
    execute 전용으로 오인할 위험은 남는다.
  - 이미 `plan/in-progress/spec-update-manual-trigger-save-time-error-code.md` 로
    project-planner 위임돼 있고(§6 표 행 추가, `data-flow/11-workflow.md` 시퀀스,
    `data-flow/10-triggers.md`/`5-system/3-error-handling.md` 동기화), impl-done
    consistency(`review/consistency/2026/07/09/11_39_56/SUMMARY.md`)가 이 항목을 유일한
    WARNING 으로 재확인하며 `BLOCK: NO` 를 냈다. 이번 diff 시점엔 아직 spec 미반영 상태이므로
    **재확인 목적으로 계속 기록** — 코드 되돌림은 불필요, spec 갱신만 남음.
  - 제안: 후속 plan 대로 `1-manual-trigger.md` §6 에 "저장 시점(`POST /:id/save`,
    `workflows.service.ts validateManualTrigger`) → 400 `INVALID_TRIGGER_PARAMETERS`" 행 추가.

- **[INFO]** §6 "handler.validate (저장 시점)" 문구가 실제 호출 경로와 문자 그대로는 다름
  - 위치: `spec/4-nodes/7-trigger/1-manual-trigger.md:163-166` vs
    `codebase/backend/src/modules/workflows/workflows.service.ts:589-597`
  - 상세: `WorkflowsService.validateManualTrigger()` 는 `ManualTriggerHandler.validate()` 를
    호출하지 않고 그 내부에서 쓰는 `validateTriggerParameterSchema` 를 직접 재호출한다(구조적
    에러 봉투 `{code, message, details}` 를 보존하려면 `handler.validate` 의 flat string[] 반환으로는
    불가능 — RESOLUTION.md W3 에서 이미 의도적 선택으로 수용됨, 코드 확인 결과 두 경로가
    같은 SoT 함수를 쓰므로 결과 동형이라 실질적 회귀 위험은 낮음). "handler.validate" 라는
    표현은 검증 로직의 출처(같은 헬퍼)를 가리키는 것이지 실제 메서드 호출을 가리키는 게
    아니다.
  - 위 WARNING 과 같은 follow-up plan 항목에 이미 포함(§6 문구 각주 정정). 코드 기능에는
    영향 없음 — 참고용.

- **[INFO]** 프론트 인라인 이름 검증(`nameError`)은 Save 버튼을 막지 않고 저장 실패는
  백엔드 400 에 의존
  - 위치: `codebase/frontend/src/components/editor/settings-panel/node-configs/trigger-configs.tsx:32-39`
  - 상세: `nameError` 는 시각적 경고(빨간 테두리 + 문구)만 표시하며 `addParameter`/저장 흐름을
    차단하는 disabled 처리가 없다. 사용자가 무효 이름인 채로 "Save changes" 를 누르면
    `validateManualTrigger` 의 400 `INVALID_TRIGGER_PARAMETERS` 에 의존해 최종 차단된다.
    이중 방어(프론트 즉시 피드백 + 백엔드 최종 게이트) 구조 자체는 의도된 hardening 설계이고
    spec §6 도 "handler.validate (저장 시점)" 만 요구할 뿐 프론트 저장 버튼 비활성화까지
    요구하지 않아 spec 위반은 아니다. 기능적으로 문제는 아니나, UX 상 "인라인 에러가 보이는데
    저장이 되는" 경험이 가능함을 기록.
  - 제안: 조치 불필요(설계 선택). 필요하면 별도 백로그로 저장 버튼 disable 검토.

- **[INFO]** 이미 malformed `config.parameters` 를 가진 기존 워크플로우의 향후 저장/복원
  영향은 기존 라운드에서 이미 심층 검토·수용됨
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:568-609`
    (`validateManualTrigger`), `plan/in-progress/manual-trigger-default-param.md`
  - 상세: 신규 게이트는 트리거와 무관한 캔버스 편집을 저장하려는 기존 malformed 워크플로우도
    막는다(회귀 성격의 API 동작 변화). `restoreVersion` 은 `skipParamSchemaValidation=true`
    로 예외 처리됐지만, 일반 `/save` 재저장은 여전히 막힌다. 이전 라운드(`api_contract.md`,
    `requirement.md` @ 11_08_21)가 이미 이 리스크를 WARNING 으로 지적했고 마이그레이션
    스크립트는 diff 에 없다 — 운영 판단/배포 전 데이터 조회 필요 사항으로 이미 별도
    기록됨(코드 결함 아님, 배포 절차 항목). 재확인만 하고 새 발견사항은 아님.
  - 제안: 배포 전 malformed manual-trigger 파라미터 실데이터 존재 여부 조회 권장(기존 제안
    유지).

- **[INFO]** TODO/FIXME/HACK/XXX 미검출, 모든 코드 경로 반환값 정합
  - `reentryWorkflowInput` 은 `Record<string, unknown>` 을 모든 경로(값 존재/null/undefined)에서
    반환(never `undefined`). `validateManualTrigger` 는 skip 플래그·트리거 0/1/2+ 개·params
    undefined/유효/무효 모든 조합에서 명확한 반환(void) 또는 throw 로 종결. `loadTriggerParameterSchema`
    는 JSDoc 이 명시한 3가지 `undefined` 케이스(트리거 없음/parameters 없음/구조 무효) 모두
    unit test(`load-trigger-parameter-schema.spec.ts`)로 커버됨. 미비 경로 없음.

## 요약

세 근본원인 fix(엔진 재진입 durable input 재사용, `type` 기반 Manual Trigger 조회, 저장
시점 파라미터 스키마 검증)는 spec §4/§5.1/§6 이 기술하는 동작(`defaultValue` 해석·저장 시점
구조 검증)을 정확히 충족하도록 구현됐고, 코드 직접 열람으로 diff/plan/CHANGELOG 의 서술과
실제 구현이 line-level 로 일치함을 확인했다. 이전 라운드에서 발견된 유일한 CRITICAL(spec
ED-SP-05 위반 — 노드 설정 즉시 store 커밋)은 완전히 되돌려져 이번 diff 범위에서 제거됐고,
그 파생 WARNING(undo 파괴, keystroke 재렌더)도 함께 해소됐다. 남은 항목은 전부 이미 인지되고
`plan/in-progress/spec-update-manual-trigger-save-time-error-code.md` 로 project-planner 에
위임된 spec 문서 완결성 gap(§6 이 저장 시점 `INVALID_TRIGGER_PARAMETERS` 발행과
"handler.validate" 문구 정확도를 아직 반영하지 못함) 뿐이며, 이는 spec 이 애초에 규정하지
않았던 공백을 이번 구현이 합리적으로 채운 것이라 코드 결함이 아니다. impl-done
consistency-check(`BLOCK: NO`, Critical 0)도 동일 결론이다. TODO/FIXME 없음, 모든 함수가
모든 경로에서 적절한 반환값/예외를 낸다. 엣지 케이스(inputData null/undefined, 트리거
0/1/N개, params undefined/malformed, 구버전 스냅샷 복원)는 unit/e2e 로 커버된다.

## 위험도

LOW
