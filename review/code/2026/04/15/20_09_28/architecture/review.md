## 아키텍처 코드 리뷰

### 발견사항

---

- **[WARNING]** 트랜잭션 원자성 훼손 — `resolveUser`의 사용자 생성이 트랜잭션 밖에서 실행됨
  - 위치: `auth-oauth.service.ts` — `resolveUser()` 메서드
  - 상세: `dataSource.transaction(manager => ...)` 블록 내에서 `usersService.create()`는 자체 주입된 `userRepository`를 사용하며, `manager`를 통하지 않는다. `workspacesService.createPersonalWorkspace`는 `manager`를 전달받아 트랜잭션에 포함되지만, 사용자 생성은 포함되지 않는다. 워크스페이스 생성 실패 시 사용자 레코드는 롤백되지 않아 워크스페이스 없는 고아 사용자(orphaned user)가 생성될 수 있다. `AuthService.verifyEmail`에서는 `manager.getRepository(User)`를 통해 이 문제를 올바르게 처리하고 있으나, 여기서는 일관성이 깨져 있다.
  - 제안: `UsersService`에 `createWithManager(data, manager: EntityManager)` 오버로드를 추가하거나, `resolveUser` 내에서 `manager.getRepository(User).save(...)`를 직접 사용하여 두 작업이 동일한 트랜잭션 내에서 실행되도록 수정

---

- **[WARNING]** 개방-폐쇄 원칙(OCP) 위반 — `fetchProfile`의 프로바이더별 분기
  - 위치: `auth-oauth.service.ts` — `fetchProfile()` 메서드
  - 상세: 메서드 내부에 `if (provider === 'google') { ... } // GitHub` 형태의 대형 분기가 존재한다. 새 프로바이더(예: Kakao, Apple) 추가 시 이 메서드를 직접 수정해야 한다. `AUTHORIZE_URLS`, `TOKEN_URLS`, `SCOPES` 는 레코드 맵으로 잘 추상화되어 있으나, 프로필 패칭 로직만 분기로 남아 설계 불일치가 있다.
  - 제안: 각 프로바이더를 `fetchProfile(accessToken): Promise<OauthProfile>` 메서드를 가진 Strategy 클래스로 추출하고 `Map<AuthOAuthProvider, OAuthProviderStrategy>`로 관리

---

- **[WARNING]** `generateTokens`의 가시성 변경이 암묵적 API 계약을 형성함
  - 위치: `auth.service.ts` — `generateTokens()` 가시성 `private → public`
  - 상세: 이 변경은 `AuthOauthService`에서 호출하기 위한 목적으로만 이루어졌다. `private` 헬퍼가 `public`이 되면 외부에서 무제한으로 호출 가능하게 되어, `AuthService`의 내부 구현 세부 사항이 공개 API로 노출된다. 동일 모듈 내에서는 즉각적 문제가 없으나, 향후 `AuthService`를 소비하는 다른 모듈이 이 메서드를 오용할 위험이 있다.
  - 제안: 토큰 발급 로직을 `TokenService`(또는 `AuthTokenService`)로 분리하고, `AuthService`와 `AuthOauthService` 양쪽에서 이를 주입받아 사용. 이렇게 하면 단일 책임 원칙도 강화됨

---

- **[WARNING]** 설정 접근 패턴 불일치 — `ConfigService` vs `process.env` 혼용
  - 위치: `auth-oauth.service.ts` — `requireEnv()`, `exchangeCodeForToken()`, `fetchProfile()` 전반
  - 상세: `redirectUri()`에서는 `configService.get('app.url')`을 사용하지만, OAuth 클라이언트 자격증명(`GOOGLE_CLIENT_ID` 등)과 `OAUTH_STUB_MODE`는 `process.env`에서 직접 읽는다. 이는 NestJS의 구성 레이어를 우회하여 테스트 격리를 어렵게 하고, 설정 검증 시점을 분산시킨다. 실제로 테스트 코드(`auth-oauth.service.spec.ts`)에서도 `process.env.OAUTH_STUB_MODE = 'true'`를 직접 설정하는 방식으로 우회하고 있다.
  - 제안: 모든 환경 변수를 `ConfigService`로 통일. `OAUTH_STUB_MODE`를 config 팩토리에 등록하고 `configService.get<boolean>('oauth.stubMode')`로 접근

