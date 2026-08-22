# Requirement Review — `20_05_07`

## 범위 확인

리뷰 대상 diff(`origin/main...HEAD`) 중 실행 코드는 4개 파일뿐이며 전부 JSDoc·인라인 주석·
Swagger `description` 문자열 추가/치환이다(실행 가능한 statement·조건식·시그니처·반환값
변경 0줄):

1. `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` — `REASON_TO_DETAIL` 4항목 중 3항목에 JSDoc 추가
2. `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts` — `resolveTriggerParameters` docblock에 wrapper 역참조 절 추가(전면 한국어)
3. `codebase/backend/src/modules/executions/dto/re-run.dto.ts` — `inputOverride` Swagger `description` 확장
4. `codebase/backend/src/modules/workflows/workflows.controller.ts` — catch 블록 인라인 주석 영→한 통일

나머지(plan 2건, `review/code/2026/08/22/{19_25_39,19_36_12}/**`, `review/consistency/2026/08/22/{19_03_59,19_48_18}/**`, spec frontmatter 1줄)는 이미 이 저장소에서 두 번의 `/ai-review` 라운드(각각 RESOLUTION.md 로 처분 완료)와 두 번의 `/consistency-check` 라운드를 거친 프로세스 산출물이다. 나는 그 두 라운드의 결론을 재사용하지 않고, 4개 코드 파일과 인용된 spec·가드·테스트를 전부 직접 열어 독립적으로 재검증했다.

## 독립 검증 결과 (spec fidelity, line-level)

- `trigger-parameter.types.ts` 의 `REASON_TO_DETAIL` JSDoc 4종(`missing_required`/`coerce_failed`/`invalid_schema`/기존 `masked_value_resubmitted`) — 각 설명이 실제 트리거 조건과 정확히 일치함을 소스로 확인:
  - `missing_required` ↔ `resolve-trigger-parameters.ts:139` (`def.required === true`)
  - `coerce_failed` ↔ `isCoerceFailure()` (`resolve-trigger-parameters.ts:16-34`) — number/object/array 판정 로직과 문구가 일치
  - `invalid_schema` ↔ `validateTriggerParameterSchema()` (`resolve-trigger-parameters.ts:61-98`, 이름 중복·정규식 위반·타입 enum 위반)
  - 4종 모두 `spec/4-nodes/7-trigger/1-manual-trigger.md §6` 표(164-172행)의 발생조건 열과 1:1 대응
