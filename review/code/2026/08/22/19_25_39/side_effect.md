# 부작용(Side Effect) 리뷰

## 검토 범위 확인

`git diff --stat` 로 실제 코드 변경 파일을 재확인한 결과 아래 4개 파일만 변경됐고, 각 diff 는 프롬프트에
제시된 것과 정확히 일치한다(추가 은닉 변경 없음):

- `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` (+9)
- `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts` (+16)
- `codebase/backend/src/modules/executions/dto/re-run.dto.ts` (+6/-1)
- `codebase/backend/src/modules/workflows/workflows.controller.ts` (+3/-3)

나머지(`plan/**`, `review/consistency/**`, `spec/4-nodes/7-trigger/1-manual-trigger.md`)는 문서/plan/리뷰
산출물이며 런타임 코드 경로가 아니다.

## 발견사항

- **[INFO]** `@ApiPropertyOptional` description 문자열 변경 — OpenAPI 산출물에 실제로 반영됨
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts:20` (`inputOverride` 필드의
    `@ApiPropertyOptional({ description: … })`)
  - 상세: `description` 문자열이 바뀌면 `@nestjs/swagger` 가 생성하는 OpenAPI JSON(그리고 그걸 소비하는
    Swagger UI·SDK codegen 등 외부 공개 표면)의 해당 필드 설명도 함께 바뀐다. 즉 이 변경은 "주석"이
    아니라 **공개 API 문서 산출물의 값 변경**이다 — plan 문서(`masked-marker-cosmetic-followups.md`)의
    검증 기준도 이를 정확히 인지하고 "OpenAPI 출력은 바뀌므로 주석 전용은 아니다" 로 명시해 뒀다.
    다만 `@IsOptional()` / `@IsObject()` 등 검증 데코레이터·타입(`type: Object`)은 그대로이므로 런타임
    검증 로직·요청/응답 스키마 shape 자체는 불변이다 — 노출되는 **설명 텍스트만** 바뀐다.
  - 제안: 의도된 변경이므로 조치 불요. OpenAPI 스냅샷을 별도로 diff 검증하는 CI 단계가 있다면 그 스냅샷도
    함께 갱신됐는지만 확인.

- **[INFO]** 나머지 3개 코드 파일은 순수 JSDoc/inline 주석 추가·언어 통일 — 실행 경로 무영향
  - 위치: `trigger-parameter.types.ts` (REASON_TO_DETAIL 각 항목 위 JSDoc 3건 추가),
    `resolve-trigger-parameters.ts` (`resolveTriggerParameters` 함수 JSDoc 블록에 wrapper 역참조 단락
    추가), `workflows.controller.ts:320-322` (영문 인라인 주석 → 한국어로 치환, 같은 catch 블록)
  - 상세: 세 파일 모두 diff 가 주석/문서 블록에만 걸려 있고, 실행 가능한 문(statement)·표현식·시그니처·
    분기·throw 조건은 단 한 줄도 바뀌지 않았다. 함수 시그니처(`resolveTriggerParameters(schema,
    rawSource)`, `toTriggerParameterErrorDetails(errors)` 등)·`REASON_TO_DETAIL` 맵의 키/값·
    `TriggerParameterErrorDetail`/`TriggerParameterValidationError` 유니온·예외 클래스 동작 전부 diff
    이전과 바이트 단위로 동일. 전역 상태·환경변수·파일시스템·네트워크·이벤트/콜백 관련 코드도 diff 범위
    밖. `workflows.controller.ts` 의 주석 교체도 코드 라인(`throw new BadRequestException(...)`)은 문맥
    그대로 유지되고 그 위 주석 3줄만 언어가 바뀌었다.
  - 제안: 조치 불요.

- **[INFO]** `plan/**` · `review/consistency/**` 신규 파일 — 애플리케이션 부작용 표면 아님
  - 위치: `plan/in-progress/masked-marker-cosmetic-followups.md`(신규),
    `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(체크박스 갱신),
    `review/consistency/2026/08/22/19_03_59/**`(신규 5파일: SUMMARY.md, _retry_state.json,
    convention_compliance.md, cross_spec.md, meta.json, naming_collision.md, plan_coherence.md,
    rationale_continuity.md), `spec/4-nodes/7-trigger/1-manual-trigger.md`(frontmatter `code:` 목록에
    `executions.service.ts` 1행 추가)
  - 상세: 전부 리포지토리 문서/추적 산출물이며 애플리케이션 런타임에 로드·실행되지 않는다. 새 전역 변수·
    환경변수 읽기/쓰기·네트워크 호출을 도입하지 않는다. `_retry_state.json` 은 이번 diff 이전에 이미 완료된
    consistency-check 세션(19:03:59)의 산출 상태 파일로, 이번 코드 변경이 만든 새 부작용이 아니라 그
    선행 툴 호출의 기록물이다.
  - 제안: 조치 불요.

## 요약

이번 diff 는 4개 backend TypeScript 파일 중 3개는 JSDoc/inline 주석만, 1개(`re-run.dto.ts`)는
`@ApiPropertyOptional` 의 `description` 문자열만 바꾼다 — 실행 가능한 코드 라인·함수 시그니처·타입·분기·
throw 조건·전역 상태·환경변수·파일시스템 접근·네트워크 호출·이벤트/콜백 배선은 diff 이전과 완전히
동일하다. 유일하게 "산출물이 실제로 바뀌는" 지점은 `re-run.dto.ts` 의 Swagger description — 이는 OpenAPI
문서 텍스트에는 반영되지만 검증 데코레이터·타입은 불변이라 API 계약(요청/응답 shape·검증 규칙)에는 영향이
없다. 나머지 plan/review 산출물은 리포지토리 문서이며 런타임 부작용 표면이 아니다. 부작용 관점에서 우려할
소견 없음.

## 위험도
NONE
