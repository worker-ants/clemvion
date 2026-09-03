# 정식 규약 준수 검토 — `spec/5-system/` (impl-done, diff-base=origin/main)

## 검토 범위와 전제

- 이 검토의 명목 scope(`spec/5-system/`)는 `origin/main` 대비 **델타 0** — payload 자체가 이를 명시한다. 실제로 검토 대상이 된 것은 최근 병합된 `af41a3c6e`("`change-password` 실패 코드를 형제 흐름과 정렬", `#1269`)가 `spec/5-system/1-auth.md`·`spec/5-system/3-error-handling.md`·`spec/conventions/error-codes.md`에 반영한 내용과, 그 커밋이 만든 `codebase/backend/src/common/utils/password.util.ts`(신규) 및 `UsersController.changePassword`/`UsersService.changePassword` 코드다.
- 이 PR은 이미 `--spec` 3라운드, `/ai-review` 3라운드, `--impl-done` 재검증까지 거쳐 병합됐다(커밋 이력 확인). 그 라운드들이 이미 이름 충돌(`naming_collision`)·rationale 반증·plan 동기화 등을 조치했으므로, 본 검토는 **정식 규약(`spec/conventions/**`) 준수** 관점에서 남은 잔여만 짚는다.
- 대조에 사용한 정식 규약 문서: `spec/conventions/error-codes.md`, `spec/conventions/audit-actions.md`, `spec/conventions/swagger.md`(bundle에서 예산 절단되어 워크트리에서 직접 `Read`), `spec/5-system/2-api-convention.md`.

## 발견사항

- **[INFO]** `changePassword` 엔드포인트의 `@ApiUnauthorizedResponse` 설명이 새로 갈라진 두 401 사유를 구분하지 않음
  - target 위치: `codebase/backend/src/modules/users/users.controller.ts` `POST /users/me/change-password` 핸들러의 `@ApiUnauthorizedResponse({ description: '현재 비밀번호 불일치 또는 인증 실패' })`
  - 관련 규약: `spec/conventions/swagger.md` §2-4(상태 코드 응답 규칙)·§3(주석/설명 톤 — "무엇을 하는지 + 제약/부수효과"를 담는다)
  - 상세: 이번 변경의 핵심이 바로 이 엔드포인트의 401을 "비밀번호 미설정(OAuth-only) → `PASSWORD_REQUIRED`" / "불일치 → `PASSWORD_INVALID`" 두 조건으로 가른 것이다(`spec/5-system/1-auth.md` §2.3 note, §5 note). 그런데 컨트롤러의 Swagger `description`은 여전히 "현재 비밀번호 불일치 또는 인증 실패" 한 문장으로, OAuth-only 케이스를 명시적으로 알리지 않는다. `swagger.md`가 코드값 enumeration을 의무화하지는 않으므로 규약 위반(CRITICAL/WARNING)은 아니지만, Swagger UI만 보는 API 소비자는 두 코드가 나뉘어 있다는 사실 — 이 PR이 spec 본문·error-codes.md §5에는 명시적으로 등재한 사실 — 을 컨트롤러 문서에서는 놓친다.
  - 제안: `description`에 "비밀번호 미설정(OAuth-only, `PASSWORD_REQUIRED`) 또는 불일치(`PASSWORD_INVALID`)"처럼 두 코드를 명시하거나, 최소한 spec §2.3 note로의 링크를 덧붙인다. 코드 변경이므로 `developer` 턴에서 조치.

- **[INFO]** `spec/5-system/2-api-convention.md`에 `## Overview` 섹션 헤더 부재
  - target 위치: `spec/5-system/2-api-convention.md` 최상단 (`# Spec: API 설계 규칙` 뒤 바로 `## 1. 기본 원칙`으로 진입)
  - 관련 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권장
  - 상세: `1-auth.md`는 `## Overview`(L27)·`## Rationale`(L525) 둘 다 명시적 헤더로 갖췄지만, `2-api-convention.md`는 `## Rationale`(L421)만 있고 `## Overview` 헤더가 없다(관련 문서 링크 뒤 바로 `## 1. 기본 원칙`). 이는 이번 diff가 만든 결함이 아니라 **기존부터 있던 구조**이며, 이번 PR은 이 파일을 수정하지 않았다(diff 대상 아님) — 따라서 이번 변경에 대한 CRITICAL/WARNING 사유는 아니다.
  - 제안: 이번 PR의 조치 대상은 아님. 별도 문서 정리 turn에서 `## Overview` 헤더를 신설하거나(현재 산문이 사실상 Overview 역할을 하므로 헤더만 추가), 3섹션 권장이 강제가 아님을 감안해 보류해도 무방.

