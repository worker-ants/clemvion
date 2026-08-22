# 부작용(Side Effect) 리뷰

## 검증 방법

diff 는 4개 backend 코드 파일(JSDoc/주석/Swagger `description` 만 변경) + plan/review/spec frontmatter
문서 다수(신규 파일 생성)로 구성된다. 프롬프트에 전체 컨텍스트가 잘린 파일은 `Read` 로 직접 열어
대조했다:

- `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts` (전문)
- `codebase/backend/src/modules/workflows/workflows.controller.ts` (`execute()` 핸들러 주변 `:280-335`)
- `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts` (`importsBaseFn` AST 로직)
- 관련 테스트(`executions-rerun.service.spec.ts` 등)에 `inputOverride` description 문자열을
  단언하는 곳이 있는지 grep

## 발견사항

- **[INFO]** `re-run.dto.ts` 의 `@ApiPropertyOptional({ description })` 변경은 실행되는 코드가 아니라
  **OpenAPI 산출물(swagger.json/UI)** 의 값이다 — 이 필드를 `SwaggerModule` 이 리플렉션해 문서로
  노출하므로, "주석 전용"과 달리 **공개 산출물이 실제로 바뀌는** 유일한 변경이다.
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts:20-24`
  - 상세: `@IsOptional()`/`@IsObject()` 데코레이터·필드 타입·검증 로직은 불변이므로 API **계약**
    (요청/응답 스키마)은 그대로다. 바뀌는 것은 사람이 읽는 설명 문자열뿐이다. 저장소 안에서
    `inputOverride` description 문자열을 단언하는 테스트나 OpenAPI 스냅샷 테스트는 없음을
    확인했다(`grep -rn "inputOverride" src/**/*.spec.ts` → 전부 값 동작 테스트, description 비교 없음;
    `SwaggerModule`/`openapi.json` 스냅샷 테스트도 이 DTO 와 무관한 파일 2개뿐). 따라서 이 변경이
    CI 를 깨뜨릴 부작용은 없다.
  - 제안: 조치 불요. OpenAPI 스냅샷 검증을 추가한다면 그 시점에 함께 갱신.

- **[INFO]** `resolve-trigger-parameters.ts` 의 base 함수 JSDoc 에 처음으로 wrapper 함수명
  (`resolveTriggerParametersRejectingMasked`)이 등장하지만, `masked-reject-callers-guard.ts` 의
  `importsBaseFn` 은 `ts.createSourceFile` 로 파싱한 뒤 `ts.isIdentifier`/`ElementAccessExpression`
  노드만 순회한다 — JSDoc 은 트리비아(comment)로 취급되어 `ts.forEachChild` 순회 대상 AST 노드가
  아니므로 이 코멘트가 가드를 오탐시키지 않음을 소스 레벨에서 직접 확인했다(`masked-reject-callers-guard.ts:110-141`).
  이 함수 자신도 `resolveTriggerParametersRejectingMasked` 를 실제로 **import 하지 않는다**
  (`{@link}` 태그만 사용) — import 표면도 늘지 않았다.
  - 위치: `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts:108-123`
  - 상세: plan(`masked-marker-cosmetic-followups.md`)이 스스로 이 리스크를 뮤테이션(2종)으로
    검증했다고 기록했고, 소스 대조로도 동일 결론에 도달했다 — 별도 회귀는 없음.
  - 제안: 조치 불요.

- **[INFO]** `resolve-trigger-parameters.ts`/`workflows.controller.ts` 함수 시그니처·분기·반환값
  전수 대조 결과 무변경.
  - 위치: `resolveTriggerParameters(schema, rawSource): Record<string, unknown>`
    (`resolve-trigger-parameters.ts:124-127`), `execute()` 핸들러의 `try/catch` 블록
    (`workflows.controller.ts` — `resolveTriggerParametersRejectingMasked` 호출·
    `BadRequestException({ code, message, details })` throw 형태 동일)
  - 상세: diff 는 함수 선언 위 JSDoc 블록과 `catch` 절 내부 인라인 주석만 바꿨다. 파라미터
    개수·타입·기본값, 예외 클래스, throw 되는 페이로드 형태(`code`/`message`/`details`) 모두 byte
    단위로 동일 — 호출자(webhook/schedule 어댑터, `re-run` 경로) 영향 없음.
  - 제안: 없음.

- **[INFO]** `trigger-parameter.types.ts` 의 `REASON_TO_DETAIL` 객체 리터럴 — 4개 키의 `code`/`message`
  값과 `toTriggerParameterErrorDetails()` 로직은 diff 전후 동일(JSDoc 만 추가). 공개 에러 코드
  (`MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`/`INVALID_SCHEMA`/`MASKED_VALUE_RESUBMITTED`)
  집합·문자열 값 불변이므로 클라이언트가 소비하는 `error.details[].code` 계약 무변화.
  - 위치: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts:40-71`
  - 제안: 없음.

- **[INFO]** 전역 상태·환경 변수·네트워크 호출·이벤트/콜백 관련 변경 0건 — 4개 코드 파일 모두
  순수 함수/DTO/컨트롤러의 주석·문서 문자열만 바뀌었고, 새 side-effecting API 호출(파일 I/O,
  `process.env`, HTTP fetch, EventEmitter 등)은 도입되지 않았다.
  - 위치: 파일 1~4 전체
  - 제안: 없음.

- **[INFO]** `plan/`·`review/` 하위 다수 신규 파일 생성(파일 5~26)은 예상치 못한 파일시스템
  부작용이 아니라 이 저장소의 표준 워크플로 산출물(consistency-check/ai-review/plan lifecycle)이다.
  실행 코드와 분리된 문서 트리이며 런타임 동작에 영향 없음.
  - 위치: `plan/complete/masked-marker-cosmetic-followups.md`,
    `plan/in-progress/spec-sync-external-interaction-api-gaps.md`,
    `review/code/2026/08/22/19_25_39/**`, `review/consistency/2026/08/22/19_03_59/**`
  - 제안: 조치 불요.

- **[INFO]** `spec/4-nodes/7-trigger/1-manual-trigger.md` frontmatter `code:` 리스트에
  `executions.service.ts` 1줄 추가 — 이 파일의 실행 동작을 바꾸지 않는 메타데이터(spec-code-paths
  가드가 참조하는 SoT 목록)일 뿐이다.
  - 위치: `spec/4-nodes/7-trigger/1-manual-trigger.md:10`
  - 제안: 없음.

## 요약

4개 backend 코드 파일 모두 JSDoc·인라인 주석·Swagger `description` 문자열만 바뀌었고 실행 로직·
함수 시그니처·전역 상태·환경 변수·네트워크 호출·이벤트/콜백은 diff 전후 동일함을 소스 직접 대조로
확인했다. 유일하게 "실제로 값이 바뀌는" 산출물은 `re-run.dto.ts` 의 OpenAPI `description` 문자열이나,
API 계약(타입·검증 데코레이터)은 불변이고 이를 단언하는 스냅샷 테스트도 저장소에 없어 회귀 위험이
없다. base 함수 JSDoc 에 wrapper 함수명이 처음 등장하는 것도 CI 가드(`masked-reject-callers-guard.ts`)가
AST 식별자 기반이라 코멘트 트리비아는 애초에 판정 대상이 아님을 가드 소스에서 직접 확인했다. 남은
변경(plan/review 신규 파일, spec frontmatter 1줄)은 표준 워크플로 산출물이며 런타임 부작용이 없다.

## 위험도
NONE
