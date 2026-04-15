## 아키텍처 코드 리뷰

### 발견사항

---

**[WARNING]** `getEnabledProviders`가 `ConfigService`를 우회하여 `process.env`를 직접 읽음
- 위치: `auth-oauth.service.ts:80-87`
- 상세: NestJS의 `ConfigService`가 주입되어 있음에도 불구하고 `getEnabledProviders`와 `exchangeCodeForToken`, `fetchProfile` 내부에서 `process.env.*`에 직접 접근. `ConfigService`가 타입 안전성, 검증, 변환 계층을 제공함에도 이를 일관성 없이 혼용하고 있음. 서비스 내 환경 읽기 방식의 이중성은 설정 관리 단일 책임을 위반함.
- 제안: `ConfigService.get<string>('oauth.stubMode')` 등으로 통일. 최소한 `getEnabledProviders`라도 `ConfigService`를 통해 읽도록 수정.

---

**[WARNING]** 프론트엔드 `auth-providers.ts`에서 `NEXT_PUBLIC_API_URL` 환경변수를 `login-form.tsx`와 중복 정의
- 위치: `auth-providers.ts:11`, `login-form.tsx:33`, `register-form.tsx:38`
- 상세: `API_BASE_URL` 상수가 세 파일에 각각 독립적으로 선언됨. 중앙화된 API 클라이언트(`authApi`, `usersApi`)가 이미 `@/lib/api/client`를 통해 존재하는 상황에서 일관성 없는 URL 관리 패턴. 특히 `auth-providers.ts`는 서버 컴포넌트용으로 raw `fetch`를 쓰는 것은 이해되나, 환경변수 상수는 공유되어야 함.
- 제안: `@/lib/api/config.ts` 또는 기존 클라이언트 설정에서 `API_BASE_URL`을 단일 source of truth로 export.

---

**[WARNING]** `Cache-Control` 헤더 직접 조작 — NestJS 응답 추상화 우회
- 위치: `auth.controller.ts:376`, `auth.controller.spec.ts:98-103`
- 상세: `res.setHeader('Cache-Control', 'public, max-age=300')`를 컨트롤러에서 직접 호출. NestJS의 `@Header()` 데코레이터나 인터셉터를 통해 처리 가능한 것을 명령형으로 처리. `@Res({ passthrough: true })`와 함께 사용하더라도 추상화 일관성이 깨짐. 캐싱 정책이 로직에 하드코딩되어 변경 시 컨트롤러를 수정해야 함.
- 제안: `@Header('Cache-Control', 'public, max-age=300')` 데코레이터 사용 → `res` 매개변수 제거 가능하여 테스트도 단순화됨.

---

**[INFO]** `OAuthProvider` 타입이 프론트엔드 내 두 곳에 중복 선언
- 위치: `auth-providers.ts:8`, `login-form.tsx:35`, `register-form.tsx:38`
- 상세: `type OAuthProvider = "google" | "github"`가 세 파일에 각각 정의. `auth-providers.ts`에 이미 export된 타입이 있음에도 각 컴포넌트가 독립적으로 재선언. 타입의 단일 소유권 원칙 위반.
- 제안: `login-form.tsx`와 `register-form.tsx`에서 로컬 타입 선언을 제거하고 `import type { OAuthProvider } from "@/lib/api/auth-providers"` 사용.

---

**[INFO]** 서버 컴포넌트→클라이언트 컴포넌트 경계에서 props drilling 패턴 — 허용 가능하나 확장성 제한
- 위치: `login/page.tsx`, `register/page.tsx` → `LoginForm`, `RegisterForm`
- 상세: `enabledProviders`를 서버에서 fetch 후 클라이언트 컴포넌트에 prop으로 내려주는 패턴은 Next.js App Router의 권장 방식. 현재는 1단계라 문제없음. 단, 향후 OAuth 관련 중간 컴포넌트가 생기면 drilling이 깊어질 수 있음.
- 제안: 현 구조 유지. 복잡도 증가 시 서버 컴포넌트를 래퍼로 분리하는 Composition 패턴 고려.

---

**[INFO]** `getEnabledProviders` 메서드가 동기식 — 테스트에서 `process.env` 직접 변조
- 위치: `auth-oauth.service.spec.ts:134-159`
- 상세: 테스트가 `process.env`를 직접 수정하여 동작을 제어. `beforeEach`에서 세팅하고 각 `it`에서 다시 변경하는 패턴은 테스트 격리를 `afterEach`의 `clearAllMocks`에 의존하지 않고 환경 변수에 의존. `afterAll`에서 `process.env = originalEnv`로 복원하지만 spread로 복사한 객체이므로 런타임에 따라 불완전할 수 있음.
- 제안: `jest.replaceProperty(process, 'env', {...})` 또는 `jest.spyOn`으로 `process.env` 접근을 격리. 근본적으로는 `ConfigService`를 통해 읽으면 mock이 자연스러워짐.

---

### 요약

이번 변경은 "백엔드에서 활성화된 OAuth provider 목록을 내려주고 프론트엔드가 이를 받아 UI를 조건부 렌더링한다"는 명확한 아키텍처 의도를 가지며, 레이어 분리(서버 컴포넌트에서 fetch → 클라이언트 컴포넌트에 props 전달)와 안전한 실패 처리(빈 배열 fallback)가 잘 설계되어 있다. 다만, 서비스 내 `process.env` 직접 접근과 `ConfigService` 혼용, `OAuthProvider` 타입 중복 선언, `Cache-Control` 헤더의 명령형 설정 등 일관성 부족 문제가 있으며, 이는 코드베이스 규모가 커질수록 관리 부담으로 이어질 수 있다. 전반적으로 기능 구현은 충실하나 설정 및 타입 관리의 단일 책임 원칙을 강화할 여지가 있다.

### 위험도

**LOW**