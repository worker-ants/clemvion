## API Contract Code Review

### 발견사항

- **[WARNING]** `verifyEmail` 내 워크스페이스 생성 로직이 서비스 계층 간 책임을 침범함
  - 위치: `auth.service.ts` - `verifyEmail()` 내부 트랜잭션 블록
  - 상세: `AuthService`가 `Workspace`, `WorkspaceMember` 엔티티를 직접 조작하고 있음. `WorkspacesService`를 우회하여 인증 서비스가 워크스페이스 생성 로직(slug 생성 포함)을 중복 구현함. 향후 워크스페이스 생성 정책(예: slug 규칙, 기본 설정값)이 변경되면 두 곳을 모두 수정해야 하는 문제가 생김
  - 제안: `WorkspacesService.createPersonalWorkspace()`를 트랜잭션 매니저를 받을 수 있도록 수정하거나, `AuthService`의 트랜잭션 내에서 `WorkspacesService`를 호출하되 `EntityManager`를 주입하는 방식으로 일원화

- **[WARNING]** `generateTokens`가 이메일 인증 완료 직후에도 `findOrCreatePersonalWorkspace`를 재호출함
  - 위치: `auth.service.ts` - `verifyEmail()` → `generateTokens()` 흐름
  - 상세: `verifyEmail`은 트랜잭션 내에서 워크스페이스를 이미 생성하지만, 이후 `generateTokens`를 호출하면 내부에서 `findOrCreatePersonalWorkspace`가 다시 실행됨. `findPersonalWorkspace`가 트랜잭션 커밋 전에 조회될 경우 격리 수준에 따라 중복 생성 시도 가능성이 있으며, 불필요한 DB 쿼리가 발생함
  - 제안: `verifyEmail` 흐름에서는 이미 생성된 워크스페이스 정보를 `generateTokens`에 직접 전달하도록 시그니처 변경 고려

- **[INFO]** `findOrCreatePersonalWorkspace`는 TOCTOU(Time-of-Check-Time-of-Use) 경쟁 조건에 노출될 수 있음
  - 위치: `workspaces.service.ts` - `findOrCreatePersonalWorkspace()`
  - 상세: `findPersonalWorkspace` 조회 후 `createPersonalWorkspace` 호출 사이에 동시 요청이 들어오면 중복 생성이 발생할 수 있음. `slug`에 unique 제약이 있더라도 DB 오류가 클라이언트에게 그대로 노출될 수 있음
  - 제안: DB 레벨의 unique 제약(ownerId + type)을 추가하고, 중복 키 오류를 catch하여 기존 레코드를 반환하는 upsert 패턴 적용

- **[INFO]** `verifyEmail` API 응답 구조 변화 없음 — 하위 호환성 유지
  - 위치: `auth.service.ts`
  - 상세: `POST /auth/verify-email` 응답(`accessToken`, `refreshToken`)은 변경 없음. 클라이언트에게 breaking change 없음

- **[INFO]** 테스트에서 `private` 메서드를 `as never` 캐스팅으로 스파이하는 패턴
  - 위치: `auth.service.spec.ts` - `verifyEmail` 테스트 블록
  - 상세: `jest.spyOn(service as never, 'findUserByVerifyToken' as never)` 패턴은 타입 안전성을 우회함. API 계약에 직접적인 영향은 없으나 리팩터링 시 테스트가 자동으로 깨지지 않아 회귀 탐지 능력이 저하됨
  - 제안: `findUserByVerifyToken`을 `protected`로 변경하거나, Repository mock을 통해 간접적으로 제어하는 방식으로 전환

---

### 요약

이번 변경은 이메일 인증 완료 시 워크스페이스 생성을 원자적 트랜잭션으로 처리하고, 로그인 시에도 워크스페이스가 없으면 자동 생성하는 방향으로 개선된 것으로, API 계약(응답 구조, HTTP 상태 코드, 하위 호환성)은 유지되고 있습니다. 다만 `AuthService`가 `Workspace`/`WorkspaceMember` 엔티티를 직접 조작하는 책임 분리 위반과, `verifyEmail` → `generateTokens` 흐름에서 워크스페이스 생성 후 재조회하는 이중 처리 문제가 중기적으로 유지보수 부채가 될 수 있으며, 동시 요청 시 TOCTOU 경쟁 조건에 대한 방어 로직이 부재합니다.

### 위험도
**MEDIUM**