## 규약 준수가 확인된 지점 (참고)

- **명명 규약**: `PASSWORD_REQUIRED`/`PASSWORD_INVALID`(`common/utils/password.util.ts` `PASSWORD_VERIFY_CODES`)는 `UPPER_SNAKE_CASE`(`error-codes.md` §1) 준수. 은퇴된 `INVALID_PASSWORD`는 `error-codes.md` §5 Rename 이력에 "등급 B — 잔여 위험 인수"로 정식 등재되어 있고, `login_history.failure_reason` 레이어 잔존 사실도 §5 "제거는 wire 발행 중단을 뜻한다" 규칙대로 비고에 명시됨.
- **출력 포맷 규약**: 응답 봉투(`{ data: { accessToken } }`)는 `api-convention.md` §5.1 단일 리소스 형태와 `swagger.md` §5-2 `ApiOkWrappedResponse`(`PasswordChangeResultDto`) 패턴을 그대로 따름. `ChangePasswordDto`/`PasswordChangeResultDto` 모두 JSDoc + `@ApiProperty`로 `swagger.md` §1-1 패턴 준수.
- **감사 로그 규약**: 이번 변경은 `user.password_changed`(과거분사, `audit-actions.md` §2.1) 발행 대상·로직을 바꾸지 않았고, 신규 audit action도 추가하지 않아 `audit-actions.md`와 충돌 없음.
- **문서 구조**: `spec/5-system/1-auth.md`는 Overview(L27)/본문(§1~§5)/Rationale(L525) 3섹션 구조를 유지하며, 이번 diff가 추가한 §2.3·§5 note와 §Rationale의 취소선 정정(자기-반증형 소정정 조건 4 — 원문 보존)도 CLAUDE.md의 해당 규칙과 일치.
- **API 문서 규약**: `changePassword` 컨트롤러 메서드는 `swagger.md` §2-2/§2-4가 요구하는 `@ApiOperation`·`@ApiOkWrappedResponse`·`@ApiBadRequestResponse`·`@ApiUnauthorizedResponse`·`@ApiNotFoundResponse` 조합을 모두 갖춤.
- **금지 항목**: `PASSWORD_VERIFY_CODES` 상수로 세 발행 지점(`AuthService.verifyPasswordForUser`·`UsersService.changePassword`·`SessionsService.verifyReauth`의 `.INVALID`)을 통합해 `audit-actions.md`류의 "인라인 문자열 금지" 취지와 부합하는 방향으로 오히려 drift 원인(문자열 리터럴 중복)을 제거함 — 금지 패턴 재도입 없음.

## 요약

이번 검토 대상(`spec/5-system/` 및 그 위에서 최근 병합된 change-password 코드 변경)은 이미 여러 라운드의 `--spec`·`/ai-review`·`--impl-done` 검증을 거쳐 병합된 상태이며, `spec/conventions/error-codes.md`(명명·rename 정책·historical-artifact/은퇴 레지스트리)와 `spec/conventions/audit-actions.md`(감사 액션 시제 분류)를 정확히 따른다. `spec/conventions/swagger.md`의 DTO·컨트롤러 데코레이터 패턴도 준수하나, `changePassword` 엔드포인트의 `@ApiUnauthorizedResponse` 설명 문구가 이번 PR이 spec에는 명시한 "비밀번호 미설정 vs 불일치" 구분을 Swagger 문서 레벨에서는 아직 반영하지 못한 사소한 잔여가 있다(INFO). CRITICAL/WARNING급 정식 규약 위반은 발견되지 않았다.

## 위험도

LOW