- `resolve-trigger-parameters.ts` 의 base JSDoc — "Manual 두 경로는 wrapper 를 쓰고 base 를 직접 안 부른다"는 서술이 실제 호출 그래프와 일치(`workflows.controller.ts:317`, `executions.service.ts` 의 `resolveTriggerParametersRejectingMasked` 호출만 확인, base 직접 호출 없음). "base 에 넣지 않은 것은 의도" 문단은 `1-manual-trigger.md §6` 의 동일 문단(191-202행)과 거의 verbatim 하게 대응 — spec 을 정확히 미러링.
- `re-run.dto.ts` 의 Swagger description — 마커 리터럴 3종(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`)·"정확 일치만 거부, 부분 일치는 통과" 주장이 `codebase/packages/masked-markers/src/index.ts` 의 `isMaskedMarker()` 구현("정확 일치만 본다. 부분 포함(a***b)은 통과시킨다")과 정확히 일치. `400`+`MASKED_VALUE_RESUBMITTED` 코드도 `TriggerParameterErrorDetail.code` 유니온과 일치.
- `workflows.controller.ts` 의 "`errors` 가 아니라 `details` 다" 주석 — `GlobalExceptionFilter`(`common/filters/http-exception.filter.ts:73` `details = resp.details ?? nested?.details`)가 실제로 `details` 만 읽음을 확인, 주장과 구현 일치.
- CI 가드 참조(`repo-guards/__tests__/masked-reject-callers-guard.ts`) — `importsBaseFn()` 이 `ts.isIdentifier`/`ElementAccessExpression` AST 노드만 순회하고 JSDoc 트리비아는 대상이 아님을 직접 확인. base 파일의 JSDoc 에 `{@link resolveTriggerParametersRejectingMasked}` 가 새로 등장해도 오탐 없음(캐너리 `masked-reject-callers.spec.ts` 의 "wrapper 만 쓰는 소스를 base 사용으로 오인하지 않는다" 케이스로 커버).
- `spec/4-nodes/7-trigger/1-manual-trigger.md:10` frontmatter `code:` 에 `executions.service.ts` 추가 — 직전 consistency-check(`19_03_59`) WARNING(§6 이 인용하는 파일이 `code:` 목록에 없음)을 정확히 해소.

## 발견사항

- **[INFO]** `re-run.dto.ts` Swagger description 길이/형식 규약 위반이 이미 발생·이미 해소됨(라이브 이슈 아님, 참고 기록)
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts:20-24`
  - 상세: 리뷰 대상 브랜치의 커밋 히스토리(`git log`)를 보면, 이 필드의 description 은 한 차례 초안(마커 3종을 verbatim 나열, 304자/6문장)이 `spec/conventions/swagger.md §3`("보안·정책 캐비엇 예외" — "요약 1~2문장 + SoT 링크"만 허용)을 어겨 `/consistency-check --impl-done`(`19_48_18`) WARNING #1 로 지적됐고, 바로 다음 커밋(`4a1c8bc48`, "Swagger description 을 `swagger.md §3` 형식으로")에서 236자로 축약 + `SoT: EIA §R17 (spec/5-system/14-external-interaction-api.md)` 링크를 추가해 해소됐다. 내가 리뷰 중인 프롬프트의 unified diff·현재 워크트리 파일 내용 모두 이미 **수정 후** 상태다(HEAD 의 blob 해시 `0d1403f1c` = 프롬프트 diff 의 `+++ ` 대상 blob과 일치, 직접 확인). 즉 이 항목은 이미 닫힌 이슈이며, 재지적할 필요가 없다는 것을 재확인한 기록이다.
  - 제안: 조치 불요.
- **[INFO]** TODO/FIXME/HACK/XXX 계열 미완성 표식 없음 — 4개 코드 파일 diff 전체를 `grep -inE 'TODO|FIXME|HACK|XXX'` 로 확인, 매치 0건.
- **[INFO]** 모든 반환 경로·에러 경로 무변경 확인 — `resolveTriggerParameters`/`resolveTriggerParametersRejectingMasked`/`toTriggerParameterErrorDetails`/`workflows.controller.ts` `execute()` catch 블록의 조건 분기·throw 대상·반환 타입은 diff 전후 바이트 단위 동일(주석·JSDoc·description 문자열만 삽입). 함수 시그니처 변경 없음.
- **[INFO]** 4개 코드 파일 전체가 spec 본문(§6 표, §R17 wrapper 위임 서술, `isMaskedMarker` 정확일치 규칙)과 line-level 로 일치 — 위 "독립 검증 결과" 절 참조. 불일치·spec drift 발견 없음.

## 요약

리뷰 대상 4개 백엔드 코드 파일은 실행 로직·함수 시그니처·에러 코드·검증 규칙·반환값 변경이 전무한 순수 문서화(JSDoc/Swagger description/인라인 주석) 커밋이며, 새로 추가된 모든 서술을 실제 구현·CI 가드 로직·관련 spec 본문(`1-manual-trigger.md §6`, `14-external-interaction-api.md §R17`, `@workflow/masked-markers`)과 직접 대조해 line-level 로 일치함을 독립적으로 재확인했다. 유일하게 규약(swagger.md §3 길이/형식) 위반이 있었던 지점(`re-run.dto.ts` description)은 리뷰 대상 브랜치 안에서 이미 자체 소비된 consistency-check WARNING 반영 커밋(`4a1c8bc48`)으로 해소되어 있어 현재 diff 상태에는 잔존하지 않는다. TODO/FIXME 등 미완성 표식, 누락된 에러 시나리오, 반환값 누락, spec 과의 line-level 불일치는 발견되지 않았다.

## 위험도
NONE
