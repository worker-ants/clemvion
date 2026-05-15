### 발견사항

- **[INFO]** 신규 공개 엔드포인트 `GET /api/auth/oauth/providers` 추가
  - 위치: `auth.controller.ts` — `getOauthProviders()`
  - 상세: 기존 클라이언트에 영향 없는 순수 추가(additive change). `@Public()` 데코레이터로 인증 불필요 처리는 의도에 부합 — 이 정보는 로그인 전에 필요하므로 적절.
  - 제안: 문제 없음.

- **[INFO]** 응답 형식이 프로젝트 전체 관례 `{ data: { ... } }` 를 따름
  - 위치: `auth.controller.ts:374` — `return { data: { providers } }`
  - 상세: 기존 모든 엔드포인트와 동일한 래퍼 구조. Swagger `@ApiOkResponse` 스키마도 실제 응답과 일치.
  - 제안: 문제 없음.

- **[INFO]** `Cache-Control: public, max-age=300` 헤더와 Next.js `revalidate: 300` 정합
  - 위치: `auth.controller.ts:376`, `auth-providers.ts:17`
  - 상세: 서버 응답 캐시 지시와 Next.js SSG 재검증 주기가 300초로 일치. CDN/프록시에서도 일관된 캐싱 동작 보장.
  - 제안: 문제 없음.

- **[WARNING]** `NEXT_PUBLIC_API_URL` 환경변수를 서버 컴포넌트에서 사용
  - 위치: `auth-providers.ts:11`
  - 상세: `NEXT_PUBLIC_` 접두사 변수는 클라이언트 번들에 인라인된다. 서버 컴포넌트(`fetchEnabledOauthProviders`는 서버 사이드 전용)에서 백엔드 내부 통신 URL을 노출하는 것은 불필요한 클라이언트 번들 노출. 내부 서버 간 통신에는 `INTERNAL_API_URL` 같은 서버 전용 환경변수를 쓰고, `NEXT_PUBLIC_API_URL`은 클라이언트 fetch 전용으로 분리하는 것이 권장 패턴.
  - 제안: `process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3011/api"` 순으로 fallback하거나, 서버 전용 환경변수(`API_URL`)를 별도로 정의할 것.

- **[INFO]** 응답 배열 항목의 타입 안전성
  - 위치: `auth-providers.ts:20`
  - 상세: 백엔드가 `OAuthProvider[]`를 반환한다고 신뢰하고 있으나, `body.data?.providers`의 타입을 런타임에 검증하지 않음. 백엔드가 알 수 없는 provider 문자열을 추가할 경우 프론트엔드 타입이 어긋날 수 있으나, `includes()` 검사 기반으로만 UI를 분기하기 때문에 실질적 런타임 오류는 발생하지 않음.
  - 제안: 현재 구조에서 문제 없음. 향후 provider가 추가될 때 `OAuthProvider` 타입 및 백엔드 `AUTH_OAUTH_PROVIDERS` 상수를 동시에 갱신해야 한다는 점을 주의.

- **[INFO]** 실패 시 빈 배열 기본값으로 안전 저하(graceful degradation) 처리
  - 위치: `auth-providers.ts:14-24`
  - 상세: 네트워크 오류나 non-OK 응답 시 SSO UI만 숨기고 이메일/비밀번호 로그인은 유지. 스펙 요구사항과 일치하며 적절한 계약 설계.
  - 제안: 문제 없음.

---

### 요약

이번 변경은 `GET /api/auth/oauth/providers` 엔드포인트를 새롭게 추가한 순수 확장(additive change)으로, 기존 API 클라이언트에 대한 breaking change가 전혀 없다. 응답 구조는 프로젝트 관례(`{ data: { ... } }`)를 준수하고, Swagger 스키마와 실제 응답이 일치하며, 캐싱 전략도 서버-클라이언트 간 정합이 맞다. 에러 시 빈 배열로 안전 저하 처리한 설계도 적절하다. 다만 서버 컴포넌트에서 `NEXT_PUBLIC_` 접두사 환경변수를 사용하는 점은 API 계약상의 문제는 아니나, 서버 내부 통신 URL이 클라이언트 번들에 불필요하게 노출되는 경미한 아키텍처 개선 여지가 있다.

### 위험도
**LOW**