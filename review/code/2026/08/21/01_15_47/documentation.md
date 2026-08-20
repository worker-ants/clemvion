# 문서화(Documentation) 리뷰 — 마스킹 재제출 서버측 거부 (`resolveTriggerParametersRejectingMasked`, EIA §R17)

## 검토 범위

실질 프로덕션 코드 변경(8개 파일: `CHANGELOG.md`, `trigger-parameter.types.ts`,
`reject-masked-resubmission.ts`(신규)+`.spec.ts`(신규), `executions.service.ts`+
`executions-rerun.service.spec.ts`, `workflows.controller.ts`+`.spec.ts`,
`sanitize-error-message.ts`)과, 이 변경이 참조/동기화해야 하는 spec 7곳
(`1-data-model.md`, `3-workflow-editor/3-execution.md`, `4-nodes/7-trigger/1-manual-trigger.md`,
`5-system/{12-webhook,13-replay-rerun,14-external-interaction-api,3-error-handling}.md`)과
plan 문서 3건(`spec-draft-inputoverride-marker-reject.md`,
`spec-sync-external-interaction-api-gaps.md`, `spec-update-masked-reject-framing.md`)을
직접 `Read`/`git diff`로 대조했다. `review/code/**`·`review/consistency/**` 산출물(파일
13~72)은 이전 리뷰·consistency 라운드의 처분 기록이라 문서화 관점의 1차 대상이 아니므로
교차 확인용으로만 참고했다.

## 발견사항

발견된 CRITICAL/WARNING 없음.

이 PR 은 SDD 관행에 충실하다 — 새 판정 함수(`resolveTriggerParametersRejectingMasked`,
`findMaskedResubmissions`)는 "왜 필요한가 / 범위 / 왜 이 순서인가 / 왜 호출부가 아니라
함수가 순서를 소유하는가"를 각각 절로 나눠 JSDoc 에 담았고, 그 근거가 실제 코드 동작과
직접 대조해 정확했다(`reject-masked-resubmission.ts` 를 직접 읽어 raw→resolve 2단계 순서,
`throwIfAny` 의 phase 분리, `findMaskedResubmissions` 의 raw-키-기준 필터링이 docstring
서술과 일치함을 확인). 신규 field code(`MASKED_VALUE_RESUBMITTED`)는 `coerce_failed` 재사용을
기각한 이유까지 코드 주석(`trigger-parameter.types.ts` `REASON_TO_DETAIL.masked_value_resubmitted`)
에 남겼다. spec 7곳은 표 행·Rationale·범위 캐비엇이 서로 어긋나지 않게 갱신됐고(§R17 마스킹
카탈로그 새 행, `1-manual-trigger.md` §6 reason 표 + Rationale 절, `13-replay-rerun.md` §8.1/§10.2,
`3-error-handling.md` §1.3/§1.7, `12-webhook.md` §5.2, `1-data-model.md`/`3-execution.md` 의
1층→2층 서술 갱신), CHANGELOG 도 범위·검사시점·선존버그 수정까지 근거를 담아 갱신됐다.

아래는 이번 diff 가 새로 만든 결함이 아니라 **참고용 INFO** 두 건이다 — 조치를 요구하지
않는다.

