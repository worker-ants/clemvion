# 요구사항(Requirement) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부 (Manual 실행 경로)

## 검토 범위 및 방법

실질 애플리케이션 코드 8개 파일을 diff + `Read` 로 전체 컨텍스트까지 직접 열어 대조했다:
`trigger-parameter.types.ts`, `reject-masked-resubmission.ts`(신규)/`.spec.ts`(신규),
`executions.service.ts`, `workflows.controller.ts`, `sanitize-error-message.ts`/`.spec.ts`,
`resolve-trigger-parameters.spec.ts`, 그리고 신규 repo-guard 2쌍(`masked-reject-callers-*`,
`production-build-devdep-*`) + `tsconfig.build.json`. 관련 spec 본문 5개 문서
(`4-nodes/7-trigger/1-manual-trigger.md` §6, `5-system/3-error-handling.md` §1.7,
`5-system/12-webhook.md` §5.2, `5-system/14-external-interaction-api.md` §R17,
`1-data-model.md`)를 line-level 로 대조했다. 나머지 `review/**` 산출물(9라운드 리뷰 이력)은
이번 기능의 배경 기록이며, 그 라운드들이 이미 CRITICAL 1건(`00_03_57`, boolean 완전 우회) +
WARNING 다수를 잡아 전부 해소했음을 실코드로 재확인했다.

`GlobalExceptionFilter`(`details = resp.details ?? nested?.details`), `WorkflowsService`
의 `validateManualTrigger`(별개 검증 함수 `validateTriggerParameterSchema` — 구조 검증이지
값 재제출 판정이 아님)도 직접 열어 스코프 경계가 실제로 지켜지는지 확인했다.

## 발견사항

발견된 CRITICAL/WARNING 없음 — 아래는 확인 결과(검증된 정합) 기록이다.

- **[INFO]** 기능 완전성·비즈니스 로직·에러 시나리오 — 완전히 구현됨, 확인됨
  - 위치: `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts`
    `resolveTriggerParametersRejectingMasked`(23-75행), `findMaskedResubmissions`(115-130행)
  - 상세: 초판이 뚫렸던 세 갈래(①`boolean` 완전 우회 — `Boolean('***')→true`, ②`number` 는
    `coerce_failed` 가 안내를 선점, ③`defaultValue` 과잉 차단)를 raw-우선 검사(coerce 전)
    → resolve → resolve-후 재검사의 2단계 구조로 전부 닫았음을 `reject-masked-resubmission.spec.ts`
    의 캐너리 테스트(66-77행 boolean/number, 122-129행 defaultValue)로 직접 재확인했다.
    대상 키 집합은 항상 `rawSource` 의 `hasOwnProperty` 기준이라 사용자가 손대지 않은
    필드(defaultValue 채움)는 두 단계 모두에서 제외된다. 정확 일치 판정(`isMaskedMarker`)과
    깊이 상한(`MAX_REDACT_DEPTH`=10, 값 검사가 깊이 검사보다 선행해 off-by-one 을 피함)은
    egress 마스킹 판정기와 **같은 함수/상수를 공유**하도록 export 승격됐고(`sanitize-error-message.ts:150,164`),
    실제 마스커 산출물을 그대로 먹이는 왕복 통합 테스트(`reject-masked-resubmission.spec.ts:239-262`)
    로 모델-실물 괴리 위험까지 닫았다.
  - 검증: 조치 불요.

- **[INFO]** 두 Manual 진입점(re-run `inputOverride`, execute `parameterValues`/`input.parameters`)
  모두 배선 확인됨
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:499-503`,
    `codebase/backend/src/modules/workflows/workflows.controller.ts:314-317`
  - 상세: 두 호출부 모두 base `resolveTriggerParameters` 가 아니라
    `resolveTriggerParametersRejectingMasked` 를 쓰고, 각각 통합 테스트로 고정돼 있다
    (`workflows.controller.spec.ts:130-206` — 스칼라/중첩/legacy `input.parameters`/과잉차단
    아님 4종, `executions-rerun.service.spec.ts:377-432` — 거부 + `details[]` 회귀). 신규
    repo-guard(`masked-reject-callers-guard.ts`, AST 기반)가 향후 세 번째 Manual 경로가
    base 함수를 직접 import 하는 회귀를 fail-closed 로 잡도록 배선돼 있고, wrapper 접두
    겹침(`resolveTriggerParametersRejectingMasked`)까지 식별자 단위로 구분함을 확인했다.
    webhook(`hooks.service.ts`)·schedule(`schedule-runner.service.ts`)은 허용목록에 등재돼
    base 함수를 그대로 쓰며, 그 스코프 경계(저작 주체 기준)가 §R17 본문·`reject-masked-resubmission.ts`
    docstring·가드 허용목록 세 곳에서 문구가 일치한다.
  - 검증: 조치 불요.

- **[INFO]** 응답 봉투 선존 버그(`errors`→`details`) 교정 확인됨
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:512`,
    비교 대상 `codebase/backend/src/common/filters/http-exception.filter.ts` (`details = resp.details ?? nested?.details` — `errors` 키는 어디서도 읽지 않음)
  - 상세: 이번 diff 이전 re-run 경로는 `errors: err.errors` 로 던져 필드별 내역이 조용히
    버려졌다(필터가 `details` 만 읽으므로). 이 fix 를 얹지 않으면 `MASKED_VALUE_RESUBMITTED`
    를 추가해도 사용자는 400 만 보고 "가려진 값을 다시 입력하라"를 못 받아 이번 기능의
    실질 효과가 없었을 것이다 — 직접 결합된 필수 수정이며 스코프 이탈이 아니다. 회귀
    테스트(`executions-rerun.service.spec.ts:394-432`)로 고정 확인.
  - 검증: 조치 불요.

