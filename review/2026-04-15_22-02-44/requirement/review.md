### 발견사항

- **[WARNING]** 서버 컴포넌트에서 `NEXT_PUBLIC_API_URL` 사용
  - 위치: `frontend/src/lib/api/auth-providers.ts:11`
  - 상세: `NEXT_PUBLIC_API_URL`은 클라이언트 번들에 인라인되는 환경변수입니다. Next.js Server Component에서 백엔드로 서버-투-서버 요청을 보낼 때는 컨테이너/k8s 환경에서 공개 URL이 내부 네트워크에서 라우팅되지 않을 수 있습니다. 서버 전용 변수(예: `INTERNAL_API_URL`)를 사용해야 프로덕션 배포에서 안전합니다.
  - 제안: 서버 컴포넌트용 `INTERNAL_API_URL` (또는 `API_URL`) 환경변수를 별도로 두고, `auth-providers.ts`에서 `process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL`로 fallback 처리

- **[WARNING]** `OAuthProvider` 타입 3중 중복 정의
  - 위치: `auth-providers.ts:9`, `login-form.tsx:35`, `register-form.tsx:38`
  - 상세: `type OAuthProvider = "google" | "github"`가 세 파일에 각각 독립적으로 선언되어 있습니다. 새 provider 추가 시 세 파일을 모두 수정해야 하며, 한 곳만 누락되면 런타임 불일치가 발생합니다. `auth-providers.ts`에서 이미 export하고 있으므로 나머지 두 파일은 import해야 합니다.
  - 제안: `login-form.tsx`, `register-form.tsx`에서 `import { OAuthProvider } from "@/lib/api/auth-providers"` 로 변경

- **[WARNING]** API 응답의 provider 값에 대한 런타임 검증 부재
  - 위치: `frontend/src/lib/api/auth-providers.ts:20-22`
  - 상세: `body.data?.providers`를 `OAuthProvider[]`로 캐스팅하지만 실제 값 검증이 없습니다. 백엔드가 알 수 없는 provider 문자열을 반환해도 그대로 UI에 전달됩니다. `includes()` 체크가 있어 버튼이 노출되지는 않지만, 타입 안전성이 보장되지 않습니다.
  - 제안: `body.data?.providers?.filter((p): p is OAuthProvider => ["google", "github"].includes(p)) ?? []`로 필터링

- **[INFO]** `RegisterForm` 기본값 구문 불일치
  - 위치: `frontend/src/components/auth/register-form.tsx:63`
  - 상세: `export function RegisterForm({ enabledProviders = [] }: RegisterFormProps = {})` — 인터페이스에 이미 `enabledProviders?`로 선언되어 있으므로 함수 파라미터에 `= {}`는 불필요합니다. `LoginForm`과도 패턴이 다릅니다.
  - 제안: `export function RegisterForm({ enabledProviders = [] }: RegisterFormProps)`로 통일

- **[INFO]** `getEnabledProviders` 테스트에서 `process.env` 부분 누락 복원
  - 위치: `backend/src/modules/auth/auth-oauth.service.spec.ts:134-162`
  - 상세: `getEnabledProviders` describe 내 각 테스트가 `process.env`를 수정한 뒤 복원하지 않습니다. `afterAll`에서 전체 복원이 되지만, 이 describe 직후에 실행되는 `beginAuth` 테스트들은 `beforeEach`에서 env를 재설정하므로 현재는 문제없습니다. 그러나 테스트 순서 변경 시 취약합니다.
  - 제안: `getEnabledProviders` describe에 `afterEach(() => { process.env.OAUTH_STUB_MODE = 'true'; ... })` 추가 또는 각 `it` 블록에서 원복 처리

- **[INFO]** 빈 배열일 때도 `Cache-Control: public` 헤더 적용
  - 위치: `backend/src/modules/auth/auth.controller.ts:378`
  - 상세: 활성 provider가 없을 때도 `Cache-Control: public, max-age=300`이 설정됩니다. 환경변수 변경 후 5분간 캐시된 빈 목록이 서빙되어 SSO 버튼이 표시되지 않을 수 있습니다. 스펙의 의도와는 부합하지만, 운영 환경에서 초기 설정 시 즉각 반영이 안 될 수 있습니다.
  - 제안: 현재 스펙 정의를 유지하되, 운영 배포 가이드에 캐시 무효화 방법 명시

---

### 요약

스펙 §5.0의 핵심 요구사항(provider 목록 API, 조건부 UI 표시, 5분 캐싱, 실패 시 graceful degradation)은 모두 충실히 구현되었습니다. 백엔드의 `getEnabledProviders` 로직과 컨트롤러, 프론트엔드의 서버 컴포넌트 fetch, 폼 컴포넌트의 조건부 렌더링이 스펙과 일치합니다. 다만 `NEXT_PUBLIC_API_URL`을 서버 컴포넌트에서 사용하는 점은 서버-투-서버 통신에서 프로덕션 배포 환경에 따라 라우팅 장애를 유발할 수 있고, `OAuthProvider` 타입 중복 선언은 provider 추가 시 일관성 깨짐의 잠재적 원인이 됩니다.

### 위험도

**MEDIUM** — 기능 완전성은 높으나, 서버 컴포넌트의 `NEXT_PUBLIC_API_URL` 사용이 프로덕션 환경에 따라 서비스 장애를 일으킬 수 있습니다.