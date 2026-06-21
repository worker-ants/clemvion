# 아키텍처(Architecture) 리뷰 결과

## 발견사항

### [INFO] AuthService의 단일 책임 범위 확대 — 허용 가능한 수준
- 위치: `/codebase/backend/src/modules/auth/auth.service.ts` — `requestEmailChange`, `verifyEmailChange`, `resendEmailChange`, `cancelEmailChange`, `clearPendingEmailChange`, `isUniqueEmailViolation`
- 상세: `AuthService`가 이메일 변경 플로우(토큰 발급, 메일 발송, DB 롤백, 세션 revoke, 토큰 재발급, PostgreSQL 에러 감지)를 모두 담당한다. 단일 책임 원칙 관점에서 "이메일 변경 오케스트레이션" 자체는 단일 책임이나, 세션 관리(`revokeAllFamilies`, `generateTokens`)와 메일 발송(`MailService`)을 함께 조율하면서 `AuthService`의 책임이 점점 커지고 있다. 그러나 기존 비밀번호 변경 흐름(`changePassword`)도 동일 패턴으로 `AuthService`에 귀속되어 있고, NestJS 모듈 경계 내에서 적절히 위임(`SessionsService`, `MailService`, `UsersService`)하고 있어 현 단계에서는 허용 가능하다.
- 제안: 향후 프로파일 관련 플로우가 계속 추가된다면 `UserProfileService`나 `EmailChangeService`로 분리를 검토할 수 있다. 현재 규모에서는 INFO 수준.

---

### [INFO] `SessionsService.reauthenticate` — private 로직의 제한적 공개
- 위치: `/codebase/backend/src/modules/auth/sessions.service.ts` — `reauthenticate` (신규 public 메서드)
- 상세: 기존 `verifyReauth`(private)를 감싸는 `reauthenticate`(public)를 신설해 `AuthService`에서 호출한다. 이는 인터페이스 분리 관점에서 의도된 최소 인터페이스 노출이며, 내부 구현(`verifyReauth`)을 캡슐화하면서 `AuthService`가 재인증 로직을 직접 복제하지 않도록 하는 올바른 선택이다. 다만 `SessionsService`가 이제 `AuthService`의 요청에 응하는 부속 서비스처럼 되어, 두 서비스 간 결합도가 소폭 증가한다.
- 제안: JSDoc에 "현재 호출자: `AuthService.requestEmailChange`" 명시를 통해 의도된 호출자를 문서화. 다른 서비스가 임의로 호출하는 상황을 방지.

---

### [INFO] `clearPendingEmailChange` — public `cancelEmailChange`와 private helper의 이중 경로
- 위치: `/codebase/backend/src/modules/auth/auth.service.ts` L972–983
- 상세: `cancelEmailChange(userId)`는 `clearPendingEmailChange(userId)`를 한 줄로 위임하는 것 외에 아무 로직이 없다. 동시에 `verifyEmailChange` 내부(race condition 에러 경로, UNIQUE 위반 경로)에서도 `clearPendingEmailChange`를 직접 호출한다. 이는 SRP 측면에서 "외부 취소 엔드포인트"와 "내부 롤백 경로"를 명확히 구분하려는 의도로 이해되며, 올바른 설계다. 그러나 두 경로가 공유하는 헬퍼임이 명시되지 않아 독자가 계층을 추론해야 한다.
- 제안: `clearPendingEmailChange` JSDoc에 "내부 rollback helper — `cancelEmailChange`(public) 및 에러 경로(verifyEmailChange race)에서 공유" 한 줄 추가.

---

### [INFO] `isUniqueEmailViolation` — PostgreSQL 드라이버 에러 감지 로직이 도메인 서비스에 직접 위치
- 위치: `/codebase/backend/src/modules/auth/auth.service.ts` L985–989
- 상세: PostgreSQL 에러 코드(`23505`)를 직접 확인하는 로직이 `AuthService`(도메인 서비스)에 위치한다. 이는 추상화 수준 관점에서 인프라 레이어(DB 드라이버 코드)의 세부 사항이 비즈니스 레이어로 스며드는 사례다. 기존 코드베이스에서 동일한 패턴이 반복된다면 `shared/utils/db-error.ts` 같은 공통 유틸로 추출하는 것이 더 적절하다.
- 제안: `isUniqueEmailViolation` 또는 유사 함수를 `common/utils/` 또는 `shared/utils/`로 이동 고려. 단, 현재 이 파일에서만 사용되므로 INFO 수준.

---

