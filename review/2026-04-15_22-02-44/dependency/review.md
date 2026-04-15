### 발견사항

- **[INFO]** 새 외부 패키지 없음, 기존 의존성만 활용
  - 위치: 전체 변경 파일
  - 상세: 모든 변경사항은 기존 NestJS, Next.js, TypeScript 기능만 사용. 신규 npm 패키지 추가 없음.
  - 제안: 현 상태 유지

- **[INFO]** `NEXT_PUBLIC_API_URL` 환경변수 중복 정의
  - 위치: `frontend/src/lib/api/auth-providers.ts:11`, `frontend/src/components/auth/login-form.tsx:35`, `frontend/src/components/auth/register-form.tsx:38`
  - 상세: `API_BASE_URL` 상수가 세 파일에 개별적으로 동일하게 정의되어 있음. 현재는 의존성 문제가 아니지만, 향후 변경 시 누락 위험이 있음.
  - 제안: `lib/api/client.ts` 등 공통 모듈에 `API_BASE_URL`을 한 번 정의하고 import해 사용

- **[INFO]** `OAuthProvider` 타입 중복 정의
  - 위치: `frontend/src/lib/api/auth-providers.ts:9`, `frontend/src/components/auth/login-form.tsx:37`, `frontend/src/components/auth/register-form.tsx:38`
  - 상세: `type OAuthProvider = "google" | "github"`가 세 파일에 각각 선언되어 있음. `auth-providers.ts`에 이미 `export`로 정의되어 있으므로 두 컴포넌트 파일에서 import해 재사용할 수 있음.
  - 제안: 컴포넌트에서 `import { OAuthProvider } from "@/lib/api/auth-providers"` 로 재사용

- **[INFO]** `NEXT_PUBLIC_API_URL`을 Server Component fetch에 사용
  - 위치: `frontend/src/lib/api/auth-providers.ts:11`
  - 상세: `NEXT_PUBLIC_API_URL`은 브라우저 노출용 환경변수로 서버-서버 통신(SSR → backend)에는 내부 URL(예: `BACKEND_INTERNAL_URL`)을 사용하는 것이 일반적. 현재 구조에서는 서버 컴포넌트가 공개 URL을 통해 백엔드를 호출하므로 불필요한 외부 경유가 발생할 수 있음.
  - 제안: 서버 전용 환경변수(`BACKEND_URL` 등)를 별도로 정의하거나, 현재 개발 환경 범위 내에서는 허용 가능

- **[INFO]** `process.env` 직접 읽기 (NestJS 관례와의 불일치)
  - 위치: `backend/src/modules/auth/auth-oauth.service.ts:80-86`
  - 상세: `getEnabledProviders()`가 `ConfigService` 대신 `process.env`를 직접 읽음. 동일 서비스 내 `requireEnv()`는 `process.env`를 사용하지만, 다른 메서드들은 `ConfigService`를 통해 설정을 읽는 패턴을 따름. 기존 코드와 일관성은 있으나, 테스트 격리 측면에서 약점이 있음 — 실제로 테스트에서 `process.env`를 직접 조작해야 하는 부담이 생김.
  - 제안: 허용 가능한 수준이나, 장기적으로는 `ConfigService`로 통일 권장

### 요약

이번 변경은 신규 외부 패키지를 일절 추가하지 않고 NestJS, Next.js, TypeScript의 기존 기능만 활용했으며, 의존성 측면에서 심각한 문제는 없음. 다만 `OAuthProvider` 타입과 `API_BASE_URL` 상수가 프론트엔드 세 파일에 걸쳐 중복 정의되어 있어 `auth-providers.ts`의 export를 재사용하면 내부 의존 구조를 개선할 수 있음. 백엔드의 `process.env` 직접 접근은 기존 코드의 관례를 따른 것이지만 `ConfigService`로 통일하면 더 나은 테스트 격리가 가능함.

### 위험도

**LOW**