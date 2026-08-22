# 신규 식별자 충돌 검토 — masked-marker-cosmetic-followups

## 검토 범위 확인

target 은 `spec/4-nodes/7-trigger/` scope 로 조립됐으나, 실제 착수 대상은
`plan/in-progress/masked-marker-cosmetic-followups.md` (spec_impact: `none`) 에 적힌
**코스메틱 4건**이다. 워크트리의 실제 diff(`git diff` — 4개 코드 파일 + 1개 plan 파일)를
직접 대조한 결과, 4건 모두 **기존 코드에 주석/JSDoc/Swagger description 문자열을
추가하거나 언어를 통일하는 작업**이며 실행 로직 변경은 0줄이다. 구체적으로:

1. `codebase/backend/src/modules/executions/dto/re-run.dto.ts` — `ReRunRequestDto.inputOverride`
   의 `@ApiPropertyOptional({ description })` 문자열 확장 (마커 예약어·거부 코드·부분일치 경계).
2. `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts` —
   `resolveTriggerParameters` 함수 JSDoc 블록에 wrapper 역참조 문단 추가.
3. `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` —
   `REASON_TO_DETAIL` 의 `missing_required`/`coerce_failed`/`invalid_schema` 세 항목에
   JSDoc 주석 신설.
4. `codebase/backend/src/modules/workflows/workflows.controller.ts` — 인라인 주석을
   영어→한국어로 교체(정보 내용은 보존).
5. `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — 위 4건에 대응하는
   체크박스 4개를 `[ ]` → `[x]` 로 갱신 + 근거 문단 추가 (트래커 자기 갱신, 신규 식별자 아님).

## 발견사항

이번 diff 가 **새로 부여/도입하는 요구사항 ID · 엔티티/타입명 · API endpoint · 이벤트명 ·
ENV var/config key · spec 파일 경로**는 없다. 추가된 텍스트가 참조하는 모든 식별자는
검색으로 실재를 확인했다(허구·오탈자 없음):

| 참조된 식별자 | 실재 확인 |
|---|---|
| `resolveTriggerParametersRejectingMasked` | `reject-masked-resubmission.ts:56` export 존재 |
| `repo-guards/__tests__/masked-reject-callers-guard.ts` | 파일 존재 확인 |
| `hasMaskedLeaf` / `MAX_REDACT_DEPTH` | 같은 파일에 정의·사용 확인 |
| `MASKED_VALUE_RESUBMITTED` | `trigger-parameter.types.ts`, 여러 `*.spec.ts`, `spec/1-data-model.md` 등 8개 파일에 이미 등재된 기존 코드 — 신규 아님 |
| `spec/5-system/14-external-interaction-api.md` §R17 | 해당 섹션(1395행 시작)이 실제로 "egress-only 마스킹" 논의의 일부로 `MASKED_VALUE_RESUBMITTED` 서버측 거부(1576~1617행, 2026-08-20 갱신)를 이미 포함하고 있음을 원문으로 확인 — JSDoc 의 "SoT = §R17" 인용은 **기존 R17 항목의 연장**이지 새 섹션 신설이 아니다. (처음엔 "R17" 이 §R17=`getStatus` currentNode 노출' 과 무관한 주제를 가리키는 것처럼 보여 재검토했으나, 원문 대조 결과 같은 R17 rationale 항목 안에 두 주제가 동거하며 이는 이 PR 이전부터 존재하던 구조였다.) |
| `spec/4-nodes/7-trigger/1-manual-trigger.md` §6 | 기존 §6 표/문단이 이미 동일 reason 체계(`masked_value_resubmitted`)를 서술 — 신규 섹션 아님 |

새로 도입되는 이름·ID·엔드포인트·이벤트·ENV·파일 경로가 전무하므로, 본 checker 의
6개 관점(요구사항 ID / 엔티티·타입명 / API endpoint / 이벤트·메시지명 / 환경변수·설정키 /
파일 경로) 각각에 대해 검사할 신규 표면 자체가 존재하지 않는다.

발견된 CRITICAL/WARNING 없음.

- **[INFO]** 문서만 변경, 신규 식별자 표면 0
  - target 신규 식별자: 없음 (전량 기존 식별자 재참조)
  - 기존 사용처: 위 표 참조
  - 상세: `plan/in-progress/masked-marker-cosmetic-followups.md` 자체가 "실행 동작
    무변경"·"동일 정보량 유지, 언어만 교체"를 명시적 검증 기준으로 못박고 있고, 실제 diff 도
    이를 정확히 지킨다. `git diff --stat` 상 신규 파일 생성도 없다(수정 4 + plan 갱신 1).
  - 제안: 없음 — 후속 조치 불필요.

## 요약

이번 target 은 spec 변경이 아니라 이미 병합된 마커 재제출 거부 기능(#1188~#1193)의
문서적 잔여 항목 4건을 코드 주석/JSDoc/Swagger description 수준에서 보강하는
코스메틱 전용 작업이다. 새로 부여되는 요구사항 ID, 엔티티/DTO/인터페이스명, API
endpoint, 이벤트명, 환경변수, spec 파일 경로가 전혀 없으며, 추가된 모든 텍스트가
가리키는 식별자(`resolveTriggerParametersRejectingMasked`, `MASKED_VALUE_RESUBMITTED`,
`masked-reject-callers-guard.ts`, `EIA §R17`, `manual-trigger.md §6` 등)는 코드베이스와
spec 양쪽에 이미 실재하는 정의와 정확히 일치한다. 신규 식별자 충돌 관점에서 이 target 은
검토 표면 자체가 없는 안전한 변경이다.

## 위험도

NONE
