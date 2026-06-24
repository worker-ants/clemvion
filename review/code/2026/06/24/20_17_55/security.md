# Security Review — refactor(frontend): M-2 API_BASE_URL 통합

## 발견사항

- **[INFO]** fallback URL 이 HTTP(평문) 스킴 고정
  - 위치: `codebase/frontend/src/lib/api/constants.ts` lines 13, 18, 33–34
  - 상세: `API_BASE_URL`, `WS_BASE_URL`, `getServerApiBaseUrl()` 의 모든 로컬 dev fallback 값이 `http://localhost:...` 로 고정되어 있다. env 변수가 미설정된 채 스테이징/프로덕션 빌드가 나가면 평문 HTTP 로 인증 토큰·세션 쿠키가 전송된다. NEXT_PUBLIC_* 는 빌드 타임에 인라인되므로 런타임 환경 변수 미설정이 가장 위험하다.
  - 제안: CI 빌드 파이프라인에서 `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_WS_URL` / `INTERNAL_API_URL` 미설정 시 빌드를 차단하는 검증 단계를 추가하거나, 프로덕션 배포 체크리스트에 env 필수 항목으로 명시한다. 코드 자체에서는 비-localhost URL 인데 `http://` 스킴을 사용하면 경고를 출력하는 guard를 추가할 수 있다.

- **[INFO]** `startOauth()` — OAuth redirect URL 에 `window.location.href` 직접 할당
  - 위치: `codebase/frontend/src/components/auth/login-form.tsx` line 195, `register-form.tsx` line 671
  - 상세: `window.location.href = \`${API_BASE_URL}/auth/oauth/${provider}?mode=login${rememberMe}\`` 형태로 URL을 구성한다. `provider` 는 `OAuthProvider = "google" | "github"` 타입으로 TypeScript 컴파일 타임에 enum 멤버 이외의 값이 유입될 수 없다. 단, `enabledProviders` 배열이 서버 응답(`fetchEnabledOauthProviders`)에서 온다면 런타임에 예상치 못한 문자열이 실릴 가능성이 제로가 아니다. 현재 코드는 `enabledProviders.includes("google")` / `includes("github")` 조건을 통과한 값만 버튼을 렌더하므로 실질적 위험은 낮다. 그러나 서버 응답 타입이 런타임에 강제되지 않으므로 이론상 open redirect 진입점이 될 수 있다.
  - 제안: `provider` 값을 `window.location.href` 에 삽입하기 전 허용 목록(`["google", "github"]`)으로 한 번 더 검증하거나, URL 구성 시 `encodeURIComponent(provider)` 를 적용한다.

- **[INFO]** `getServerApiBaseUrl()` — 서버 전용 함수의 클라이언트 호출 미차단
  - 위치: `codebase/frontend/src/lib/api/constants.ts` line 32, `auth-providers.ts` line 1614
  - 상세: 서버 컴포넌트 전용 함수로 문서에 명시되어 있으나 런타임 guard 가 없다. `INTERNAL_API_URL` 은 NEXT_PUBLIC_ 접두사가 없어 클라이언트 번들에서 `undefined` 로 치환된다. 클라이언트에서 호출되면 `NEXT_PUBLIC_API_URL` fallback으로 degrade 하며, 잘못된 내부 URL이 노출되지는 않는다. 보안 임팩트는 낮다.
  - 제안: `getServerApiBaseUrl()` 함수 상단에 `if (typeof window !== "undefined") throw new Error("getServerApiBaseUrl must only be called server-side")` 가드를 추가해 개발 단계에서 오용을 조기 차단한다.

- **[INFO]** access token 메모리 저장 — XSS 노출 범위 제한 양호
  - 위치: `codebase/frontend/src/lib/api/client.ts` lines 1715–1723
  - 상세: access token 이 `localStorage` / `sessionStorage` 가 아닌 모듈 스코프 변수에 저장된다. XSS 공격자가 임의 스크립트를 실행하면 여전히 접근 가능하지만, storage persistence 나 `document.cookie` 탈취보다 공격 표면이 좁다. 이는 보안 설계 의도가 명시적으로("not localStorage/sessionStorage for security") 반영된 결과다.
  - 제안: 현재 설계 유지. CSP(Content-Security-Policy) 헤더가 Next.js 앱 수준에서 적용되어 있는지 별도 점검 권고.

- **[INFO]** SSE 스트림 에러 메시지 노출
  - 위치: `codebase/frontend/src/lib/api/assistant.ts` line 1472
  - 상세: `throw new Error(\`Assistant stream failed: ${response.status} ${response.statusText}\`)` — HTTP 상태 코드와 status text가 에러 메시지에 포함된다. status text 자체는 표준 HTTP 텍스트이며 민감 정보를 포함하지 않는다. 그러나 이 에러가 호출자 레벨에서 toast로 렌더되는 경로가 있다면 내부 에러 문자열이 사용자에게 노출될 수 있다.
  - 제안: 호출자에서 i18n 메시지로 대체하는지 검증하고, 필요시 `response.status` 만 포함하고 `statusText` 는 생략하는 방향을 검토한다.

- **[INFO]** `console.error` / `console.warn` 로 내부 에러 정보 노출
  - 위치: `assistant.ts` line 1467, `ws-client.ts` lines 2040, 2070
  - 상세: `[assistant] access token refresh failed`, `[ws] Connection error:`, `[ws] Token refresh failed:` 등이 클라이언트 콘솔에 출력된다. 에러 객체 전체를 `console.error` 에 전달하면 스택 트레이스나 내부 메시지가 노출될 수 있다. 토큰 값 자체는 로깅하지 않아 직접 위험은 낮다.
  - 제안: 에러 로깅 시 `err.message` 만 출력하는 패턴으로 정제를 권고한다. 프로덕션 빌드에서 `console.*` 제거(webpack `drop_console` 등) 설정 적용 여부도 확인 권고.

## 요약

이번 변경은 분산된 API/WS base URL 정의를 `lib/api/constants.ts` 단일 모듈로 통합하는 순수 리팩터링이다. 보안 관점에서 신규 취약점을 도입하지 않으며, 기존 각 파일에서 동일하게 사용하던 환경 변수 참조 패턴을 중앙화한 것이다. 인젝션·하드코딩 시크릿·인증우회·OWASP Top 10 신규 위반 항목은 발견되지 않았다. 잔존 주의사항은 (1) fallback URL의 HTTP 평문 스킴이 env 미설정 비-dev 환경에서 노출될 가능성, (2) OAuth redirect의 `provider` 값에 대한 런타임 허용 목록 검증 미적용, (3) 서버 전용 함수의 클라이언트 호출 미차단 세 가지이며 모두 INFO 수준이다. 리팩터링 전후 보안 상태는 동일하며 위험도는 낮다.

## 위험도

LOW
