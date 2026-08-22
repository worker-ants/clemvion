# 부작용(Side Effect) 리뷰

## 검토 범위 확인

`git diff origin/main..HEAD` 로 실제 코드 diff 를 직접 재확인했다(프롬프트에 실린 unified diff 와
바이트 단위로 일치). 변경된 코드 파일은 4개뿐이다:

- `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts` — `REASON_TO_DETAIL` 3개 항목 위에 JSDoc 3건 추가
- `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts` — `resolveTriggerParameters` 함수 docblock 확장(영→한 절 추가, wrapper 역참조 포함)
- `codebase/backend/src/modules/executions/dto/re-run.dto.ts` — `inputOverride` 의 `@ApiPropertyOptional({ description })` 문자열 치환
- `codebase/backend/src/modules/workflows/workflows.controller.ts` — catch 블록 인라인 주석 3줄 영→한 치환

네 파일 모두 실행 가능한 문(statement)·표현식·조건·throw 대상·함수 시그니처는 diff 이전과 완전히
동일함을 직접 확인했다. 나머지(`plan/**`, `review/**`, `spec/4-nodes/7-trigger/1-manual-trigger.md`
frontmatter `code:` 1행 추가)는 리포지토리 문서/추적 산출물이며 런타임에 로드·실행되지 않는다.

## 발견사항

- **[INFO]** `re-run.dto.ts` 의 `@ApiPropertyOptional` `description` 문자열 변경 — OpenAPI 산출물에 실제로 반영됨
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts` (`inputOverride` 필드의 `@ApiPropertyOptional`)
  - 상세: `description` 텍스트가 바뀌면 `@nestjs/swagger` 가 생성하는 OpenAPI 문서(및 그걸 소비하는 Swagger UI·SDK codegen)의 해당 필드 설명도 함께 바뀐다 — 순수 "주석"이 아니라 공개 문서 산출물 값 변경이다. 다만 `@IsOptional()`/`@IsObject()`/`type: Object` 등 검증 데코레이터·타입은 불변이므로 런타임 요청 검증 로직·응답 스키마 shape 자체(계약)는 바뀌지 않는다 — 설명 텍스트만 바뀐다. plan(`plan/complete/masked-marker-cosmetic-followups.md`)도 이 점을 "OpenAPI 출력은 바뀌므로 주석 전용은 아니다"로 명시적으로 인지하고 있다.
  - 제안: 의도된 변경이므로 조치 불요. 저장소에 OpenAPI JSON 스냅샷 테스트가 있는지 확인했으나 발견되지 않았다(`find … -iname "*openapi*.json"` 결과 없음) — 별도 스냅샷 갱신 누락 리스크는 없다.

- **[INFO]** `resolve-trigger-parameters.ts` docblock 이 처음으로 wrapper 함수명(`resolveTriggerParametersRejectingMasked`)을 언급 — CI 가드 오탐 여부를 직접 코드로 검증함
  - 위치: `codebase/backend/src/modules/execution-engine/utils/resolve-trigger-parameters.ts` (`resolveTriggerParameters` 함수 docblock), 가드 로직 `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts` 의 `importsBaseFn`
  - 상세: 가드는 값싼 substring 사전 필터(`source.includes(BASE_FN)`, 과대포함만 허용) 뒤에 `ts.createSourceFile` 로 AST 를 만들어 `ts.isIdentifier` 노드와 element-access 문자열 인자만 검사한다(`masked-reject-callers-guard.ts:110-141`). JSDoc/주석은 TS AST 의 `forEachChild` 순회 대상에 포함되지 않는 trivia 이므로, 이번에 docblock 에 추가된 산문 텍스트("wrapper 를 부른다", `{@link resolveTriggerParametersRejectingMasked}`)는 식별자 노드로 잡히지 않는다 — 가드 판정에 영향 없음을 직접 소스를 읽어 확인했다. 이 파일 자체는 이미 `ALLOWED_DIRECT_CALLERS` 목록에 "base 모듈 자신"으로 등재돼 있어(가드 파일 32행), 함수 선언부 식별자로 인한 오탐도 사전에 배제돼 있다.
  - 제안: 조치 불요 — 가드가 무뎌지지 않았음을 정적 분석으로 재확인했다.

- **[INFO]** `trigger-parameter.types.ts` / `workflows.controller.ts` 변경은 순수 주석·JSDoc — 실행 경로 무영향
  - 위치: `trigger-parameter.types.ts` (`REASON_TO_DETAIL` 객체 리터럴 3개 항목 위 JSDoc), `workflows.controller.ts` (`execute()` catch 블록 인라인 주석 3줄)
  - 상세: `REASON_TO_DETAIL` 맵의 키/값·`toTriggerParameterErrorDetails` 함수 동작·`throw new BadRequestException({...})` 호출부는 diff 전후 바이트 단위로 동일하다. 전역 상태·환경변수·파일시스템·네트워크·이벤트/콜백 배선을 건드리는 코드는 diff 범위 밖이다.
  - 제안: 조치 불요.

- **[INFO]** `plan/**` · `review/**` · spec frontmatter 신규/변경 파일 — 애플리케이션 부작용 표면 아님
  - 위치: `plan/complete/masked-marker-cosmetic-followups.md`(신규), `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(체크박스 갱신), `review/code/2026/08/22/{19_25_39,19_36_12}/**`·`review/consistency/2026/08/22/{19_03_59,19_48_18}/**`(신규 리뷰/consistency 산출물), `spec/4-nodes/7-trigger/1-manual-trigger.md`(frontmatter `code:` 리스트에 `executions.service.ts` 1행 추가)
  - 상세: 전부 리포지토리 문서/추적/리뷰 산출물이며 런타임에 로드·실행되지 않는다. 새 전역 변수·환경변수 읽기/쓰기·네트워크 호출을 도입하지 않는다. spec frontmatter 1행 추가는 `/consistency-check --impl-prep`(`19_03_59`) WARNING 반영으로 plan 에 근거가 명시돼 있다.
  - 제안: 조치 불요.

## 요약

이번 diff 는 4개 backend TypeScript 파일 중 3개는 JSDoc/인라인 주석만, 1개(`re-run.dto.ts`)는
`@ApiPropertyOptional` 의 `description` 문자열만 바꾼다. 실행 가능한 코드 라인·함수 시그니처·타입·
분기·throw 조건·전역 상태·환경변수·파일시스템 접근·네트워크 호출·이벤트/콜백 배선은 diff 이전과
완전히 동일함을 `git diff origin/main..HEAD` 실측으로 확인했다. 유일하게 "산출물이 실제로 바뀌는"
지점은 `re-run.dto.ts` 의 Swagger description(OpenAPI 문서 텍스트에는 반영되지만 검증
데코레이터·타입은 불변이라 API 계약에는 영향 없음)이다. 이번 diff 가 처음으로 base 함수 JSDoc 에
wrapper 함수명을 언급해 CI 가드(`masked-reject-callers-guard.ts`)가 오탐할 가능성을 직접 그 가드의
AST 판정 로직을 읽어 검증했으며, 주석/JSDoc 텍스트는 TS AST 의 식별자 노드로 취급되지 않아 가드가
무뎌지지 않음을 확인했다. 부작용 관점에서 우려할 소견 없음.

## 위험도
NONE