### [INFO] `MessageResponseDto`의 배치 — users 모듈 내 범용 DTO
- 위치: `/codebase/backend/src/modules/users/dto/responses/user-response.dto.ts`
- 상세: `MessageResponseDto`는 단순 `{ message: string }` 응답 DTO로, 이메일 변경 3개 엔드포인트에서 사용된다. 현재 `users` 모듈의 응답 DTO 파일에 배치되어 있어, 향후 다른 모듈이 동일 구조를 필요로 할 때 `users` 모듈에 대한 의존성이 생긴다. 이는 모듈 경계의 순수성을 해칠 수 있다.
- 제안: 현재 단일 모듈 사용이라 즉각 이동 필요는 없으나, 재사용 시 `common/dto/message-response.dto.ts`로 이동 권장.

---

### [INFO] 레이어 책임 — 쿠키 set과 감사 로그를 controller 책임으로 명시 분리
- 위치: `/codebase/backend/src/modules/auth/auth.service.ts` — `verifyEmailChange` JSDoc
- 상세: `verifyEmailChange` JSDoc에 "감사(`user.email_changed`)·쿠키 set은 controller 책임"이라고 명시되어 있다. 이는 레이어 책임 분리가 잘 설계된 증거다. 서비스는 비즈니스 로직(토큰 검증, 이메일 교체, 세션 revoke)만 담당하고, HTTP 관련 부수 효과(쿠키, 감사 기록)는 controller에 위임된다.
- 제안: 현행 설계 유지. 모범 사례.

---

### [INFO] 프론트엔드 레이어 — verify 페이지의 `setAccessToken` 전역 상태 변경
- 위치: `/codebase/frontend/src/app/(main)/profile/change-email/verify/page.tsx`
- 상세: 이메일 변경 verify 성공 후 `setAccessToken(res.data.data.accessToken)`을 통해 전역 access token을 즉시 교체한다. 이는 기존 `change-password` 페이지와 동일한 패턴으로 일관성이 있다. 페이지 컴포넌트(프레젠테이션 레이어)가 전역 상태 변경(애플리케이션 레이어)을 직접 수행하므로 레이어 경계가 다소 혼재하지만, 현재 프로젝트 패턴에 부합한다.
- 제안: 현행 패턴 유지. 향후 상태 관리 레이어를 고려할 때 `useEmailChangeVerify` 같은 커스텀 훅으로 추출 가능.

---

### [INFO] 확장성 — 이메일 변경 플로우의 4-메서드 구조
- 위치: `/codebase/backend/src/modules/auth/auth.service.ts` — 이메일 변경 4개 메서드
- 상세: `requestEmailChange` → `verifyEmailChange` → `resendEmailChange` / `cancelEmailChange`의 상태 머신 패턴이 명확하게 분리되어 있다. 현재 구조는 각 전환에 독립 메서드가 대응하며, 향후 상태 추가(예: "변경 대기 만료 배치") 시 기존 메서드를 수정하지 않고 새 메서드를 추가하는 개방-폐쇄 원칙에 부합한다.
- 제안: 현행 설계 유지.

---

### [INFO] 순환 의존성 — `AuthService`↔`SessionsService`↔`UsersService` 방향성 명확
- 위치: `/codebase/backend/src/modules/auth/auth.service.ts`, `/codebase/backend/src/modules/auth/sessions.service.ts`
- 상세: `AuthService` → `SessionsService`, `AuthService` → `UsersService`, `SessionsService` → `UsersService` 방향으로 의존성이 단방향이다. `SessionsService`가 `AuthService`를 역으로 참조하지 않아 순환 의존성이 발생하지 않는다. 이번 변경에서 `reauthenticate` public 메서드 추가도 이 방향성을 유지한다.
- 제안: 이상 없음.

---

## 요약

이번 이메일 변경 구현은 기존 비밀번호 변경 플로우(`changePassword`, `rotateSessionAfterPasswordChange`)를 아키텍처 패턴 원형으로 삼아 일관성 있게 구성되어 있다. 레이어 책임 분리(service: 비즈니스 로직, controller: 쿠키/감사, DTO: 입력 검증)가 명확하며, 모듈 간 의존성 방향(`AuthService` → `SessionsService`/`UsersService`)이 단방향으로 유지되어 순환 의존성이 없다. `SessionsService.reauthenticate` 공개는 최소 인터페이스 노출로 적절하다. 주요 아키텍처 관찰 사항은 (1) PostgreSQL 에러 코드 감지(`isUniqueEmailViolation`)가 도메인 서비스에 직접 위치한 점, (2) `MessageResponseDto`가 users 모듈 내에 범용 DTO로 배치된 점, (3) `AuthService`의 책임 범위가 이메일 변경 플로우 추가로 점진적으로 확대되고 있는 점이며, 모두 즉각적인 구조 변경이 필요한 수준은 아닌 INFO 등급이다. CRITICAL 또는 WARNING 수준의 아키텍처 결함은 발견되지 않았다.

## 위험도

LOW

STATUS=success ISSUES=8 PATH=/Volumes/project/private/clemvion/.claude/worktrees/spec-email-change-0fcba4/review/code/2026/06/21/20_21_02/architecture.md RESET_HINT=
