# 아키텍처(Architecture) 리뷰

리뷰 대상: `refactor(frontend): M-2 — API_BASE_URL 분산 정의 통합 + 3001→3011 fallback 정정`

---

## 발견사항

- **[INFO]** Single Responsibility 관점에서 `constants.ts` 의 책임 범위가 명확하게 정의됨
  - 위치: `/codebase/frontend/src/lib/api/constants.ts`
  - 상세: 클라이언트 URL(`API_BASE_URL`), WebSocket URL(`WS_BASE_URL`), 서버 컴포넌트 전용 함수(`getServerApiBaseUrl()`) 세 가지 모두 URL 관련이므로 단일 책임 원칙 충족. 파일 상단 주석으로 `lib/constants/`(비-API 전역) 와 `lib/api/constants.ts`(API URL 전용) 의 경계를 명시한 점도 적절함.

- **[INFO]** `getServerApiBaseUrl()` 를 함수로 분리한 설계 선택이 Next.js SSR 런타임 특성과 잘 맞음
  - 위치: `/codebase/frontend/src/lib/api/constants.ts:31-37`
  - 상세: `INTERNAL_API_URL` 은 `NEXT_PUBLIC_*` 가 아니므로 클라이언트 번들에서 `undefined` 로 치환된다. 상수로 정의했다면 빌드 타임에 `undefined` 로 인라인되어 런타임 환경 변수 변경을 반영하지 못한다. 함수 형태로 두어 서버 런타임에 매번 평가되도록 한 점은 레이어 책임(서버/클라이언트 컴포넌트 분리) 관점에서 올바른 추상화다.

- **[INFO]** 프레젠테이션 컴포넌트(`login-form.tsx`, `register-form.tsx`)에서 URL 상수를 직접 참조하는 구조는 이번 리팩터 이후에도 유지됨
  - 위치: `/codebase/frontend/src/components/auth/login-form.tsx:100`, `/codebase/frontend/src/components/auth/register-form.tsx:668`
  - 상세: 이 컴포넌트들은 OAuth redirect URL 조립(`window.location.href = \`${API_BASE_URL}/auth/oauth/...\``)을 위해 `API_BASE_URL` 을 직접 사용한다. 이는 프레젠테이션 레이어가 API URL 구성 세부사항에 의존하는 형태다. 엄밀한 레이어 분리를 따른다면 이 OAuth redirect URL 생성 로직을 `lib/api/auth-providers.ts` 혹은 별도 유틸로 이동하는 것이 더 깔끔하나, 현재 사용 범위(OAuth 버튼 클릭 핸들러 단 1곳)에서는 과도한 추상화가 될 수 있으므로 실질적인 문제는 아님.

- **[INFO]** `ws-client.ts` 의 레이어 경계 — `lib/websocket/` 이 `lib/api/constants` 를 import
  - 위치: `/codebase/frontend/src/lib/websocket/ws-client.ts:3`
  - 상세: WebSocket 모듈이 API 모듈의 상수를 참조하는 방향의 의존성이다. `WS_BASE_URL` 은 WebSocket 전용 URL 이지만 `lib/api/constants.ts` 에 위치한다. 현재 모듈 구조상 `lib/websocket` -> `lib/api` 단방향 참조이고, 역방향 참조는 없으므로 순환 의존성은 없다. 향후 `lib/api/constants.ts` 가 커져 `lib/websocket` 관련 상수와 명확히 분리가 필요해지면 `WS_BASE_URL` 을 별도 모듈로 이동하거나 파일 주석이 설명하는 경계(`lib/api/` vs `lib/constants/`)를 조정할 수 있다. 현 범위에서는 허용 가능.

- **[INFO]** `assistant.ts` 의 `streamMessage` 에서 `fetch` 직접 사용 패턴 — `apiClient` 우회
  - 위치: `/codebase/frontend/src/lib/api/assistant.ts:1439-1454`
  - 상세: SSE 스트림이 `EventSource` 의 GET 제한으로 인해 `axios apiClient` 를 우회하고 `fetch` 를 직접 사용하는 것은 기술적으로 불가피하다. 이번 변경으로 `API_BASE_URL` 참조가 `constants.ts` 로 통합되어 URL 일관성은 보장됨. 단, `fetch` 경로의 401 처리(`refreshAccessToken` 직접 호출)와 `apiClient` interceptor 의 401 처리가 두 곳에서 병존하는 구조는 이번 PR 이전부터 존재하던 패턴으로 이번 변경의 범위 밖이다.

---

## 요약

본 변경은 분산된 API/WS base URL fallback 정의를 `lib/api/constants.ts` 단일 모듈로 통합하는 전형적인 DRY 리팩터로, 아키텍처 관점에서 결합도를 낮추고 단일 진실 원칙을 적용한 방향성이 올바르다. `API_BASE_URL`(클라이언트 상수), `WS_BASE_URL`(WebSocket 상수), `getServerApiBaseUrl()`(서버 컴포넌트 전용 함수)의 세 가지 내보내기는 Next.js 의 클라이언트/서버 런타임 분리 특성을 잘 반영하며, 특히 `getServerApiBaseUrl()` 를 함수로 정의한 선택은 서버 런타임 환경 변수(`INTERNAL_API_URL`)가 빌드 타임에 인라인 치환되지 않도록 하는 레이어 책임 관점의 올바른 설계다. 로컬 `const` 를 완전히 제거하고 중앙 import 로 전환한 결과 `lib/websocket` -> `lib/api/constants` 의 단방향 의존성만 존재하며 순환 참조는 없다. 프레젠테이션 컴포넌트에서 `API_BASE_URL` 을 직접 참조하는 점은 레이어 분리 엄격성 측면에서 잠재적 개선 여지가 있으나, 사용 범위가 OAuth redirect URL 조립 1곳에 국한되어 있어 현 시점에서 추가 추상화는 불필요하다. 전체 변경이 동작 보존(behavior-preserving) 리팩터이며 lint·build·unit·e2e 전체 통과를 확인한 점도 적절하다.

---

## 위험도

NONE
