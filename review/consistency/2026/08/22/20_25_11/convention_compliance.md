# 정식 규약 준수 검토 — spec/4-nodes/7-trigger/ (impl-done)

## 검토 범위 요약

diff-base `origin/main` 대비 실제 변경분(4개 backend 파일 + spec frontmatter 1줄)을 확인:

- `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` — JSDoc 주석 추가만
- `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts` — 함수 JSDoc 한국어화·확장만
- `codebase/backend/src/modules/executions/dto/re-run.dto.ts` — `@ApiPropertyOptional.description` 문구 확장
- `codebase/backend/src/modules/workflows/workflows.controller.ts` — 인라인 주석 한국어화만
- `spec/4-nodes/7-trigger/1-manual-trigger.md` — frontmatter `code:` 목록에 `executions.service.ts` 1줄 추가

로직·엔드포인트·필드 shape·에러 코드 값 변경은 없음 (순수 comment/JSDoc/description 정정 — "cosmetic followups"). 따라서 정식 규약 위반 표면은 매우 좁다.

## 발견사항

- **[WARNING]** `ReRunRequestDto.inputOverride` description 길이가 swagger.md §3 가이드라인을 초과하며, 명시된 예외 조항의 문언 범위(응답 필드)와 정확히 일치하지 않음
  - target 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts` — `ReRunRequestDto.inputOverride` 의 `@ApiPropertyOptional({ description: ... })` (diff: 구 98자 → 신 129자)
  - 위반 규약: `spec/conventions/swagger.md` §3 "DTO `description`은 10~40자 내외" 및 동일 §3 "예외 — 보안·정책 캐비엇(2026-08-17 규약화)"
  - 상세: 신규 description —
    ```
    'useOriginalInput=false 일 때 사용할 입력(Manual Trigger 스키마 호환). ' +
    '마스킹 마커와 정확히 일치하는 값은 400 `MASKED_VALUE_RESUBMITTED` 로 거부. ' +
    'SoT: EIA §R17.'
    ```
    (129자, 가이드라인 10~40자의 3배 이상). swagger.md §3 의 예외 조항은 *"응답 값이 저장된 값과
    다를 수 있는 필드(egress 마스킹 대상 등)"* 로 한정되어 있고, 그 근거도 "소비자가 OpenAPI 만
    보고 통합할 때 DB 와 응답 값이 왜 다른지 알아야 한다"이다. 그러나 `inputOverride`는 **응답이
    아니라 요청** 필드이고, 설명하는 대상도 "응답이 저장값과 다르다"가 아니라 "특정 입력(마스킹
    마커)을 재제출하면 400 으로 거부된다"는 **입력 검증/거부 정책**이다 — 예외 조항이 문자 그대로
    커버하는 케이스가 아니다. 다만 형식(1~2문장 + SoT 링크로 요약)은 예외 조항이 권장하는 패턴과
    정확히 일치하므로, 의도는 그 예외의 취지를 선의로 확장 적용한 것으로 보인다.
  - 제안: 다음 중 하나 —
    1. `spec/conventions/swagger.md` §3 예외 문구를 "응답 값이 저장된 값과 다를 수 있는 필드"뿐
       아니라 "요청 필드의 보안 관련 검증/거부 정책 caveat"까지 명시적으로 포괄하도록 갱신
       (실질적으로 이미 이런 사례가 반복되는 것으로 보이므로 문구 정정이 합리적).
    2. 또는 description 을 더 짧게 유지하고("마스킹 마커 재제출 시 400 거부. SoT: EIA §R17." 등)
       상세 근거는 `manual-trigger.md §6`/`EIA §R17` spec 본문에만 둔다.
    실무 영향은 미미하여 CRITICAL 사안은 아님.

- **[INFO]** `0-common.md` 에 명시적 `## Rationale` 섹션 부재 (본 PR 변경 범위 밖 — 참고용)
  - target 위치: `spec/4-nodes/7-trigger/0-common.md` (이번 diff 로 수정되지 않은 파일)
  - 위반 규약: CLAUDE.md "Overview / 본문 / Rationale 3섹션 권장"
  - 상세: 이 문서는 도입 문단(Overview 성격)과 §1~§4 본문은 있으나 말미에 `## Rationale` 섹션이
    없다. "권장" 사항이며 이번 PR 의 diff 범위 밖(사전부터 이 상태)이라 이번 변경이 만든 문제는
    아니다. 참고로만 기록.
  - 제안: 조치 불요(이번 diff 범위 밖). 후속 spec 편집 시 선택적으로 보강.

검증 완료(위반 없음, 참고용):
- `error-codes.md` §4.2 (`missing_required`/`coerce_failed`/`invalid_schema`/`masked_value_resubmitted`
  → `MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`/`INVALID_SCHEMA`/`MASKED_VALUE_RESUBMITTED`) 매핑이
  신규 JSDoc 주석·`workflows.controller.ts` 주석과 정확히 일치.
- `node-output.md` §3.2 (`error.details[].code` 는 `UPPER_SNAKE_CASE`) 신규 주석이 그대로 준수.
- `spec-impl-evidence.md` §2 — `1-manual-trigger.md` frontmatter 에 추가된
  `codebase/backend/src/modules/executions/executions.service.ts` 경로 실존 확인 (`test -f` 통과).
- `EIA §R17` 앵커 (`spec/5-system/14-external-interaction-api.md` 1395행) 실존 확인 — 신규 주석·DTO
  description 의 "SoT: EIA §R17" 참조는 유효한 앵커이며 기존 `manual-trigger.md §6` 도 동일 인용 패턴
  사용 중 (신규 관행 아님).
- `swagger.md` §1 DTO JSDoc 패턴·§2 controller 패턴 — 이번 diff 는 신규 엔드포인트·신규 DTO 필드를
  추가하지 않으므로 해당 없음.

## 요약

이번 diff 는 4개 backend 파일의 주석·JSDoc·DTO description 문구만 정정·확장한 순수 cosmetic 변경이며,
API 표면·에러 코드 값·필드 shape·명명 규칙에 실질 변경이 없다. 신규 주석이 인용하는 에러 코드 매핑
(`error-codes.md` §4.2)·`UPPER_SNAKE_CASE` 표기(`node-output.md` §3.2)·`EIA §R17` 앵커는 모두 실제
정식 규약과 정확히 일치한다. 유일하게 지적할 사항은 `re-run.dto.ts` 의 `inputOverride` description 이
swagger.md §3 의 길이 가이드라인(10~40자)을 크게 초과하면서, 그 초과를 정당화하는 §3 명시 예외 조항의
문언 범위(응답 필드 한정)와 정확히 들어맞지는 않는다는 점이다 — 형식은 예외 조항의 권장 패턴을 그대로
따르고 있어 의도된 선의의 확장으로 보이므로 WARNING 수준으로 판단한다.

## 위험도

LOW
