## 발견사항

### [WARNING] 테스트에서 `process.env` 직접 변조 후 불완전한 복원
- **위치**: `auth-oauth.service.spec.ts` — `getEnabledProviders` describe 블록
- **상세**: `beforeEach`에서 `GOOGLE_CLIENT_ID`, `GITHUB_CLIENT_ID`를 설정하고 `afterAll`에서 `originalEnv`로 복원하지만, 각 테스트가 `delete process.env.GOOGLE_CLIENT_ID` 등을 수행한 뒤 `afterEach`에서 재설정하지 않는다. `getEnabledProviders` 테스트가 실행된 직후 `beginAuth` describe로 진입할 때 `beforeEach`가 재실행되므로 실제로는 무해하나, 테스트 순서가 바뀌거나 `--runInBand` 외 병렬 실행 환경에서 다른 테스트의 `process.env` 상태에 영향을 줄 수 있다.
- **제안**: 각 테스트 후 `afterEach`에서 환경 변수를 원래 값으로 복원하거나, `jest.replaceProperty(process, 'env', ...)` 또는 별도 `beforeEach`/`afterEach`로 스코프를 좁히는 것이 안전하다.

---

### [INFO] `getEnabledProviders`가 `process.env`를 런타임에 직접 읽음 (ConfigService 미사용)
- **위치**: `auth-oauth.service.ts:86-92`
- **상세**: NestJS 관례상 환경 변수는 `ConfigService`를 통해 읽지만, 이 메서드는 `process.env`를 직접 참조한다. 서비스 전체 수명 동안 환경 변수가 바뀔 경우(테스트·컨테이너 초기화 등) 매 호출마다 최신 값을 반환하는 건 의도된 동작이나, 일관성 측면에서 주의가 필요하다. 테스트에서도 이 점을 이용해 `process.env`를 직접 조작한다.
- **제안**: 현재 동작은 테스트 검증 목적과 부합하며 기능상 문제 없음. 다만 이미 `requireEnv`에서도 `process.env`를 직접 사용하고 있어 코드베이스 내 일관된 패턴이므로 현 상태 유지 가능.

---

### [INFO] `GET /auth/oauth/providers` 라우트 순서 — `/oauth/:provider`와의 충돌 가능성
- **위치**: `auth.controller.ts` — `getOauthProviders` (line ~376) vs `beginOauth` (line ~413)
- **상세**: NestJS는 라우트를 선언 순서대로 매칭하며, `oauth/providers`는 `oauth/:provider`보다 먼저 선언되어 있어 충돌은 없다. 단, 현재 `beginOauth`가 `ParseEnumPipe(OAUTH_PROVIDER_ENUM)`으로 `providers`를 걸러내기 때문에 순서가 바뀌어도 런타임 오류로 종결되지만, 선언 순서 의존성이 생긴 것은 인지할 필요가 있다.
- **제안**: 현재 순서 유지. 주석으로 순서 의존성을 명시해두면 향후 리팩토링 시 안전하다.

---

### [INFO] `Cache-Control: public, max-age=300` — 인증된 요청 경로에서의 캐싱
- **위치**: `auth.controller.ts:404`
- **상세**: 이 엔드포인트는 `@Public()` 데코레이터가 있고 반환 데이터도 비민감 정보(provider 이름)이므로 `public` 캐싱은 적절하다. 단, 향후 provider 목록을 동적으로 변경(환경 변수 교체 후 재시작 없이 반영 등)할 경우 CDN·프록시에 5분간 stale 응답이 제공될 수 있음을 감안해야 한다.
- **제안**: 현재 사용 패턴에서는 문제없음. 프로덕션에서 환경 변수 변경이 즉시 반영되어야 하는 요구사항이 생기면 `no-store` 또는 짧은 `max-age`로 조정 필요.

---

### [INFO] `fetchEnabledOauthProviders`에서 `NEXT_PUBLIC_API_URL` 서버 컴포넌트 사용
- **위치**: `frontend/src/lib/api/auth-providers.ts:11`
- **상세**: `NEXT_PUBLIC_*` 변수는 클라이언트 번들에 인라인되도록 설계되어 있으나, 서버 컴포넌트에서도 동작한다. 단, 서버→백엔드 내부 통신 시에는 `NEXT_PUBLIC_API_URL` 대신 내부 네트워크 주소(`INTERNAL_API_URL` 등)를 사용하는 것이 일반적이다. 현재는 로컬호스트 기본값(`http://localhost:3011/api`)이 있어 개발 환경에서는 무해하지만, 컨테이너/쿠버네티스 환경에서는 서버→서버 호출이 외부 URL을 경유할 수 있다.
- **제안**: 프로덕션 배포 시 서버 컴포넌트용 내부 API URL 환경 변수(`INTERNAL_API_URL`)를 별도로 두는 것을 권장.

---

## 요약

이번 변경은 OAuth provider 목록을 백엔드에서 동적으로 조회하여 SSO UI를 조건부 렌더링하는 기능을 추가한 것으로, 전반적으로 부작용이 잘 제어되어 있다. 기존 함수 시그니처(`LoginForm`, `RegisterForm`)는 `enabledProviders` prop이 옵셔널(`default = []`)로 추가되어 하위 호환성이 유지되며, 새 엔드포인트는 기존 라우트와 충돌하지 않는다. 가장 주의할 점은 테스트에서 `process.env`를 직접 조작하는 패턴인데, `beforeEach`가 매 테스트 전에 재설정해주므로 현재는 안전하나 테스트 격리 관점에서 명시적 복원을 권장한다.

## 위험도

**LOW**