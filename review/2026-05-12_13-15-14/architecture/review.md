## 발견사항

### [WARNING] AuthService에서 EntityManager를 WorkspaceInvitationsService로 직접 전달

- **위치**: `auth.service.ts` `registerWithInvitation()` → `invitationsService.consumeForRegistration(manager, ...)`
- **상세**: `AuthService`가 자신의 트랜잭션 `EntityManager`를 `WorkspaceInvitationsService`에 넘기는 패턴은 두 서비스를 영속성 레이어에서 암묵적으로 결합시킵니다. `WorkspaceInvitationsService`는 원래 자신의 DB 생명주기를 스스로 관리하는 독립 서비스인데, 이 패턴은 그 불변을 깨뜨립니다. 호출자가 피호출자의 데이터 레이어 내부를 알아야 하는 **레이어 역전 냄새(layered abstraction leak)** 입니다.
- **제안**: 두 가지 대안 중 하나를 선택합니다. (A) `consumeForRegistration`에 `DataSource`를 직접 주입하고 독자 트랜잭션을 열되, 사용자 행 생성과 초대 소비를 **이벤트 기반(도메인 이벤트)** 으로 결합 분리합니다. (B) 현 구조를 유지하되 메서드명을 `consumeForRegistrationInTransaction`으로 명시해서 호출자가 트랜잭션 컨텍스트를 반드시 제공해야 함을 계약으로 표현합니다.

---

### [WARNING] AuthService 생성자 의존성 과부하 (God Service 징후)

- **위치**: `auth.service.ts` constructor — `DataSource`, `UsersService`, `WorkspacesService`, `WorkspaceInvitationsService`, `MailService`, `RefreshToken Repository`, `JwtService`, `LoginHistoryService`, `ConfigService` (9개+)
- **상세**: `WorkspaceInvitationsService` 추가로 의존성이 9개를 넘습니다. 생성자가 이 정도 규모에 달하면 단일 책임 원칙(SRP) 위반의 신호입니다. 현재 `AuthService`는 일반 가입, 초대 기반 가입, 이메일 인증, 로그인, TOTP, 토큰 갱신, 비밀번호 재설정, 워크스페이스 컨텍스트 해석까지 모두 처리합니다.
- **제안**: 단기적으로는 `registerWithInvitation` + `resolveTokenWorkspaceContext`를 `InvitationRegistrationService`(또는 `AuthRegistrationService`)로 분리하는 것이 가장 영향 범위가 작습니다. 중장기적으로는 Auth 도메인을 `AuthTokenService` / `AuthSessionService` / `AuthRegistrationService`로 분할하는 리팩토링을 고려하세요.

---

### [WARNING] register() 유니온 반환 타입 — 암묵적 덕 타이핑

- **위치**: `auth.service.ts:52-55`, `auth.controller.ts:131-140`
- **상세**: `Promise<{ message } | { message; accessToken; refreshToken }>` 유니온은 컨트롤러에서 `'accessToken' in result` 덕 타이핑으로 분기됩니다. 타입 안전성은 확보되지만, 향후 세 번째 분기(예: MFA 필요)가 추가되면 `in` 체크 체인이 늘어나고 컨트롤러가 서비스 내부 구조에 의존하게 됩니다.
- **제안**: 판별 리터럴 필드를 추가합니다.
  ```ts
  type RegisterResult =
    | { kind: 'pending_verification'; message: string }
    | { kind: 'auto_login'; message: string; accessToken: string; refreshToken: string };
  ```
  컨트롤러는 `result.kind`로 분기하면 구조적 변경에 안전합니다.

---

### [WARNING] getMetaByToken 이중 호출 — 초대 행 중복 조회