---

- **[INFO]** `mapOauthError` 함수의 위치 — 비즈니스 로직이 컨트롤러 파일에 위치
  - 위치: `auth.controller.ts` — 파일 최하단 모듈 수준 함수
  - 상세: OAuth 에러 코드를 프론트엔드 오류 코드로 매핑하는 로직은 비즈니스 도메인 지식에 해당하며, 프레젠테이션 레이어보다는 서비스 레이어에 위치하는 것이 계층 책임 분리 원칙에 부합한다. 컨트롤러는 HTTP 관심사(리다이렉트, 쿠키)에 집중해야 한다.
  - 제안: `AuthOauthService`로 이동하거나 `auth-oauth.errors.ts` 유틸리티로 분리

---

- **[INFO]** URL 파라미터를 통한 Access Token 전달 — 보안-아키텍처 트레이드오프
  - 위치: `auth.controller.ts` — `oauthCallback()`, `spec/2-navigation/10-auth-flow.md §5.3`
  - 상세: 스펙에 명시된 결정이나, `?token={accessToken}`으로 URL에 토큰을 노출하면 브라우저 히스토리, 서버 접근 로그, Referrer 헤더에 토큰이 기록된다. 클라이언트가 즉시 `history.replaceState`로 URL을 정리해야만 위험이 완화된다. 프론트엔드의 `/callback` 페이지 구현이 이를 반드시 준수해야 한다.
  - 제안: 현재 설계를 유지하되, `/callback` 페이지에서 토큰 처리 직후 `window.history.replaceState({}, '', '/dashboard')` 실행을 명시적으로 스펙에 요구사항으로 추가하고 구현 검증 필요

---

- **[INFO]** 만료된 상태 레코드의 정리 방식 — 지연(lazy) 정리의 한계
  - 위치: `auth-oauth.service.ts` — `purgeExpired()` 호출 (`void this.purgeExpired()`)
  - 상세: 만료된 상태 레코드는 `beginAuth` 호출 시에만 비동기로 정리된다. OAuth 플로우가 시작되지 않으면 레코드가 누적된다. 현재 규모에서는 큰 문제가 아니나, DB 인덱스(`idx_auth_oauth_state_expires`)가 잘 구성되어 있어 쿼리 성능은 보장된다. `IntegrationOAuthState` 등 기존 패턴과 일관성이 있는지 확인 필요.
  - 제안: BullMQ 스케줄러를 활용한 주기적 정리 Job 추가(선택적), 또는 현행 유지

---

### 요약

이번 변경은 OAuth 인증 플로우를 `AuthOauthService`로 명확히 분리하고 CSRF 방어를 위한 state 패턴을 원자적 DELETE+RETURNING으로 구현한 견고한 설계다. 전반적인 모듈 구조와 계층 분리는 적절하며 기존 아키텍처와 일관성을 유지한다. 다만 두 가지 핵심 문제가 존재한다: `resolveUser`의 트랜잭션 범위 오류로 고아 사용자가 생성될 수 있는 데이터 정합성 문제와, `generateTokens` 공개화 및 `fetchProfile` 분기 구조로 인한 확장성 제약이다. 설정 접근 패턴의 불일치(`ConfigService` vs `process.env` 혼용)는 테스트 복잡도를 높이는 기술 부채로 향후 해결이 권장된다.

### 위험도

**MEDIUM** (트랜잭션 원자성 이슈로 인해 — 신규 OAuth 사용자 등록 시 워크스페이스 없는 계정 생성 가능)