## 유지보수성 코드 리뷰

### 발견사항

---

**[WARNING] `OAuthProvider` 타입 중복 정의**
- 위치: `login-form.tsx:35`, `register-form.tsx:38`, `auth-providers.ts:9`
- 상세: `OAuthProvider = "google" | "github"` 타입이 세 파일에 독립적으로 선언되어 있음. provider 종류가 변경될 때 세 곳을 모두 수정해야 하며, backend의 `AUTH_OAUTH_PROVIDERS` 상수와도 분리되어 있음.
- 제안: `auth-providers.ts`의 `OAuthProvider`를 단일 소스로 사용하고, 폼 컴포넌트에서 `import type { OAuthProvider } from "@/lib/api/auth-providers"`로 참조.

---

**[WARNING] SSO UI 렌더링 로직 중복 (`LoginForm` / `RegisterForm`)**
- 위치: `login-form.tsx:159–204`, `register-form.tsx:198–243`
- 상세: "Or continue with" 구분선 + provider 버튼 그리드 구조가 두 컴포넌트에 픽셀 단위로 동일하게 복사되어 있음. 버튼 라벨, 레이아웃, 아이콘 추가 등 변경 시 두 곳을 동시에 수정해야 함.
- 제안: `OAuthButtons` 컴포넌트로 분리하여 `enabledProviders` prop을 받고, 두 폼에서 공유.

```tsx
// components/auth/oauth-buttons.tsx
export function OAuthButtons({ providers }: { providers: OAuthProvider[] }) { ... }
```

---

**[WARNING] `RegisterForm`의 기본 파라미터 구문 이중 지정**
- 위치: `register-form.tsx:63`
- 상세: `export function RegisterForm({ enabledProviders = [] }: RegisterFormProps = {})` — 함수 시그니처에 `= {}`가 붙어 있음. `LoginForm`은 이 패턴을 사용하지 않아 두 컴포넌트 간 일관성이 깨짐. `= {}`는 컴포넌트가 props 없이 호출될 때를 위한 것이지만 React에서는 관례적이지 않고 혼란을 줌.
- 제안: `LoginForm`처럼 `= {}`를 제거하고 `{ enabledProviders = [] }: RegisterFormProps`만 사용.

---

**[WARNING] `getEnabledProviders`의 `process.env` 직접 접근**
- 위치: `auth-oauth.service.ts:80–86`
- 상세: `ConfigService`가 이미 주입되어 있음에도 `getEnabledProviders`는 `process.env`를 직접 읽음. 동일 클래스 내 `requireEnv`, `exchangeCodeForToken`, `fetchProfile`, `redirectUri` 등도 `process.env`를 직접 사용하는 일관되지 않은 패턴이 존재하지만, 신규 메서드도 동일 패턴을 따르므로 일관성 자체는 유지됨. 다만 테스트에서 `ConfigService` mock이 아닌 `process.env` 조작이 필요한 이유가 불명확함.
- 제안: 클래스 전체 차원의 리팩토링이 필요한 사항이므로 현재 변경 범위에서는 INFO 수준으로 허용 가능. 단, 신규 메서드에서만큼은 ConfigService 사용을 권장.

---

**[INFO] `getEnabledProviders` 테스트의 `process.env` 조작이 `beforeEach` 리셋과 충돌 가능성**
- 위치: `auth-oauth.service.spec.ts:137–157`
- 상세: 각 테스트가 `process.env`를 직접 수정하고, `beforeEach`가 `OAUTH_STUB_MODE=true`로 리셋하지만 `afterEach`에서 env를 원복하지 않음. 테스트 실행 순서에 따라 `delete process.env.GOOGLE_CLIENT_ID`가 다음 테스트에 영향을 줄 수 있음. `afterAll`의 `process.env = originalEnv`가 최종 복구를 담당하지만, 동일 describe 블록 내 다른 테스트와 격리가 완전하지 않음.
- 제안: `getEnabledProviders` describe 블록에 `afterEach(() => { process.env = { ...originalEnv }; })`를 추가하여 env 조작을 격리.

---

**[INFO] `Cache-Control` 매직 스트링 / 상수 분산**
- 위치: `auth.controller.ts:374`, `auth-providers.ts:19`
- 상세: `max-age=300`과 `revalidate: 300`이 각각 backend controller와 frontend fetch 함수에 하드코딩되어 있음. 값 자체는 spec과 일치하나, 캐시 TTL 변경 시 두 곳을 찾아야 함. 주석으로 연관성은 명시되어 있어 현재 코드베이스 규모에서는 허용 가능.
- 제안: 단기적으로는 현 상태 유지 가능. 공유 설정이 필요해지면 각각의 상수 선언으로 의도를 명시: `const PROVIDERS_CACHE_TTL_SEC = 300`.

---

**[INFO] `fetchEnabledOauthProviders`의 `NEXT_PUBLIC_API_URL` 환경변수**
- 위치: `auth-providers.ts:12`
- 상세: 이 함수는 Next.js Server Component에서만 호출되는데, `NEXT_PUBLIC_` 접두사는 클라이언트 번들에 노출되는 변수임을 의미. Server Component 전용 호출이라면 `NEXT_PUBLIC_` 없는 서버 전용 변수를 사용하는 것이 더 정확한 의도 전달.
- 제안: 기존 코드베이스 전반이 `NEXT_PUBLIC_API_URL`을 사용하는 패턴이라면 일관성을 위해 유지. 새로운 파일에서만 달리 처리하면 오히려 혼란.

---

### 요약

이번 변경은 OAuth provider 활성화 여부를 서버에서 조회하여 UI를 동적으로 제어하는 기능을 추가한 것으로, 전체적인 설계 방향과 구현 품질은 양호하다. 스펙 문서, backend API, frontend 컴포넌트, 테스트가 일관되게 구현되었고 실패 시 안전 기본값 처리도 갖추고 있다. 주요 유지보수성 문제는 `OAuthProvider` 타입의 세 곳 중복 정의와 `LoginForm`/`RegisterForm` 간 SSO UI 렌더링 로직의 복제로, provider가 추가되거나 UI가 변경될 때 변경점이 분산된다. `RegisterForm`의 `= {}` 기본값 구문은 `LoginForm`과의 불일치를 만들며, `getEnabledProviders` 테스트의 env 격리 미흡은 테스트 순서 의존성 리스크를 내포한다. 이 중 타입 중복과 UI 로직 복제는 Warning 수준으로 조기에 해결하는 것이 권장된다.

### 위험도

**LOW**