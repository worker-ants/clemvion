# API 계약(API Contract) 리뷰

## 검토 범위 확인

리뷰 대상 4개 코드 파일(`trigger-parameter.types.ts`, `resolve-trigger-parameters.ts`,
`re-run.dto.ts`, `workflows.controller.ts`) 전부 실행 로직·시그니처·데코레이터 변경 없이
JSDoc·인라인 주석·Swagger `description` 문자열만 바뀌었다. 유일하게 OpenAPI 산출물에 실제
영향을 주는 변경은 `re-run.dto.ts` 의 `inputOverride` `@ApiPropertyOptional({ description })`
문자열 확장이다(타입 `Object`·`@IsOptional()`·`@IsObject()` 는 무변경). 나머지(plan/review 산출물)는
API 계약과 무관한 추적 문서다.

## 발견사항

- **[INFO]** `re-run.dto.ts` Swagger description 에 마스킹 마커 재제출 거부 규칙(400 +
  `details[].code = MASKED_VALUE_RESUBMITTED`, 부분 일치는 통과)이 신규로 명시됐다 — 하위 호환성
  영향 없음, 순수 개선.
  - 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts:18-25` (`inputOverride`
    필드, description 문자열 게이트 `19-23`)
  - 상세: 필드의 타입(`Object`)·validation 데코레이터(`@IsOptional()`/`@IsObject()`)는 그대로이고
    `description` 문자열만 확장됐다. OpenAPI 스펙에서 `description` 변경은 스키마 구조를 바꾸지
    않으므로 기존에 생성된 클라이언트 스텁·계약 테스트에 영향이 없다. 오히려 이전에는 전혀 문서화
    되지 않았던 400 에러 조건(마커 값 재제출 거부)과 그 판정 경계(부분 일치는 통과)를 API 소비자에게
    알려 문서-구현 정합성이 개선됐다. 실제 거부 로직(`resolveTriggerParametersRejectingMasked`,
    `hasMaskedLeaf`/`findMaskedResubmissions` 정확 일치 판정)은 이번 diff 이전부터 존재하던 동작이며
    이번 변경은 그 동작을 뒤늦게 문서에 반영한 것이다.
  - 제안: 조치 불요.

- **[INFO]** 동일한 마커 재제출 거부 규칙이 적용되는 형제 엔드포인트
  `POST /workflows/:id/execute` 는 OpenAPI 문서에 그 규칙이 전혀 드러나지 않아, 이번 diff 로
  두 엔드포인트 간 API 문서 비대칭이 더 뚜렷해졌다. 이미 트래커에 등재·스코프 아웃된 사항이라
  INFO 로 기록.
  - 위치: `codebase/backend/src/modules/workflows/workflows.controller.ts:270-280`
    (`execute()` 의 `@Body() body?: { input?; parameterValues?; }` — 인라인 타입, `@ApiBody`/DTO
    없음), `:254`(`@ApiBadRequestResponse({ description: '트리거 파라미터 검증 실패' })` 는
    마커 거부를 별도로 언급하지 않는 범용 문구), 대조: `re-run.dto.ts:18-25`
  - 상세: 컨트롤러 코드 상 `execute()` 는 `resolveTriggerParametersRejectingMasked(schema,
    rawValues)`(`:317`)를 호출해 `re-run` 경로(`ExecutionsService.reRun` → 동일 wrapper)와 **완전히
    같은 거부 규칙**을 적용한다. 그런데 `execute()` 의 요청 본문은 DTO 클래스가 아니라 인라인
    익명 타입이라 `@ApiProperty`/`description` 을 붙일 자리가 없고, `@ApiBadRequestResponse` 도
    일반적 문구뿐이라 `MASKED_VALUE_RESUBMITTED` 코드가 노출되지 않는다. 이 diff 가 `re-run` 쪽만
    상세화하면서 상대적으로 격차가 벌어졌지만, 이 비대칭 자체는 이번 PR 이 만든 신규 결함이
    아니라 이전부터 있던 상태이며(신규 유발 아님), plan(`masked-marker-cosmetic-followups.md`
    "W2")과 트래커(`spec-sync-external-interaction-api-gaps.md` 신규 항목, "지금 고치지 않는 이유:
    DTO 승격은 컨트롤러 시그니처 변경")에 이미 등재·귀속되어 있다. DTO 승격은 코스메틱이 아니라
    시그니처 변경이므로 이번 문서 전용 PR 범위 밖이라는 판단도 타당하다.
  - 제안: 조치 불요(이미 트래킹됨). `execute()` body 를 DTO 로 승격하거나 `@ApiBody` 를 추가하는
    후속 작업 시 `re-run.dto.ts` 의 description 을 그대로 이식할 것 — 이미 트래커에 그렇게 적혀
    있다.

- **[INFO]** 에러 응답 형식(`code`/`message`/`details[]`) 자체는 무변경, 필드별 상세 코드
  (`REASON_TO_DETAIL`)의 JSDoc 만 보강됨 — 계약 영향 없음.
  - 위치: `codebase/backend/src/modules/execution-engine/types/trigger-parameter.types.ts:40-71`
    (게이트 기준 `missing_required` 부근 `40`, `coerce_failed` 부근 `45-49`, `invalid_schema`
    부근 `53-57`)
  - 상세: `MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`/`INVALID_SCHEMA` 코드 값·구조는
    무변경이고, 각 코드가 "사용자가 취할 행동" 기준으로 일관되게 문서화됐다(에러 응답 스키마
    일관성 관점에서 긍정적). `workflows.controller.ts:323-327` 의 `BadRequestException({ code,
    message, details })` 봉투 구조도 무변경이며, 붙은 주석(게이트 `320-322`)이 `GlobalExceptionFilter`
    가 `details` 키만 읽는다는 기존 동작을 한국어로 재서술했을 뿐 로직은 그대로다.
  - 제안: 조치 불요.

## 요약

이번 diff 는 4개 백엔드 파일에서 실행 로직·타입 시그니처·검증 데코레이터·에러 코드/응답 봉투
구조를 전혀 바꾸지 않고 JSDoc·인라인 주석·Swagger `description` 문자열만 확장한 순수 문서화
변경이다. API 계약 관점의 핵심은 `re-run.dto.ts` 의 `inputOverride` description 이 기존에
비공개였던 마커 재제출 거부 규칙(400, `MASKED_VALUE_RESUBMITTED`, 부분 일치 통과)을 처음
문서화했다는 점으로, 이는 스키마·타입 변경이 없어 기존 API 클라이언트에 breaking 영향이 없는
순수 개선이다. `POST /workflows/:id/execute` 가 동일 규칙을 적용받으면서도 인라인 body 타입이라
OpenAPI 문서화 자리가 없어 형제 엔드포인트 간 문서 비대칭이 존재하지만, 이는 이번 PR 이 새로
만든 결함이 아니고 이미 트래커에 "DTO 승격 시 이식" 으로 명시 등재·스코프 아웃되어 있다.
버전 관리·URL/경로 설계·페이지네이션·인증/인가 관련 코드는 이번 diff 에서 전혀 건드리지 않았다.

## 위험도

NONE
