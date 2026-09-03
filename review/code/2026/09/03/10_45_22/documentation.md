# 문서화(Documentation) 코드 리뷰

## 검토 범위 및 방법

`change-password` 실패 코드를 형제 흐름(`AuthService.verifyPasswordForUser`)과 정렬하는 변경
(`INVALID_PASSWORD` → `PASSWORD_REQUIRED`/`PASSWORD_INVALID`)의 최신 라운드 — 직전 코드 리뷰
(`review/code/2026/09/02/22_07_21/`)의 WARNING 4건에 대한 조치(`RESOLUTION.md`, 커밋
`139115d34`)가 반영된 이후 상태다. 프롬프트에 포함된 46개 파일 중 애플리케이션 코드·테스트·
사용자 가이드·CHANGELOG 9개 파일을 실제 저장소(`origin/main..HEAD`)에서 직접 열어 대조했고,
`grep -rn INVALID_PASSWORD codebase/ spec/`로 저장소 전체에서 은퇴된 wire 코드의 잔존 참조가
없는지 별도 확인했다. `plan/**`·`review/consistency/**`·`review/code/22_07_21/**`(직전 라운드
산출물)는 프로세스 아티팩트로 별도 취급하되, `plan/in-progress/auth-change-password-oauth-only-code-split.md`
는 이번 changeset 이 직접 재작성한 파일이라 체크리스트 정확성만 대조했다(아래 발견사항 참조).

## 발견사항

- **[WARNING]** plan 체크리스트가 이번 changeset 자신이 끝낸 작업을 미완료로 표시
  - 위치: `plan/in-progress/auth-change-password-oauth-only-code-split.md:147` (`## 할 일` 마지막 항목)
  - 상세: 이 줄은 이번 changeset(`origin/main..HEAD`)이 새로 써 넣은 것으로,
    `- [ ] developer 턴 — backend 두 분기 + 공용 상수화(...) + 단위/e2e + 유저 가이드
    password-and-sessions.mdx ko/en :80 사실 오류 정정 ...` 을 **미체크**로 남긴다. 그런데
    같은 changeset 이 이미 그 항목 전부를 완료했다 — backend 두 분기 정렬(`users.service.ts`
    286~303), 공용 상수화(`password.util.ts` 의 `PASSWORD_VERIFY_CODES`), 단위 테스트
    (`users.service.spec.ts`·`sessions.service.spec.ts` 신규 케이스), e2e 테스트
    (`test/users-change-password.e2e-spec.ts` 의 `OAuth-only 계정(password_hash NULL) →
    401 PASSWORD_REQUIRED`), 유저 가이드 ko/en 정정(`password-and-sessions.{mdx,en.mdx}`)
    — 전부 실측으로 존재를 확인했다. CLAUDE.md/프로젝트 관례("체크박스 = 실제 상태")를
    이 changeset 스스로 어긴 사례다. 미체크 상태로 남으면 다음 사람이 이미 끝난 e2e/유저
    가이드 작업을 "아직 안 됐다" 고 오판해 중복 작업을 하거나, 이 plan 이 `complete/` 로
    이동해야 할 시점을 놓친다(바로 위 세 항목은 이미 `[x]`로 전환됐다).
  - 제안: 해당 줄을 `[x]` 로 전환하고(완료된 하위 작업을 개조식으로 분리해도 좋다), 남은
    유일한 미완료 항목("후속(별개 PR) — `User.passwordHash` 타입…")만 `[ ]` 로 남긴 뒤 이
    plan 을 `plan/complete/` 로 이동할지 판단할 것.

- **[INFO]** `changePassword` 의 `@throws` JSDoc 이 `PASSWORD_INVALID` 공유처를 실제보다 적게 열거
  - 위치: `codebase/backend/src/modules/users/users.service.ts:270`
    (`* 두 코드 모두 \`AuthService.verifyPasswordForUser\` 와 **공유**한다 (\`PASSWORD_VERIFY_CODES\`).`)
  - 상세: 이 문장은 `PASSWORD_INVALID`/`PASSWORD_REQUIRED` 를 공유하는 곳으로 `AuthService`
    하나만 든다. 그러나 실측(`sessions.service.ts:270`, `grep` 확인)하면
    `SessionsService.verifyReauth` 도 `PASSWORD_VERIFY_CODES.INVALID` 를 발행한다(단,
    `.REQUIRED` 는 발행하지 않고 그 대신 `REAUTH_NOT_AVAILABLE`/`REAUTH_REQUIRED` 를 쓴다 —
    `password.util.ts` 의 `PASSWORD_VERIFY_CODES` JSDoc 은 이 구분을 정확히 반영해 세 소비처를
    모두 열거한다). 같은 PR 이 `RESOLUTION.md` 의 "조치한 INFO #1"에서 정확히 같은 종류의
    소비처 언더카운트(둘만 열거 → 셋으로 정정)를 `password.util.ts` 에서 고쳤는데, `users.service.ts`
    쪽 `@throws` 문서에는 같은 정정이 반영되지 않았다. 기능 영향은 없다(메시지는 호출부별로
    독립 소유라 이 문장이 코드 동작을 바꾸지 않는다) — 다음 유지보수자가 `PASSWORD_INVALID`
    의 실제 소비 범위를 좁게 오판할 수 있는 문서 정확도 이슈다.
  - 제안: `AuthService.verifyPasswordForUser` 뒤에 `SessionsService.verifyReauth`(INVALID 만)를
    덧붙이거나, `password.util.ts` 의 `PASSWORD_VERIFY_CODES` JSDoc 을 참조하도록 문장을 단순화.

