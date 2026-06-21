# 성능(Performance) 리뷰 결과

대상: 이메일 변경 프로세스 구현 (spec/5-system/1-auth.md §1.1.B) — resolution 적용 후 재리뷰
검토일: 2026-06-21

---

## 발견사항

### [INFO] `verifyEmailChange` — user 엔티티 DB 읽기 3회 누적

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/spec-email-change-0fcba4/codebase/backend/src/modules/auth/auth.service.ts` — `verifyEmailChange` 메서드 (line 867, 924) 및 `codebase/backend/src/modules/users/users.service.ts` — `update` 메서드 (line 44-47)
- 상세: `verifyEmailChange` 흐름에서 동일 userId 에 대해 user 행을 총 3회 SELECT 한다.
  1. `usersService.findById(userId)` — 진입 시 토큰 검증·`oldEmail` 확보 (line 867)
  2. `usersService.update(userId, {...})` 내부 — `userRepository.update` 실행 후 `findOneOrFail` 로 갱신 결과 반환 (users.service.ts line 46)
  3. `usersService.findById(userId)` — `generateTokens` 에 전달할 `updated` 엔티티 재조회 (line 924)

  2번은 `update` 의 반환값을 `verifyEmailChange` 에서 사용하지 않으므로 발생하는 낭비이고, 3번은 그 반환값을 사용하지 않아서 다시 읽어야 하는 구조적 중복이다. 이 흐름은 1번의 read trip 을 줄일 수 있음에도 총 3회 SELECT 가 일어난다. 이메일 변경은 저빈도 작업이므로 현재 TPS 부담은 없으나, `UsersService.update` 가 항상 `findOneOrFail` 을 동반하는 구조는 다른 호출 경로(password change 등)에서도 동일하게 여분의 SELECT 를 발생시킨다.
- 제안: `usersService.update` 가 반환하는 엔티티를 `verifyEmailChange` 에서 재사용하면 3번 `findById` 를 제거할 수 있다(`const updated = await this.usersService.update(userId, { email: newEmail, ... })`). 단, 2번의 `findOneOrFail` 자체를 제거하려면 `update` 시그니처를 `void` 반환으로 바꾸고 필요 시만 조회하는 방향으로 리팩터가 필요하다 — 이는 이번 PR 범위 밖이다. 즉각 적용 가능한 최소 개선은 `verifyEmailChange` 의 `const updated = await this.usersService.findById(userId)` 를 제거하고 `update` 반환값을 사용하는 것이다.

---

### [INFO] `requestEmailChange` — `findById` 호출이 `reauthenticate` 와 분리된 직렬 구조

- 위치: `codebase/backend/src/modules/auth/auth.service.ts` — `requestEmailChange` (line 818 전후)
- 상세: `requestEmailChange` 는 `reauthenticate(userId, reauth)` 호출 후 다시 `usersService.findById(userId)` 를 별도로 호출한다. `reauthenticate` 내부에서도 동일 userId 로 `usersService.findById` 를 호출하므로 같은 행을 2회 SELECT 한다. `reauthenticate` 가 User 객체를 반환하도록 변경하면 1회로 줄일 수 있다. 이 개선은 이전 리뷰 세션(INFO#5)에서도 언급되었으나 resolution 적용 대상에서 제외된 사항이며, 저빈도 흐름이므로 현재 영향은 없다.
- 제안: `sessionsService.reauthenticate` 가 검증된 `User` 엔티티를 반환하도록 확장하거나, `requestEmailChange` 에서 `reauthenticate` 이후 별도 `findById` 없이 직접 user 객체를 전달받는 내부 헬퍼를 도입한다. 우선순위 낮음.

---

### [INFO] `emailTakenByOther` — `LOWER()` 표현식 인덱스 미존재 시 seq scan

- 위치: `codebase/backend/src/modules/users/users.service.ts` — `emailTakenByOther` (line 108-113)
- 상세: `WHERE LOWER(u.email) = LOWER(:email)` 은 B-tree 인덱스를 활용하지 못한다. `requestEmailChange` 와 `verifyEmailChange` 양쪽에서 호출되므로 이메일 변경 1회에 2번 실행된다. `V100` 마이그레이션에 `CREATE INDEX ... ON "user" (LOWER(email))` 이 포함되지 않았고, 기존 마이그레이션에 해당 표현식 인덱스가 없다면 전체 테이블 스캔이 발생한다. 사용자 수가 많아질수록 영향이 커지나, 이메일 변경이 저빈도 작업이므로 현 단계 TPS 영향은 미미하다.
- 제안: 기존 마이그레이션에 `CREATE UNIQUE INDEX IF NOT EXISTS idx_user_email_lower ON "user" (LOWER(email));` 추가 여부를 확인하고, 없다면 별도 마이그레이션에서 추가를 검토한다. 이전 리뷰 세션(INFO#6)에서도 언급된 사항으로 즉각 조치 우선도는 낮다.

---

### [INFO] HTML 이메일 템플릿 — 호출마다 문자열 생성 (정상 허용)

- 위치: `codebase/backend/src/modules/mail/mail.service.ts` — `buildEmailChangeVerificationHtml`, `buildEmailChangedNoticeHtml`
- 상세: 개인화 변수(name, email, rawToken URL)가 포함돼 있어 요청별로 매번 템플릿 리터럴을 생성해야 한다. 전역 캐싱 불가. 문자열 길이 수백 바이트, 발송 저빈도 — 연산 비용 무시 가능.
- 제안: 현행 구조 유지. 향후 이메일 유형이 다수 추가된다면 Handlebars/Nunjucks 컴파일 템플릿으로 전환해 파싱 오버헤드를 1회로 줄이는 것을 고려할 수 있으나, 현 시점 개선 필요 없음.

---

### [INFO] `verifyEmailChange` — UNIQUE 위반 catch 경로의 추가 DB 쓰기 (예외 경로, 영향 없음)

- 위치: `codebase/backend/src/modules/auth/auth.service.ts` — `verifyEmailChange` (UNIQUE 위반 catch 블록)
- 상세: UNIQUE 제약 위반(`23505`) 감지 후 `clearPendingEmailChange` 를 추가로 호출한다. 경쟁 조건이 발생해야만 진입하는 예외 경로이므로 정상 동작 TPS 에 영향 없음.
- 제안: 현행 구조 유지.

---

## 요약

이번 변경셋의 성능 관점 핵심 이슈는 `verifyEmailChange` 에서 동일 userId 행을 3회 SELECT 하는 구조다. `UsersService.update` 가 내부적으로 `findOneOrFail` 을 수행하면서 반환값을 caller 가 사용하지 않아 곧바로 또 `findById` 를 호출하는 중복이 발생한다. 이는 이전 리뷰 세션의 INFO#4 에서 언급된 사항으로, resolution 에서 수정 대상에서 제외되었다. `requestEmailChange` 에서도 `reauthenticate` 와 `findById` 가 같은 행을 이중으로 조회하는 패턴이 존재한다(INFO#5). 두 항목 모두 이메일 변경이 저빈도 작업이고 단건 PK 조회라는 특성상 실제 TPS 영향은 없으나, `UsersService.update` 의 설계가 모든 update 경로에서 불필요한 SELECT 를 강제하는 점은 향후 고빈도 경로 추가 시 주의가 필요하다. 알고리즘 복잡도·N+1·캐싱·블로킹 I/O·데이터 구조 관점에서 별도 문제는 없다. 모든 발견사항이 INFO 등급이며 차단 요소가 없다.

## 위험도

NONE

---

STATUS=success ISSUES=4 PATH=/Volumes/project/private/clemvion/.claude/worktrees/spec-email-change-0fcba4/review/code/2026/06/21/20_21_02/performance.md RESET_HINT=
