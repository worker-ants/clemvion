# 요구사항(Requirement) 리뷰 — `change-password` 실패 코드 형제 흐름 정렬

대상 커밋: `93146d2f2` (`feat(auth): change-password 실패 코드를 형제 흐름과 정렬`)

## 발견사항

- **[INFO]** `PASSWORD_VERIFY_CODES` JSDoc 이 실제 소비자 3곳 중 2곳만 열거
  - 위치: `codebase/backend/src/common/utils/password.util.ts:13-14` (게이트 라인)
  - 상세: 주석은 "`AuthService.verifyPasswordForUser` 와 `UsersService.changePassword` 가 같은 값을
    발행한다"고만 적는데, 실제로는 `SessionsService.verifyReauth`(`codebase/backend/src/modules/auth/sessions.service.ts:270`)도 이번 커밋에서 `PASSWORD_VERIFY_CODES.INVALID` 로 전환됐다(`.REQUIRED` 는 안 씀 — 그쪽 missing 케이스는 별도 `REAUTH_REQUIRED` 리터럴 유지). 상수 값을 셋이 공유하는데 주석은 둘만 센다. 기능상 문제는 없고(코드는 정확히 동작), `1-auth.md §2.3` 재인증 note 는 3곳을 정확히 나열하므로 spec 은 옳다 — 코드 쪽 JSDoc 만 살짝 좁다.
  - 제안: 주석에 `SessionsService.verifyReauth`(`.INVALID` only)를 세 번째 소비자로 추가.

- **[INFO]** e2e 스위트에 OAuth-only(`PASSWORD_REQUIRED`) 분기 케이스 부재
  - 위치: `codebase/backend/test/users-change-password.e2e-spec.ts` (전체 파일 — `PASSWORD_INVALID` 케이스만 존재, `PASSWORD_REQUIRED` e2e 없음)
  - 상세: e2e 는 불일치(`PASSWORD_INVALID`) 401 케이스만 검증한다. OAuth-only(`PASSWORD_REQUIRED`) 분기는 `users.service.spec.ts` 단위 테스트 3종(코드·대조군·메시지)으로 충분히 커버되지만, e2e 헬퍼(`test/helpers/auth.ts`)에 OAuth 계정 생성 지원이 없어 실 HTTP 왕복 검증은 비어 있다. 단위 테스트 커버리지가 두터워 리스크는 낮음.
  - 제안: 필요 시 DB 직접 삽입으로 `passwordHash: null` 사용자를 만드는 e2e 헬퍼 추가 검토(선택 사항).

- **[INFO]** 워킹트리에 이 리뷰 대상 커밋에 포함되지 않은 **비커밋 변경**이 관측됨
  - 위치: `plan/in-progress/auth-change-password-oauth-only-code-split.md` (working tree, uncommitted — `git status --short` 상 ` M`)
  - 상세: `git diff`로 확인한 결과 `## 검증 — 뮤테이션 (2026-09-02, 구현 후)` 절(뮤턴트 M1~M4 표 + 원복 방식 서술)이 HEAD(`93146d2f2`)에는 없고 현재 워킹트리에만 존재한다. 본 리뷰는 이 파일을 `Read` 만 했고 어떤 도구로도 write 하지 않았다 — 이 변경은 병렬 fan-out 의 다른 리뷰어(동일 세션 `22_07_21` 대상 다른 sub-agent)가 만든 것으로 추정된다(뮤테이션 검증 규약이 각 리뷰어에게 동일하게 부여됨). `git checkout`/`restore` 로 되돌리지 않았다(금지 사항이자, 다른 에이전트의 진행 중 작업일 수 있어 삭제 시 유실 위험). 내용 자체는 해가 없고(정상적인 뮤테이션 검증 기록 형식) 리뷰 대상 diff 의 판단에는 영향 없음.
  - 제안: 이 관측을 orchestrator/SUMMARY 가 인지하도록 전달 — 다른 리뷰어의 산출물과 충돌하지 않는지, 최종 커밋 전 의도적으로 반영할지 확인 필요.

## 점검 결과 요약 (관점별)