- **[INFO]** Swagger(`@ApiUnauthorizedResponse`) 설명이 코드 분리를 반영하지 않음 (API 문서, 비차단)
  - 위치: `codebase/backend/src/modules/users/users.controller.ts` — `changePassword` 핸들러
    (이 파일은 이번 diff 대상이 아니라 게이트 줄 번호를 인용하지 않음 — 함수/데코레이터명으로
    특정. 동일 사실을 이전 라운드 `api_contract.md` 리뷰어도 INFO 로 기록해 둔 바 있어 여기서는
    중복 상세 없이 확인만 기록한다)
  - 상세: `POST /users/me/change-password` 가 이제 401 을 `PASSWORD_REQUIRED`/`PASSWORD_INVALID`
    두 코드로 분리해 발행하는데, OpenAPI 설명은 여전히 단일 문구("현재 비밀번호 불일치 또는
    인증 실패")다. 기능 문제는 없으나(컨트롤러가 예외를 그대로 전파할 뿐 코드를 검사하지 않음),
    자동 client 생성기 등 OpenAPI 소비자에게는 두 코드 분리가 드러나지 않는다.
  - 제안: 조치 불필요(비차단). 여유가 있을 때 description 세분화를 고려.

## 확인한 항목 (문제 없음 — 실측 대조)

- **CHANGELOG.md** — `## Unreleased — 비밀번호가 없는 사람에게 "현재 비밀번호가 틀렸다" 고
  말하고 있었다` 항목(1~28행)이 직전 라운드 WARNING("CHANGELOG 누락")을 정확히 해소한다.
  종전/변경 코드 쌍 표, 영향 엔드포인트, 감사값 존속 이유, 유저 가이드 정정 사실까지 실제
  diff 와 1:1 로 일치.
- **`password.util.ts` `PASSWORD_VERIFY_CODES` JSDoc**(7~30행) — 세 소비처
  (`AuthService.verifyPasswordForUser`·`UsersService.changePassword`·
  `SessionsService.verifyReauth`, 후자는 `.INVALID` only)를 정확히 열거하고, 헬퍼를 공유하지
  않는 이유(순환 의존: `UsersService` → `AuthService` 주입 불가)도 실제 모듈 구조와 일치.
- **`sessions.service.spec.ts` 신규 테스트 독스트링**(183~191행) — "예외 클래스만 보면
  코드 drift 를 놓친다" 는 근거가 실제 신규 테스트 본문(코드값을 리터럴로 단언)과 일치.
- **`users.service.spec.ts` 신규 헬퍼·테스트 독스트링**(`oauthOnlyUser()` 캐스트 근거,
  `codeOf()` 리터럴-단언 근거) — `User` 엔티티의 `nullable: true` 컬럼과 `validatePasswordHashFormat`
  의 `=== null` 검사를 실측 대조, 정확.
- **`users-change-password.e2e-spec.ts` 신규 e2e 독스트링** — "unit 만으로는 부족하다 — wire
  계약 변경인데 자매 분기만 e2e 가 있었다" 는 서술이 직전 라운드 `user_guide_sync.md` 리뷰가
  지적한 WARNING(e2e 갭)과 정확히 대응하며, 이번 changeset 이 그 갭을 메운다.
- **`password-and-sessions.mdx`/`.en.mdx`** — "비밀번호를 직접 설정하는 기능은 제공되지 않는다"
  는 반대 서술을 "forgot-password → reset-password 로 추가할 수 있다" 로 정정한 내용이 ko/en
  대칭이고 `spec/5-system/1-auth.md §1.1.A` 및 실제 구현(reset-password 가 `password_hash`
  부재를 전제로 검사하지 않음)과 일치.
- **저장소 전체 은퇴 코드 잔존 검사** — `grep -rn INVALID_PASSWORD codebase/ spec/`로 wire 코드로서의
  잔존 참조 0건 확인. 남은 참조는 전부 다른 레이어(① `login_history.failure_reason` 감사값,
  로그인 실패 사유 — 설계상 존속, ② 히스토리 서술로서 "은퇴했다"고 정확히 주석된 spec 문단,
  ③ 이번 PR 자신의 drift 설명 주석)로, 전부 정확하고 오래된(stale) 서술이 아니다.

## 요약

직전 라운드에서 지적된 CHANGELOG 누락 WARNING 은 정확하고 상세하게 해소됐고, 핵심 코드
(`password.util.ts`·`users.service.ts`)의 JSDoc·인라인 주석, 신규 테스트 독스트링, 유저 가이드
mdx(ko/en)는 실제 구현·spec 과 전수 대조해도 대부분 정확했다. 다만 이번 changeset 이 스스로
새로 써 넣은 plan 체크리스트 한 줄(`developer 턴 …`)이 같은 changeset 이 완료한 작업(백엔드
분기·공용 상수화·단위/e2e·유저 가이드 정정)을 미체크로 남기는 self-inconsistency 를 WARNING
으로 기록한다. 부수적으로 `users.service.ts` `@throws` JSDoc 이 `PASSWORD_INVALID` 공유처를
과소 열거하는 지점(이 PR 이 이미 한 번 같은 유형을 고친 자리와 대칭)과, Swagger 설명 미세분화
(직전 라운드에서도 INFO로 기록됨)를 INFO 로 남긴다. 둘 다 기능적 위험은 없다.

## 위험도

LOW