- **위치**: `auth.service.ts registerWithInvitation()` 내에서 `invitationsService.getMetaByToken(invitationToken)` 호출 후, 이어서 `consumeForRegistration()` 내부에서도 동일 토큰으로 `invitationRepo.findOne({ where: { token } })` 재조회
- **상세**: 하나의 가입 요청에서 초대 행을 두 번 읽습니다. 성능 문제보다 **TOCTOU(Time-of-Check-Time-of-Use)** 창이 두 배가 되는 것이 구조적 문제입니다. 두 조회 사이 토큰이 만료되거나 소비되는 경우 오류 메시지가 일관되지 않게 됩니다.
- **제안**: `getMetaByToken`이 반환한 메타(또는 엔티티 자체)를 `consumeForRegistration`에 넘기거나, 이메일 일치 검증을 `consumeForRegistration` 내부로 이전하여 단일 조회로 통합합니다.

---

### [WARNING] 오류 코드 명명 불일치

- **위치**: `workspace-invitations.service.ts` 전반
- **상세**: 리팩토링 전후에 두 가지 스타일이 섞여 있습니다. `INVITATION_NOT_FOUND` / `ADMIN_REQUIRED` (대문자, 구 코드)와 `invitation_not_found` / `invitation_email_mismatch` (소문자, 신규 코드)가 동일 파일에 공존합니다. 프론트엔드가 오류 코드로 분기할 경우 케이스 불일치로 버그가 발생합니다.
- **제안**: `revoke()`, `resend()`, `assertAdmin()`의 구 코드 오류를 소문자 스네이크 케이스로 일괄 정렬하거나, 공통 상수 enum을 정의하여 두 서비스가 공유하게 합니다.

---

### [INFO] InvitationsController의 모듈 귀속 재검토 여지

- **위치**: `workspaces.module.ts`, `invitations.controller.ts`
- **상세**: `GET /invitations/:token`은 인증 없는 공개 엔드포인트로, 회원가입 페이지의 프리필용입니다. 이 엔드포인트는 워크스페이스 관리 컨텍스트보다 인증 플로우 컨텍스트에 더 가깝습니다. `WorkspacesModule`에 배치되어 있어 `@Global()` 덕에 DI는 해결되지만, 개념적 경계가 흐립니다.
- **제안**: 현재 구조는 기능적으로 문제없습니다. 다만 향후 `WorkspacesModule`의 `@Global()` 제거를 고려할 경우, `InvitationsController`를 `AuthModule`로 이전하거나 별도 `InvitationsModule`로 분리하면 경계가 명확해집니다.

---

### [INFO] resend()에서 workspace 재조회

- **위치**: `workspace-invitations.service.ts resend()` 약 190행
- **상세**: `resend()`는 `invitationId`로 초대를 찾은 뒤 `invitation.workspaceId`로 workspace를 재조회합니다. `workspaceId`는 메서드 파라미터로 이미 넘어와 있고, 권한 확인(`assertAdmin`)에도 사용되었으므로 별도 조회 없이 파라미터를 그대로 쓸 수 있습니다.
- **제안**: `workspaceRepository.findOne({ where: { id: workspaceId } })` 재조회를 제거하고, `resend`의 `workspaceId` 파라미터를 `dispatchEmail` 호출 시 그대로 전달합니다 (workspace 이름이 필요하다면 `invite` 로직처럼 상단에서 한 번만 조회).

---

## 요약

이번 변경의 핵심인 초대 토큰 기반 가입 플로우는 트랜잭션 원자성(`applyAccept` + `consumeForRegistration`), 동시성 안전(`UPDATE ... WHERE accepted_at IS NULL`), 토큰 재발급 정책(단일 pending row 덮어쓰기) 모두 잘 설계되었습니다. `resolveTokenWorkspaceContext`의 3단계 폴백 로직과 `dispatchEmail` 헬퍼 추출도 응집도 면에서 긍정적입니다. 다만 두 가지 구조적 부채가 누적되고 있습니다: (1) `AuthService`가 `WorkspaceInvitationsService`의 `EntityManager` 계약에 의존하면서 두 서비스가 영속성 레이어에서 결합되는 점, (2) `AuthService` 생성자가 9개 이상의 의존성을 가지면서 God Service로 발전할 위험성. 현 기능 규모에서는 동작하지만, 다음 인증 플로우 확장 전에 `AuthService`의 책임을 분리하는 것을 권장합니다.

## 위험도

**MEDIUM**