- **[INFO]** `workflows.controller.ts` 의 새 한국어 인라인 주석이 바로 아래 기존 영어
  인라인 주석과 같은 `try/catch` 블록에 공존한다
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts:314-317`(신규,
    한국어) 바로 아래 `:320-322`(기존, 영어 — `` // `details` so GlobalExceptionFilter
    surfaces the per-field breakdown ``)
  - 상세: 이 diff 가 만든 문제가 아니고(영어 줄은 미변경 컨텍스트), 동일 사안이 직전 라운드
    (`review/code/2026/08/21/00_03_57/maintainability.md`)에서 이미 INFO 로 확인돼 조치
    불요로 처분됐다. 재확인 결과 상태 동일 — 새 지적 아님, 추적용으로만 남긴다.
  - 제안: 없음(이미 기록된 사안).

- **[INFO]** spec §6 reason 표가 `masked_value_resubmitted` 의 검사 지점을 "adapter
  `resolveTriggerParameters` 전후 2단계"로만 서술하고, 실제로 그 2단계를 캡슐화하는 함수명
  (`resolveTriggerParametersRejectingMasked`)은 spec 어디에도 등장하지 않는다
  - 위치: `spec/4-nodes/7-trigger/1-manual-trigger.md` §6 reason 표(`masked_value_resubmitted`
    행) — grep 확인 결과 이 함수명은 CHANGELOG·코드·plan/review 문서에만 등장하고 `spec/`
    전체에는 없음
  - 상세: 다만 같은 표의 다른 세 reason 행(`missing_required`/`coerce_failed`)도 소스 열을
    구체 함수가 아니라 "adapter `resolveTriggerParameters`"라는 개념 단계로만 적어 왔으므로,
    이번 행도 기존 스타일을 그대로 따른 것이다 — 이번 PR 이 만든 불일치가 아니라 기존 관행의
    연장이다.
  - 제안: 조치 불요. 다음에 §6 표를 손댈 기회가 있으면 소스 열에 실제 wrapper 함수명을 병기하는
    것을 고려할 수 있으나 이번 PR 스코프는 아니다.

확인했으나 문제없음으로 판단한 항목(README/API 문서/설정 문서 관점):

- **README**: 이 변경은 신규 환경변수·신규 설정 옵션·신규 사용자 대면 기능을 추가하지
  않는다(서버측 검증 규칙 추가) — README 갱신 대상 아님.
- **Swagger/OpenAPI**: `codebase/backend/src/common/swagger/error-response.dto.ts` 를 직접
  확인 — `details[].code` 는 `additionalProperties: true` 인 generic object 로 정의돼 있어
  특정 code 열거를 하드코딩하지 않는다. plan 문서(`spec-draft-inputoverride-marker-reject.md`)
  도 착수 시 이 DTO 를 grep 해 실측하겠다고 명시했고, 실측 결과와 실제 diff(Swagger 파일
  미변경)가 일치한다 — 갱신 누락이 아니다.
- **에러 코드 카탈로그 완결성**: `spec/5-system/3-error-handling.md` §1.3 에 `INVALID_INPUT`
  행이 추가돼 §1 공용 카탈로그와 `13-replay-rerun.md` §8.1 간 중복/누락 없이 정합함을
  직접 확인(`grep INVALID_INPUT` 결과 1곳만 존재).
- **CHANGELOG**: 같은 파일에 이미 있던 두 개의 다른 "## Unreleased" 항목(`Execution.inputData`
  카브아웃 닫기, `token` 마스킹)과 내용이 겹치거나 모순되지 않음을 직접 대조.

## 요약

이번 변경은 문서화 관점에서 결함이 없다. 공개 함수(`resolveTriggerParametersRejectingMasked`,
`findMaskedResubmissions`, `toTriggerParameterErrorDetails`)마다 "왜/범위/시점/대안 기각 이유"를
갖춘 JSDoc 이 있고, 그 서술이 실제 구현(raw 우선 검사 → resolve → 재검사, phase 분리, raw-키
기준 필터)과 정확히 일치함을 소스를 직접 읽어 확인했다. spec 7곳·CHANGELOG·plan 3건이 서로
grep 가능한 범위에서 어긋남 없이 동기화됐고, 신규 에러 코드(`MASKED_VALUE_RESUBMITTED`)는
공용 카탈로그(§1.3/§1.7)·webhook 문서·manual-trigger 문서·replay-rerun 문서 네 곳 모두에
일관되게 반영됐다. 테스트 파일(`reject-masked-resubmission.spec.ts`, 두 호출부 spec)도 각
캐너리/경계 테스트에 "무엇을 왜 고정하는지"를 설명하는 doc comment 를 달아 가독성이 높다.
남은 두 INFO 는 조치가 필요 없는 참고 사항(이미 처분된 스타일 이슈, 기존 spec 표 관행의
연장)이다.

## 위험도

NONE
