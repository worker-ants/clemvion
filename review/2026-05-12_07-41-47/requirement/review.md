### 발견사항

---

**[CRITICAL] `emailOtp` 구현 누락 — 광고된 기능이 동작하지 않음**
- 위치: `backend/src/modules/auth/sessions.service.ts` `verifyReauth()` / `dto/requests/revoke-session.dto.ts`
- 상세: `RevokeSessionDto`는 `emailOtp` 필드를 정의하고 DTO 주석은 "OAuth-only + 2FA 미설정 사용자 → emailOtp 필수"라고 명시한다. 그러나 `verifyReauth`는 `!hasPassword && !has2fa` 분기에서 emailOtp 검증 없이 바로 `ForbiddenException(REAUTH_NOT_AVAILABLE)`를 던진다. 해당 사용자군은 UI에서 password 입력 창을 보고 → 서버 403을 받아 기능을 사용할 수 없다.
- 제안: `emailOtp` 검증 분기를 추가하거나, 미구현임을 명시하고 DTO에서 해당 필드·주석을 제거한다.

---

**[WARNING] 프론트엔드 `reauthMode` 가 "unavailable" 를 절대 발생시키지 않음**
- 위치: `frontend/src/app/(main)/profile/sessions/sessions-panel.tsx` L46-51 / `revoke-confirm-dialog.tsx`
- 상세: `reauthMode`는 `"totp" | "password"` 둘 중 하나만 반환한다. `"unavailable"` 분기는 다이얼로그에 구현되어 있지만 진입 경로가 없다. OAuth-only + 2FA 미설정 사용자는 password 입력창을 보고, 제출하면 서버 403을 받아 인라인 에러로 처리된다. `RevokeConfirmDialog`의 `reauthMode === "unavailable"` 코드와 `dialogReauthUnavailable` i18n 키는 사실상 dead path다.
- 제안: `user` 스토어에 `hasPassword` 힌트를 추가하거나, 서버 403(REAUTH_NOT_AVAILABLE) 응답을 받으면 다이얼로그 내부에서 `reauthMode`를 unavailable로 전환하도록 처리한다.

---

**[WARNING] 단일 세션 revoke 시 자신의 현재 세션도 API 레벨에서 종료 가능**
- 위치: `backend/src/modules/auth/sessions.service.ts` `revokeFamily()`
- 상세: 컨트롤러·서비스 모두 `familyId`가 현재 세션인지 검증하지 않는다. 사용자가 `DELETE /users/me/sessions/:currentFamilyId`를 호출하면 현재 세션이 종료된다. UI는 current 세션 행에 revoke 버튼을 숨기지만 API 레벨 보호는 없어 직접 호출 시 탈취처럼 동작한다.
- 제안: `revokeFamily`에서 `familyId === currentFamilyId` 이면 `BadRequestException(CANNOT_REVOKE_CURRENT_SESSION)` 반환; `currentFamilyId`는 refreshToken 쿠키에서 해시로 조회.

---

**[WARNING] `revokeMutation.onError` 의 throw — 토스트 + 인라인 에러 이중 노출**
- 위치: `sessions-panel.tsx` L77-80
- 상세: `onError` 콜백에서 `toast.error()` 후 다시 throw 한다. `mutateAsync`의 rejection이 `handleConfirm`의 catch로도 전달되어 토스트와 다이얼로그 인라인 에러가 동시에 표시된다. 또한 React Query의 `onError` 안에서 throw하면 React Query가 이를 잡지 않아 콘솔에 unhandled rejection 경고가 발생할 수 있다.
- 제안: `onError`에서는 toast만 표시하고 throw를 제거한다. 인라인 에러는 `handleConfirm`의 catch에서 처리하면 충분하다.

---

**[WARNING] `plan/in-progress/auth-sessions.md` 체크리스트와 실제 구현 불일치**
- 위치: `plan/in-progress/auth-sessions.md` Backend 체크리스트
- 상세: `refresh-token.entity.ts`, `login-history.entity.ts`, `utils/client-ip.ts`, `sessions.controller.ts` 등 이미 구현된 항목들이 `[ ]` 미완으로 표시되어 있다. plan 관리 규약(CLAUDE.md) 상 작업 단계마다 갱신해야 한다.
- 제안: 구현된 항목을 `[x]`로 갱신하고, 실제 미완성 항목(Swagger 반영 확인, ai-review + RESOLUTION.md)만 `[ ]`로 유지한다.

---

**[WARNING] `IsNull` 미사용 import — dead code**
- 위치: `backend/src/modules/auth/sessions.service.ts` 마지막 줄
- 상세: `IsNull`을 import하고 사용하지 않아 `void IsNull;`로 ESLint 경고를 우회한다. 임포트 자체를 제거하면 된다.
- 제안: import 목록에서 `IsNull` 제거.

---

**[INFO] 타임스탬프 기반 커서 페이지네이션 — 동일 밀리초 중복·누락 가능성**
- 위치: `backend/src/modules/auth/login-history.service.ts` `findForUser()`
- 상세: 커서가 `created_at < :cursor`로 구현되어 있다. 동일 밀리초에 여러 이벤트가 발생하면 커서 경계에서 일부 row가 누락될 수 있다. 실무적으로는 발생 빈도가 낮지만 배치 insert나 로드 테스트 환경에서 재현된다.
- 제안: 커서를 `(created_at, id)` 복합 키로 확장하거나, 현재 단순성을 유지하되 spec에 "동일 ms 건은 일부 누락 가능"을 명기한다.

---

**[INFO] 로그인 이력 pruner 가 서버 로컬 타임존 의존**
- 위치: `backend/src/modules/auth/jobs/login-history-pruner.service.ts`
- 상세: `@Cron(CronExpression.EVERY_DAY_AT_3AM)`는 서버 프로세스의 로컬 타임존을 기준으로 동작한다. 서버가 UTC로 실행되면 UTC 3시 기준이다. spec에 타임존 요건이 명시되지 않아 배포 환경에 따라 실행 시간이 달라진다.
- 제안: `ScheduleModule.forRoot({ timezone: 'Asia/Seoul' })` 등 명시적 timezone 설정을 추가하거나, spec에 UTC 기준임을 명기한다.

---

### 요약

핵심 기능인 활성 세션 조회·단일 revoke·일괄 revoke·로그인 이력 조회는 전반적으로 스펙에 맞게 구현되어 있다. 그러나 `RevokeSessionDto`에 명시된 `emailOtp` fallback이 서비스 계층에 구현되지 않아, OAuth-only + 2FA 미설정 사용자는 세션 종료 기능을 전혀 사용할 수 없다는 Critical 요구사항 누락이 존재한다. 프론트엔드의 `reauthMode` 결정 로직이 이 케이스를 탐지하지 못하므로 UI·서버 양쪽 모두 수정이 필요하다. 그 외 현재 세션 self-revoke 방지 미비, 이중 에러 노출, plan 체크리스트 불일치는 서비스 안정성과 운영 신뢰성 측면에서 보완이 필요하다.

### 위험도

**HIGH** — `emailOtp` 미구현으로 특정 사용자군의 보안 기능이 완전히 차단된다.