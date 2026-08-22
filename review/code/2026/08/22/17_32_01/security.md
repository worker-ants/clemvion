# Security Review

## 발견사항

없음.

본 diff 의 실제 애플리케이션 코드 변경은 3개 TS 파일에 국한되며, 전부 에러 코드 문자열 리터럴
`INVALID_INPUT` → `INVALID_TRIGGER_PARAMETERS` 의 rename 이다:

- `codebase/backend/src/modules/executions/executions.service.ts` (게이트 510) —
  `TriggerParameterValidationException` catch 절에서 `BadRequestException` 페이로드의
  `code` 필드 리터럴만 교체. `message` 조립, `details: toTriggerParameterErrorDetails(err.errors)`
  로직, 검증 실패 원문(reason)을 그대로 흘리지 않는 기존 동작은 diff 범위 밖으로 변경 없음.
  자매 호출부(`workflows.controller.ts`, `workflows.service.ts`)와 동일한 값·동일한 기존
  정규화 함수를 재사용한다.
- `codebase/backend/src/modules/executions/executions.controller.ts` (게이트 274) — Swagger
  `@ApiBadRequestResponse` 의 `description` 문자열만 교체. `@ApiUnauthorizedResponse` /
  `@ApiForbiddenResponse` 등 인증·인가 데코레이터는 diff 범위 밖.
- `codebase/backend/src/modules/executions/executions-rerun.service.spec.ts` (게이트 330,
  346-361, 431) — 테스트 제목과 `expect((err as BadRequestException).getResponse())
  .toMatchObject({ code: 'INVALID_TRIGGER_PARAMETERS' })` 단언값 교체. 같은 파일의
  `expect(body.errors).toBeUndefined()`(내부 reason 원문 비노출 계약) 단언은 그대로 유지되어
  회귀 방지 캐너리로 남아 있다.

나머지 변경(`codebase/frontend/**/triggers.mdx` · `.en.mdx`, `CHANGELOG.md`,
`plan/in-progress/**`, `spec/**`, `review/**`)은 전부 실행되지 않는 문서/plan/이전 리뷰 산출물
파일이며, 값으로 분기하는 로직 변경이 아니다. `spec/conventions/error-codes.md` §5 신규 행과
`spec/5-system/14-external-interaction-api.md` §R17 갱신은 이번 rename 이 **breaking API
변경**임을 스스로 명시하고 잔여 위험(워크스페이스 JWT 로 호출 가능한 내부 REST 엔드포인트라
저장소 밖 서드파티 분기 가능성을 코드로 완전히 배제할 수 없음)을 사용자 결정으로 인수했음을
정직하게 기록한 문서일 뿐, 이 자체가 새 취약점은 아니다(API 계약 안정성 문제는 이미
`api_contract`/`documentation` reviewer 관점).

grep 결과 이번 diff 범위(신규/변경 텍스트) 내 하드코딩된 API 키·비밀번호·토큰·인증서 없음.
SQL/커맨드/경로 조작으로 이어질 수 있는 사용자 입력 조립부 변경 없음. 인증(`@WorkspaceId()`,
`@Roles(...)`, `verifyOwnership`)·인가 로직, 암호화/해시 알고리즘, 세션 관리 코드는 diff 에
포함되지 않았다. `POST /executions/:id/re-run` 자체의 인증 요구사항(`access-token` = 워크스페이스
JWT)도 이번 변경으로 완화되지 않는다 — 바뀌는 것은 검증 실패 시 반환되는 에러 코드 값뿐이며,
검증 로직(`resolveTriggerParametersRejectingMasked`)·거부 판정(`hasMaskedLeaf`,
`MASKED_VALUE_RESUBMITTED`)·마스킹 카브아웃(#1188/#1189 에서 이미 구현된 서버측 재제출 거부
가드)은 diff 범위 밖으로 변경 없이 그대로 유지된다.

## 요약

이번 변경은 세 개의 Manual 트리거 진입점(주 실행·저장·re-run)이 동일한 파라미터 검증 실패에
대해 서로 다른 최상위 `error.code` 를 반환하던 선존 drift 를 `INVALID_TRIGGER_PARAMETERS` 로
통일하는 순수 식별자 rename 이다. 인증·인가·입력 검증·마스킹 거부 로직·에러 상세(`details[]`)
조립 파이프라인은 모두 기존 그대로이며, 코드 diff 는 문자열 리터럴 교체와 그에 동반한 Swagger
설명·테스트 단언·유저 가이드 문서 갱신에 그친다. `error.code` 값이 breaking 하게 바뀐다는 사실은
`CHANGELOG.md`·`spec/conventions/error-codes.md §5`에 명시적으로 기록되고 사용자 결정으로
인수되었으며, 이는 API 계약(하위 호환성) 문제이지 보안 취약점은 아니다. 보안 관점에서 새로
도입되는 인젝션 표면, 하드코딩 시크릿, 인증/인가 우회, 입력 검증 약화, 암호화 약화, 에러 메시지의
민감정보 노출 확대는 발견되지 않았다.

## 위험도
NONE