1. **기능 완전성** — `UsersService.changePassword` 가 OAuth-only(`passwordHash` 부재) → `PASSWORD_REQUIRED`(401), 불일치 → `PASSWORD_INVALID`(401)로 정확히 분기(`codebase/backend/src/modules/users/users.service.ts` changePassword). 사용자 미존재 404(`USER_NOT_FOUND`)는 변경 범위 밖으로 유지 — 의도한 대로.
2. **엣지 케이스** — DTO `ChangePasswordDto.currentPassword` 에 기존 `@MinLength(1)` 검증이 있어 빈 문자열은 400 ValidationPipe 에서 걸러짐(본 PR 범위 밖, 사전 존재) — REQUIRED 분기가 "미입력"까지 포괄할 필요가 없어 JSDoc·spec 서술과 정합.
3. **TODO/FIXME** — 변경분에 TODO/FIXME/HACK/XXX 없음. plan 문서 내 남은 미결 항목(`User.passwordHash` 타입 확장 별도 PR, developer 턴 체크박스 미체크)은 각각 정당한 사유가 문서화되어 있음.
4. **의도와 구현 간 괴리** — 함수 시그니처·JSDoc·실제 던지는 코드가 3중 검증(users.service.ts JSDoc, spec 본문, 실제 throw)에서 완전히 일치. `PASSWORD_VERIFY_CODES` 주석의 소비자 열거만 위 INFO 항목처럼 약간 좁음.
5. **에러 시나리오** — `NotFoundException(USER_NOT_FOUND)` → `UnauthorizedException(PASSWORD_REQUIRED)` → `UnauthorizedException(PASSWORD_INVALID)` → `BadRequestException(VALIDATION_ERROR, validatePasswordStrength)` 순서로 4갈래 모두 테스트·구현 일치.
6. **데이터 유효성** — `validatePasswordStrength`(8자 이상 + 3종 이상) 변경 없음, 그대로 재사용.
7. **비즈니스 로직** — 형제 흐름(`AuthService.verifyPasswordForUser`)과 코드 정렬이라는 결정(사용자 결정 2026-09-02, plan `auth-change-password-oauth-only-code-split.md` 결정 기록)이 코드에 정확히 반영됨. `INVALID_PASSWORD` wire 은퇴 후 `login_history.failure_reason` 감사값만 존속한다는 주장도 `AuthService.login`(`:348` 부근) 실측으로 확인됨 — `users` 모듈은 `login_history` 를 쓰지 않음(grep 0건, 주장과 일치).
8. **반환값** — `changePassword`(`Promise<void>`) 모든 실패 경로에서 throw, 성공 경로에서 `void` 반환 — 시그니처·문서 일치. 컨트롤러 단(세션 회전·감사·쿠키)은 이번 diff 범위 밖(불변).
9. **spec fidelity** —
   - `spec/5-system/1-auth.md` §2.3 재인증 note(`:337`)·비밀번호 변경 note(`:339`)·§5 민감 동작 재확인 note(`:521`)·2.3.C Rationale(`:750`) 4곳 모두 실제 코드(에러 코드·상태·안내 링크)와 line-level 일치 확인.
   - `spec/5-system/3-error-handling.md` §1.2 `INVALID_PASSWORD` 행 제거 + §1.2.1 헤더·`PASSWORD_INVALID`/`PASSWORD_REQUIRED` 행에 `changePassword` 발행처 추가 + 근접명명 주석 갱신 — 모두 코드와 정합. 앵커(`#121-2fa--webauthn--재인증비밀번호-재확인-코드-도메인-spec-참조`)도 실제 헤딩 텍스트와 슬러그 일치 확인.
   - `spec/conventions/error-codes.md` §3 `INVALID_PASSWORD` 행 제거 + §5 rename 이력 표에 신규 행(등급 B, 조건별 2종 대체) 추가 — PR 열은 아직 plan 링크(병합 전 상태, 문서 내 INFO 로 명시된 정책대로 정상).
   - `spec/2-navigation/9-user-profile.md` §2.1(`:94`)·§2.2(`:147`) 두 곳 모두 정확히 갱신, `:147` 을 단일 SoT 로 두고 `:94`·`:141` 는 포인터만 — 문서화된 설계 그대로.
   - 타입체크 baseline(`scripts/backend-typecheck-baseline.json`) 갱신(199→198, `users.service.spec.ts` 항목 제거)을 `npx tsc --noEmit -p tsconfig.json` 실측으로 재현 — 총 오류 198건, 변경 대상 6개 파일에 오류 0건, JSON 내 `total`=파일별 합계 일치. baseline 하향 주장이 실측과 일치.
   - 관련 unit 테스트(`users.service.spec.ts`·`auth.service.spec.ts`·`sessions.service.spec.ts`·`users.controller.spec.ts`) 4개 스위트 재실행 결과 186/186 전부 통과.

## 요약

`change-password` 가 OAuth-only 미설정과 현재 비밀번호 불일치를 동일한 `INVALID_PASSWORD` 코드로 뭉개던 결함을, 형제 흐름(`AuthService.verifyPasswordForUser`)과 동일한 `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 로 정확히 분리했다. 신규 코드를 만들지 않고 기존 카탈로그 값을 재사용했으며, drift 재발 방지를 위해 공유 상수(`PASSWORD_VERIFY_CODES`)로 구조적으로 묶었다. spec(`1-auth.md`·`3-error-handling.md`·`error-codes.md`·`9-user-profile.md`) 4개 문서 전부가 이 변경을 line-level 로 정확히 반영하고 있으며 코드·테스트·문서·유저 가이드(ko/en)·타입체크 baseline 사이에 실측 가능한 불일치가 발견되지 않았다. 테스트는 옛 회귀를 놓쳤던 원인(예외 클래스만 단언)까지 분석해 리터럴 단언 + 대조군 테스트로 보강했고, 실제 unit 테스트 재실행·tsc 재실행으로 검증했다. 발견된 사항은 모두 INFO 등급(JSDoc 소비자 열거 소폭 누락, e2e 커버리지 소폭 gap, 리뷰 중 관측된 타 에이전트로 추정되는 워킹트리 비커밋 변경)이며 코드 정확성이나 spec 정합성에 영향을 주지 않는다.

## 위험도

NONE