- **[INFO] (spec fidelity)** 관련 spec 본문 5곳 line-level 대조 — 전부 정합, SPEC-DRIFT 없음
  - 위치: `spec/4-nodes/7-trigger/1-manual-trigger.md:170,185-197`(검사 시점·응답 봉투·field
    code 4종),`spec/5-system/3-error-handling.md:189-193`,`spec/5-system/12-webhook.md:312-313`,
    `spec/5-system/14-external-interaction-api.md:1573-1606`(§R17 범위 캐비엇),
    `spec/1-data-model.md:471`
  - 상세: 이전 라운드(`00_39_27`)가 짚었던 두 가지 낡은 서술 — (1) 검사 시점을 "resolve
    **직후**"로 적어 boolean 우회를 재도입할 위험이 있던 문구, (2) `MASKED_VALUE_RESUBMITTED`
    를 "재제출 경로 한정"으로 좁게 적어 직접 입력 마커도 거부된다는 사실을 오독시키던
    문구 — 가 `plan/complete/spec-update-masked-reject-framing.md` 를 거쳐 4곳
    모두(§R17 표 행 포함) "전후 2단계" / "Manual 실행 경로 한정(저작 주체 기준)"으로
    실제로 교정돼 있음을 직접 확인했다. 필드 코드(`MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`/
    `INVALID_SCHEMA`/`MASKED_VALUE_RESUBMITTED`), reason 문자열, 마커 리터럴 3종
    (`***`/`[REDACTED]`/`[REDACTED_DEPTH]`)이 코드·spec·테스트 세 곳에서 문자 그대로 일치한다.
  - 검증: 조치 불요.

- **[INFO]** 엣지 케이스 — null/undefined/빈 스키마/빈 raw 처리 확인됨
  - 위치: `reject-masked-resubmission.ts:120-121`(`if (!schema || schema.length === 0) return [];`,
    `if (!isRecord(rawSource) || !isRecord(values)) return [];`)
  - 상세: 스키마 부재·빈 배열, raw 가 `null`/원시값인 경우 모두 pass-through 로 안전하게
    지나감을 테스트(`reject-masked-resubmission.spec.ts:142-149,313-316`)로 확인. `dto.inputOverride ?? {}` 로
    null/undefined re-run 입력도 방어됨.
  - 검증: 조치 불요.

- **[INFO] (반영된 이월)** `WorkflowsService.validateManualTrigger`(저장 경로)는 이번 기능의
  대상이 아님을 직접 확인
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:898-937`
  - 상세: 저장 경로가 쓰는 `validateTriggerParameterSchema` 는 파라미터 **스키마 정의**(구조)
    검증이지 제출된 **값**의 재검증이 아니다 — `masked_value_resubmitted` 판정 대상이 될
    입력 자체가 이 경로엔 없다. spec(`3-error-handling.md:189`)이 저장 경로도 같은
    `toTriggerParameterErrorDetails` 헬퍼를 쓴다고 서술한 것은 `INVALID_SCHEMA` reason
    공유를 가리키는 것이지 마커 거부 적용 범위 확장이 아니며, 코드와 모순되지 않는다.
  - 검증: 조치 불요 — 발견사항이 아니라 검증 결과.

## 요약

Manual 실행 경로(re-run `inputOverride`, execute `parameterValues`/`input.parameters`) 서버측
2층 마스킹 재제출 거부 기능은 의도한 요구사항을 완전히 구현하고 있다. 검사 시점을 raw-우선
→ resolve → resolve-후 재검사의 2단계로 설계해 boolean 완전 우회·number 오안내·defaultValue
과잉차단 세 갈래를 모두 닫았고, 대상 키 집합을 항상 raw 기준으로 고정해 사용자가 손대지 않은
필드를 잘못 차단하지 않는다. 두 Manual 진입점 모두 공유 wrapper(`resolveTriggerParametersRejectingMasked`)
로 배선됐고 신규 AST 기반 repo-guard 가 향후 회귀(세 번째 경로가 base 함수를 직접 쓰는 경우)를
fail-closed 로 막는다. webhook·schedule 은 페이로드 저작 주체가 다르다는 근거로 명시적으로
범위 밖에 두었고, 그 경계가 코드·spec·가드 허용목록 세 곳에서 문구까지 일치한다. 관련 spec
본문 5개 문서(manual-trigger §6, error-handling §1.7, webhook §5.2, external-interaction-api
§R17, data-model)는 이전 라운드가 지적한 "폐기된 검사 시점 서술"·"재제출 경로로 과소 서술된
범위" 두 가지 stale 문구가 실제로 교정돼 있어 SPEC-DRIFT 가 없다. 응답 봉투(`errors`→`details`)
선존 버그도 이번 기능이 의미를 가지려면 반드시 필요한 직접 결합 수정으로, 회귀 테스트로
고정됐다. 9라운드에 걸친 이전 리뷰 이력(CRITICAL 1건 → 0, WARNING 다수 → 0)을 실코드로
독립 재검증했고, 이번 라운드에서 신규로 발견된 요구사항 충족 관점의 CRITICAL/WARNING 은 없다.

## 위험도

NONE
