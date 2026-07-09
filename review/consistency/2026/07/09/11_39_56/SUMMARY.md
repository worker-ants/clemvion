# Consistency Check 통합 보고서

**BLOCK: NO** — 확보된 결과(1/5 checker) 기준 Critical 없음. **단, 아래 "프로세스 경고" 참고 — 이 판정은 잠정적(provisional)이다.**

## 프로세스 경고 (필독)

workflow manifest 는 5개 checker 전원을 `status=success` 로 보고했으나, 실제로 `output_file` 이 디스크에 존재하는 것은 `naming_collision` 1건뿐이었다 (`cross_spec` / `rationale_continuity` / `convention_compliance` / `plan_coherence` 4건은 파일 미생성 — 알려진 Workflow FS-write 비결정성 패턴). 본 요약 sub-agent 는 재시도/재호출 권한이 없으므로, 위 4개 checker 는 아래 표에서 **"재시도 필요"** 로 표기했다. **호출자(main)는 이 4개 checker 를 `ls` 로 재확인 후 output_file 이 여전히 없으면 해당 perspective 를 직접 Agent 로 재실행하고, 그 결과까지 반영해 BLOCK 최종 판정을 확정해야 한다.** 현재 `BLOCK: NO` 는 확보된 1/5 결과에 근거한 잠정치이며, 나머지 4개에서 Critical 이 나올 경우 뒤집힐 수 있다.

- 확인 완료(파일 존재, 내용 반영): `naming_collision`
- 재시도 필요(파일 미생성, status=success 였으나 내용 접근 불가): `cross_spec`, `rationale_continuity`, `convention_compliance`, `plan_coherence`

## 전체 위험도
**LOW (확인분 한정)** — naming_collision 은 Critical 없음/Warning 1건(에러코드 재사용 범위 문서 미반영)/Info 다수(스코프 격리 확인). 나머지 4개 checker 는 미확인.

## Critical 위배 (BLOCK 사유)

(확인된 범위 내 없음)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | naming_collision | 에러 코드 `INVALID_TRIGGER_PARAMETERS` 가 저장 시점(`POST /api/workflows/:id/save`) 경로에도 재사용되는데, spec 3곳이 이 코드를 실행 경로(`/:id/execute`) 전용으로만 문서화 — 사용 범위 확장이 문서에 반영되지 않음 | `spec/4-nodes/7-trigger/1-manual-trigger.md` §6 표(처리 위치 컬럼), `spec/5-system/3-error-handling.md` L155, `spec/data-flow/10-triggers.md` L44-47, `spec/data-flow/11-workflow.md` L44-45(POST /:id/save 시퀀스) | `codebase/backend/src/modules/workflows/workflows.service.ts` `validateManualTrigger()`(신규, diff L433-467) — 저장 시점 `invalid_schema` 검증 실패 시 동일 `INVALID_TRIGGER_PARAMETERS` 를 throw (e2e: `codebase/backend/test/manual-trigger-default-param.e2e-spec.ts` L671-699) | 위 4개 spec 문서에 저장 경로에서도 동일 코드가 발행됨을 반영: §6 "처리 위치" 컬럼에 `workflows.service.ts`(저장 시점, `invalid_schema` 전용) 행 추가, `data-flow/11-workflow.md` 의 `POST /:id/save` 시퀀스에 400 `INVALID_TRIGGER_PARAMETERS` 분기 추가. 코드/이름 자체는 변경 불필요(의미 기반 명명 규약 부합) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | naming_collision | 신규 로컬 식별자(`skipParamSchemaValidation`, i18n 키 `errorNameRequired`/`errorNameInvalid`/`errorNameDuplicate`, `PARAM_NAME_RE`, 신규 테스트 파일 경로) 스코프 격리 확인 — 충돌 없음 | `workflows.service.ts`, frontend i18n `nodeConfigs.trigger.*`, `trigger-configs.tsx`, `load-trigger-parameter-schema.spec.ts`, `manual-trigger-default-param.e2e-spec.ts` | 조치 불필요, 기록용 |
| 2 | naming_collision | `MANUAL_TRIGGER_TYPE`(workflows.service.ts 기존 로컬 상수, L31) 과 `NODE_TYPES.MANUAL_TRIGGER` 가 동일 값(`'manual_trigger'`)을 병행 정의 — 이번 diff 가 만든 문제는 아니며 신규 조회 조건(`load-trigger-parameter-schema.ts`)이 후자를 사용 | `workflows.service.ts` L31, `load-trigger-parameter-schema.ts` | 별도 리팩터 백로그로만 참고, 이번 target 과 무관해 조치 불필요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | 재시도 필요 | status=success 였으나 output_file(`cross_spec.md`) 미생성 — 내용 확인 불가 |
| rationale_continuity | 재시도 필요 | status=success 였으나 output_file(`rationale_continuity.md`) 미생성 — 내용 확인 불가 |
| convention_compliance | 재시도 필요 | status=success 였으나 output_file(`convention_compliance.md`) 미생성 — 내용 확인 불가 |
| plan_coherence | 재시도 필요 | status=success 였으나 output_file(`plan_coherence.md`) 미생성 — 내용 확인 불가 |
| naming_collision | LOW | target spec(`1-manual-trigger.md`) 본문 무변경. 구현이 도입한 로컬 식별자는 스코프 격리돼 충돌 없음. 유일한 주목 사안은 기존 에러코드 `INVALID_TRIGGER_PARAMETERS` 의 저장 경로 재사용이 spec 3곳에 문서화되지 않은 점(WARNING) |

## 권장 조치사항
1. **(최우선, BLOCK 확정 전 필수)** 호출자(main)가 `cross_spec` / `rationale_continuity` / `convention_compliance` / `plan_coherence` 4개 checker output_file 존재 여부를 `ls` 로 재확인하고, 없으면 해당 perspective 를 Agent tool 로 직접 재호출해 결과를 확보한다. 4개 모두 확보 후 Critical 유무를 재판정해 이 SUMMARY 의 `BLOCK` 값을 최종 확정한다.
2. `spec/4-nodes/7-trigger/1-manual-trigger.md` §6 "처리 위치" 표에 저장 시점(`POST /:id/save`, `workflows.service.ts` `validateManualTrigger()`) 발행 경로를 추가해 `INVALID_TRIGGER_PARAMETERS` 가 실행 경로 전용이 아님을 명시.
3. `spec/data-flow/11-workflow.md` 의 `POST /:id/save` 시퀀스에 `INVALID_TRIGGER_PARAMETERS` 400 분기를 추가하고, `spec/5-system/3-error-handling.md` L155 의 "Manual 실행 경로의 ... 도 동일 헬퍼를 쓴다" 서술을 저장 경로도 포함하도록 정정.
4. (조치 불필요, 기록용) INFO 항목 2건은 별도 조치 없이 참고만.