# 요구사항(Requirement) 리뷰 — EIA §R17 마스킹 마커 재제출 서버측 거부 (Manual 실행 경로)

## 검토 방법

프롬프트에 diff 가 생략된 파일(`reject-masked-resubmission.ts`/`.spec.ts`, `masked-reject-callers-guard.ts`/`.spec.ts`, `executions-rerun.service.spec.ts`, `workflows.controller.spec.ts`)은 저장소에서 직접 `Read` 했다. 핵심 로직(`reject-masked-resubmission.ts`)·타입(`trigger-parameter.types.ts`)·두 호출부(`executions.service.ts`, `workflows.controller.ts`)·마커 판정 공유 프리미티브(`sanitize-error-message.ts`)·저장소 가드(`masked-reject-callers-guard.ts`)를 전문 확인했고, 관련 spec 6개 문서(`spec/4-nodes/7-trigger/1-manual-trigger.md` §6, `spec/5-system/3-error-handling.md` §1.7, `spec/5-system/12-webhook.md`, `spec/5-system/13-replay-rerun.md`, `spec/1-data-model.md`, `spec/5-system/14-external-interaction-api.md` §R17)을 line-level 로 대조했다. 관련 유닛 테스트 6개 스위트(137 tests) + 두 호출부 spec(64 tests) 를 직접 실행해 GREEN 을 확인했고, 변경 파일에 대해 `tsc --noEmit` 을 돌려 신규 타입 에러가 없음을 확인했다(기존 무관 파일들의 pre-existing 에러는 이 diff 와 무관 — carousel/cafe24/http-safety 등).

