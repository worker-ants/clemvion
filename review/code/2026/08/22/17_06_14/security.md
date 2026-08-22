# Security Review

## 발견사항

없음.

본 PR 의 코드 diff 는 다음 5개 파일, 순수 텍스트 치환(에러 코드 식별자 `INVALID_INPUT` →
`INVALID_TRIGGER_PARAMETERS` rename)에 한정된다 (`git diff --stat origin/main -- codebase/` 실측:
5 files changed, 10 insertions(+), 6 deletions(-)):

- `codebase/backend/src/modules/executions/executions.service.ts` — `BadRequestException` 페이로드의
  `code` 필드 문자열 리터럴 교체 (`throw` 블록, `TriggerParameterValidationException` catch 절).
  `message`/`details` 조립 로직(`toTriggerParameterErrorDetails(err.errors)`)은 이 diff 로 변경되지
  않았고, 자매 호출부(`workflows.controller.ts`, `workflows.service.ts`, `hooks.service.ts`)와 동일한
  기존 함수를 그대로 재사용한다. 검증 실패 원문 reason 을 그대로 흘리지 않는 기존 동작(spec 파일의
  `내부 reason 원문을 그대로 흘리지 않는다` 단언)도 그대로 유지된다.
- `codebase/backend/src/modules/executions/executions.controller.ts` — Swagger `@ApiBadRequestResponse`
  의 `description` 문자열만 교체. 인증/인가 데코레이터(`@WorkspaceId()`, `@Roles(...)`,
  `verifyOwnership` 호출 등)는 diff 범위 밖이며 변경 없음.
- `codebase/backend/src/modules/executions/executions-rerun.service.spec.ts` — 테스트 제목과
  `expect(body.code).toBe(...)` 단언값 교체. 함께 있는 `expect(body.errors).toBeUndefined()` 단언은
  그대로 유지돼 민감 정보(원본 검증 실패 사유) 비노출 계약이 테스트로 여전히 고정돼 있다.
- `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` / `.en.mdx` — 사용자 가이드 문서 내
  에러 코드 이름 문자열 교체(코드 아님).

이 변경 자체로 새로 열리는 인젝션 표면, 하드코딩 시크릿, 인증/인가 우회, 입력 검증 약화, 암호화
약화, 에러 메시지의 민감정보 노출 확대는 없다. 값으로 분기하는 소비처가 있는지도 plan 문서
(`plan/in-progress/eia-error-code-unify.md`)가 실측으로 확인했다 — 프런트 `rerun-modal.tsx` 의
`ERROR_CODE_TO_KEY` 는 `RERUN_*` 4종만 매핑하고 `INVALID_INPUT`/`INVALID_TRIGGER_PARAMETERS` 는
generic fallback 이라 이번 rename 이 클라이언트 분기 로직을 깨지 않는다(코드 diff 범위 밖이라
본 리뷰가 별도 검증하지는 않았으나, plan 서술과 실제 코드 diff 범위가 정합적이라는 점만 확인).

나머지 리뷰 대상(`plan/**`, `review/consistency/**`, `spec/**`)은 프로세스 산출물·설계 문서로,
실행되는 코드가 아니므로 보안 스캐닝 대상에서 제외했다(하드코딩 시크릿 여부만 훑었으며 해당 없음).

## 요약

이번 변경은 두 개의 Manual 엔드포인트(주 실행 경로와 re-run)가 같은 검증 실패에 대해 서로 다른
최상위 `error.code` 를 반환하던 선존 drift 를 통일하는, 순수 식별자 rename 이다. 검증 로직·인가
체크·에러 상세 조립(`details[]`) 파이프라인은 모두 기존 그대로이며 diff 는 문자열 리터럴 교체에
그친다. 보안 관점에서 새로 도입되는 취약점이나 회귀는 발견되지 않았다.

## 위험도
NONE
