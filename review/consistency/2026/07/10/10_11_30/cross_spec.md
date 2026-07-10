# Cross-Spec 일관성 검토 — auth-reauth-spec-accuracy

## 발견사항

- **[WARNING]** `PASSWORD_INVALID` 를 "로그인과 공용" 으로 잘못 귀속 — 실제 두 번째 소비자는 로그인이 아니라 `AuthService.verifyPasswordForUser`(2FA 비활성화·WebAuthn 복구코드 재발급)
  - target 위치: 변경 1b (§2.3 재인증 에러 코드 note) — "비밀번호 불일치 → `PASSWORD_INVALID`(401, **로그인과 공용**)"; 변경 2a 표 행 — "`PASSWORD_INVALID` | 401 | 비밀번호 재확인 불일치 (**재인증·로그인 공용**)"; 변경 2a 검증 각주 — "`PASSWORD_INVALID`=UnauthorizedException→401(**login** `auth.service.ts:80`·reauth `sessions.service.ts:266` 일치)"
  - 충돌 대상: 실제 코드 `codebase/backend/src/modules/auth/auth.service.ts` — 로그인 함수(`login`, L260~)의 비밀번호 불일치 분기는 `code: 'LOGIN_FAILED'`(L347 부근, `spec/5-system/3-error-handling.md` §1.2 기존 등재 코드)를 던진다. `PASSWORD_INVALID`(L81)는 별도 헬퍼 `verifyPasswordForUser`(2FA 비활성화·WebAuthn 복구코드 재발급 전용, `plan/complete/refactor-auth-reverify-unify.md` 가 도입)가 던진다. `spec/data-flow/2-auth.md` L76 도 로그인 실패를 `login_history` 이벤트 `login_failed`/`failureReason=INVALID_PASSWORD`(API 코드 아님, `PASSWORD_INVALID` 와 표기만 유사한 별개 문자열)로만 기록하며 API 에러 코드는 명시하지 않는다 — 즉 로그인 경로 어디에도 `PASSWORD_INVALID` 가 등장하지 않는다.
  - 상세: target 이 인용한 `auth.service.ts:80` 라인은 실제로는 `verifyPasswordForUser` 내부(L74 `PASSWORD_REQUIRED`, L81 `PASSWORD_INVALID`)이지 로그인 흐름이 아니다. `verifyPasswordForUser` 는 아직 `spec/5-system/1-auth.md` 어디에도 문서화돼 있지 않다 — 이는 `plan/complete/refactor-auth-reverify-unify.md` "범위 밖/후속" 목록(line 45~46: `verifyReauth` 에러 코드 및 `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 카탈로그 등재가 아직 완료되지 않은 항목으로 명시)이 이미 지적한 미결 갭이다. 이번 target 이 §1.2.1 에 `PASSWORD_INVALID` 를 신규 등재하면서 SoT 링크를 `1-auth.md §2.3`(verifyReauth) 하나로만 걸고 "로그인과 공용"이라는 **사실과 다른** 문구를 다는 것은, 이 PR 이 해소하려는 "미구현/미문서 대안을 정상 서술로 과대 표기하는 drift" 문제와 동일한 성격의 **새로운** drift 를 카탈로그에 심는 것이다. 향후 `PASSWORD_INVALID` 를 검색하는 개발자는 로그인 경로를 오인하게 되고, 실제 두 번째 소비자(2FA 비활성화/WebAuthn 복구코드 재발급)는 여전히 어느 문서에도 안 걸린 채 남는다.
  - 제안: (a) "로그인과 공용"/"재인증·로그인 공용" 문구를 삭제하거나 "재인증(§2.3)·2FA 비활성화/WebAuthn 복구코드 재발급(`AuthService.verifyPasswordForUser`) 공용" 으로 정정. (b) §1.2.1 표 행의 "도메인 SoT" 열도 `1-auth.md §2.3` 단독이 아니라 두 번째 소비자가 아직 도메인 spec 미문서임을 명시(§1.2.1 하단 note 의 "NOT_A_MEMBER·INVALID_PASSWORD 후속 추적" 패턴과 동일하게, `verifyPasswordForUser` 의 `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 도 같은 후속 목록에 편입하거나 최소한 "§1.4 미문서 상태"임을 각주로 남길 것). (c) 검증 각주의 "login `auth.service.ts:80`" 표기를 "`verifyPasswordForUser` (auth.service.ts:81, 2FA 비활성화/WebAuthn 복구코드 재발급)" 으로 정정.

- **[INFO]** `PASSWORD_REQUIRED` (동일 `verifyPasswordForUser` 헬퍼가 던지는 자매 코드, `auth.service.ts:74`) 는 카탈로그 미등재 상태로 완전히 방치
  - target 위치: 변경 2 전체 (§1.2.1 3행 추가 범위) — `PASSWORD_REQUIRED` 는 언급 없음
  - 충돌 대상: `plan/complete/refactor-auth-reverify-unify.md` "범위 밖/후속" line 46 — "`spec/5-system/3-error-handling.md §1` 에 `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 카탈로그 등재... (consistency WARNING#1·INFO#4)" 가 이미 남긴 후속 항목
  - 상세: 이번 target 은 `PASSWORD_INVALID` 를 (귀속은 부정확하지만) 카탈로그에 올리면서, 같은 헬퍼가 던지는 `PASSWORD_REQUIRED` 는 완전히 빠뜨린다. 위 WARNING 을 바로잡는 김에 이 자매 코드도 같이 처리하지 않으면 "절반만 해소된 후속" 이 하나 더 생긴다.
  - 제안: 이번 PR 범위를 넓혀 `verifyPasswordForUser`(2FA 비활성화/WebAuthn 복구코드 재발급) 를 `1-auth.md §1.4` 본문에 문서화하고 `PASSWORD_REQUIRED`/`PASSWORD_INVALID`(해당 귀속) 를 함께 등재하거나, 최소한 target 의 "범위 밖" 절에 "`PASSWORD_REQUIRED` 카탈로그 등재 — 별도 후속(`refactor-auth-reverify-unify.md` 후속 항목)" 한 줄을 추가해 미해소 상태를 명시적으로 유지할 것.

## 요약

target 의 §2.3 "강제 종료 재인증" 행 정정(WebAuthn/이메일 OTP 과대 서술 → password OR TOTP 실사용 정렬)은 코드(`sessions.service.ts` `verifyReauth`)·`Rationale 1.1.B-4`·`9-user-profile.md`(L116/341/342/397)·`data-flow/2-auth.md` §1.5 세션 revoke 서술과 모두 실측 대조해 정합하며, `REAUTH_REQUIRED`(400)/`PASSWORD_INVALID`(401)/`TOTP_INVALID`(401)/`REAUTH_NOT_AVAILABLE`(403) 의 status 값도 코드와 일치한다. 다만 `PASSWORD_INVALID` 를 "로그인과 공용" 으로 서술하는 부분은 실제 코드(로그인 실패는 `LOGIN_FAILED`, `PASSWORD_INVALID` 의 실제 두 번째 소비자는 `AuthService.verifyPasswordForUser`)와 어긋나는 새로운 drift이며, 이는 이 PR 자체가 해소하려는 문제(미구현/미문서 대안의 과대 서술)와 같은 성격이라 병합 전 정정이 필요하다. 그 외 데이터 모델·API 계약·상태 전이·RBAC·계층 책임 관점에서는 다른 영역과의 직접적 충돌은 발견되지 않았다.

## 위험도
MEDIUM