이번 diff 는 `plan/complete/spec-draft-inputoverride-marker-reject.md` + `spec-update-masked-reject-framing.md` 가 이미 3라운드(00_03_57 CRITICAL 1건 → 00_39_27 WARNING 5건 → 01_15_47 WARNING 0/INFO 10건)를 거쳐 수렴시킨 변경의 최종 상태다. 본 리뷰는 그 수렴을 신뢰하지 않고 **처음부터 독립적으로 재검증**했다.

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** 검사 시점(raw 우선 → resolve → 재검사)의 알려진 트레이드오프가 여전히 존재한다 — raw phase 를 통과한 뒤 **무관한 필드의 진짜 타입 오류**로 `resolveTriggerParameters` 가 `coerce_failed` 를 먼저 던지면, JSON 문자열로 인코딩된 object/array 안의 마스킹 마커(resolve 후 phase)는 그 요청에서 검사되지 않는다.
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` — `throwIfAny` 상단 docstring(81-89행)에 트레이드오프가 명시돼 있고, `spec/4-nodes/7-trigger/1-manual-trigger.md` §6 인접 절(197행 부근)에도 반영돼 있다.
  - 상세: 보안 우회가 아니라(마스킹 값 자체를 실제 입력으로 흘려보내지 않음 — coerce_failed 로 요청 전체가 거부되므로) 안내가 한 왕복 늦어지는 UX 케이스이며, `01_15_47` testing INFO-3 로 이미 등재·수용된 사안이다. 코드·spec·테스트(`reject-masked-resubmission.spec.ts` "raw 에서 걸리면 coerce_failed 가 섞이지 않는다")가 서로 일치해 새로 지적할 결함은 아니다.
  - 제안: 조치 불요(기존 리뷰가 이미 트레이드오프로 수용).

- **[INFO]** spec fidelity 확인 — `spec/5-system/13-replay-rerun.md` §8.1 의 `INVALID_INPUT` 표가 `error.details[].code` 4종(`MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`/`INVALID_SCHEMA`/`MASKED_VALUE_RESUBMITTED`)을 카탈로그 참조로 나열하지만, `INVALID_SCHEMA`(`invalid_schema`)는 `loadTriggerParameterSchema`(`load-trigger-parameter-schema.ts:38-46`)가 스키마 구조 오류를 **내부적으로 삼키고 `undefined` 로 pass-through** 하므로 re-run/execute 런타임 경로에서는 실제로 발생하지 않는다. 이는 `webhook.md`가 이미 동일 방식으로 캐비엇을 명시한 기존 패턴과 동일하고, 이번 diff 가 새로 만든 불일치가 아니다(변경 전부터 있던 카탈로그 서술 관행).
  - 위치: `spec/5-system/13-replay-rerun.md:246` (INVALID_INPUT 표 행)
  - 제안: 조치 불요 — 이번 diff 범위 밖의 기존 서술 패턴.

## Spec fidelity 상세 확인 결과

- `reject-masked-resubmission.ts` 의 raw-먼저·정확 일치·깊이 상한(`MAX_REDACT_DEPTH`) 경계가 `spec/4-nodes/7-trigger/1-manual-trigger.md:170,197-210`, `spec/5-system/14-external-interaction-api.md:1573-1596` 과 line-level 로 일치한다 — "재제출뿐 아니라 fresh 입력도 대상", "webhook·schedule 은 저작 주체 기준으로 제외", "adapter 전후 2단계" 서술이 모두 실제 구현과 부합.
- `TriggerParameterErrorDetail.code = 'MASKED_VALUE_RESUBMITTED'` / 내부 `reason = 'masked_value_resubmitted'` 매핑이 `spec/5-system/3-error-handling.md:189-193`, `spec/5-system/12-webhook.md:311-313` 의 4종 카탈로그와 일치.
- 두 호출부의 에러 코드(`executions.service.ts` → `INVALID_INPUT`, `workflows.controller.ts` → `INVALID_TRIGGER_PARAMETERS`)가 `spec/5-system/13-replay-rerun.md:246` 및 `1-manual-trigger.md` §6 응답 봉투 서술과 각각 일치.
- `errors` → `details` 봉투 교정(선존 버그)이 `GlobalExceptionFilter`(`resp.details ?? nested?.details` 만 읽음, `errors` 미독)와 실제로 일치함을 코드로 직접 확인했고, 회귀 테스트(`executions-rerun.service.spec.ts:394` "[회귀] 거부 응답이 details[] 로...")가 이를 고정한다.
- `spec/1-data-model.md:471`(Execution.input_data), `spec/3-workflow-editor/3-execution.md:89-91`, `spec/5-system/13-replay-rerun.md:375-381` 세 자매 문서 모두 "서버 2층 거부" 서술을 갖고 있어 plan 문서가 지적한 3곳 정정이 실제로 반영됐음을 확인했다.
- 저장소 가드(`masked-reject-callers-guard.ts`)의 허용목록(`hooks.service.ts`, `schedule-runner.service.ts`, wrapper/base 자신)이 실제 `resolveTriggerParameters`(base) 직접 소비처와 grep 대조 결과 정확히 일치 — Manual 저장 경로(`workflows.service.ts` `validateManualTrigger`)는 `validateTriggerParameterSchema`(스키마 구조 검증, 별도 함수)만 쓰고 base 를 부르지 않아 가드 스코프 밖인 것도 spec 서술과 부합.

## 요약

`resolveTriggerParametersRejectingMasked` 는 raw 우선 검사(coerce 이전 시점, boolean 우회·number coerce_failed 선점·defaultValue 과잉차단 세 우회를 모두 닫음) → resolve → JSON 문자열 파싱 후 재검사의 2단계 구조로, 대상 키 집합을 항상 raw 기준으로 잡아 defaultValue 필드를 과잉 차단하지 않는다. 정확 일치·깊이 상한(`MAX_REDACT_DEPTH`, 실제 마스커 `deepRedactSecrets` 산출물과의 왕복 통합 테스트로 고정) 경계가 정확하고, webhook/schedule 은 저장소 AST 가드로 스코프 밖임이 기계적으로 보장된다. 두 Manual 실행 진입점(`executions.service.ts` re-run, `workflows.controller.ts` execute — legacy `input.parameters` back-compat 경로 포함)이 동일 함수로 배선됐고 에러 코드·`details[]` 봉투가 spec 과 line-level 로 일치한다. 선존 버그(`errors` 키가 `GlobalExceptionFilter` 에서 버려지던 문제)도 함께 교정됐고 회귀 테스트로 고정돼 있다. 관련 spec 문서 6개 모두 이번 변경(범위 확대: 재제출 한정 → Manual 실행 경로 전체, 검사 시점: resolve 직후 → 전후 2단계)을 정확히 반영하도록 갱신돼 SPEC-DRIFT 도 발견되지 않았다. 독립 재검증(소스 전문 열람·테스트 실행·tsc 확인·spec 대조)에서 신규 CRITICAL/WARNING 을 발견하지 못했다 — 3라운드에 걸친 기존 수렴 판정과 일치한다.

## 위험도

NONE
