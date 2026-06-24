# Testing Review — M-2 API_BASE_URL 중앙화 리팩터

## 발견사항

### [INFO] `constants.ts` 신규 모듈에 대한 단위 테스트 부재
- 위치: `codebase/frontend/src/lib/api/constants.ts`
- 상세: `API_BASE_URL`, `WS_BASE_URL`, `getServerApiBaseUrl()` 세 export 모두 테스트 없음. 이 리팩터의 핵심 신규 파일이므로 다음 경로를 커버하는 테스트가 없다.
  - `NEXT_PUBLIC_API_URL` 설정 시 해당 값 반환 (API_BASE_URL)
  - `NEXT_PUBLIC_API_URL` 미설정 시 fallback `"http://localhost:3011/api"` 반환 (포트 3011 정합성 회귀 방지)
  - `NEXT_PUBLIC_WS_URL` 설정/미설정 (WS_BASE_URL)
  - `getServerApiBaseUrl()`: `INTERNAL_API_URL` 우선 → `NEXT_PUBLIC_API_URL` → fallback 우선순위 3경로
- 제안: `src/lib/api/__tests__/constants.test.ts` 를 신규 작성. `webhook-url.test.ts` 의 패턴(`process.env` 직접 조작 + `vi.resetModules()`)을 참고해 각 env 조합별 케이스를 작성. 특히 포트 3011 fallback 검증 케이스가 없으면 향후 오타로 3001 이 재도입될 때 회귀를 감지할 수 없다.

### [INFO] `client.test.ts` 가 `API_BASE_URL` / baseURL 을 검증하지 않음
- 위치: `codebase/frontend/src/lib/api/__tests__/client.test.ts`
- 상세: 기존 테스트는 `setAccessToken`/`getAccessToken` 메모리 관리만 검증하며, `apiClient.defaults.baseURL` 이 `API_BASE_URL`(constants.ts)을 올바르게 가져오는지 검증하지 않는다. 리팩터 전 `client.ts` 에 인라인 정의된 상수가 3001 이었고, 이번에 constants.ts 로 이관하면서 3011 로 변경됐으나 이를 감지할 테스트가 없다.
- 제안: `apiClient.defaults.baseURL` 을 assert 하는 케이스 1건 추가. 또는 constants.ts 테스트에서 일괄 커버.

### [INFO] `ws-client.test.ts` 가 WS URL 포트를 검증하지 않음
- 위치: `codebase/frontend/src/lib/websocket/__tests__/ws-client.test.ts`
- 상세: 테스트에서 `io()` 호출 첫 번째 인자로 `expect.stringContaining("/ws")` 만 검사한다. `WS_BASE_URL` 의 실제 값(포트 3011 fallback)을 검증하지 않는다. `WS_BASE_URL` 이 constants.ts 에서 import 되도록 변경됐으나, 테스트가 import path 의 정합성을 추적하지 않는다.
- 제안: `io` 호출 첫 번째 인자에 `"http://localhost:3011/ws"` 를 assert 하는 케이스(env 미설정 상태)를 추가하면 fallback 포트 회귀를 잡을 수 있다.

### [INFO] `auth-providers.ts` 의 `getServerApiBaseUrl()` 경로 테스트 없음
- 위치: `codebase/frontend/src/lib/api/auth-providers.ts`
- 상세: `fetchEnabledOauthProviders()` 는 `getServerApiBaseUrl()` 를 호출하는 서버 컴포넌트 fetch 함수다. 기존에는 인라인 상수였으나 이제 constants.ts 의 함수 호출로 변경됐다. 해당 함수에 대한 단위 테스트 파일이 없다. `INTERNAL_API_URL` → `NEXT_PUBLIC_API_URL` → fallback 우선순위 로직이 단위 테스트로 검증되지 않는다.
- 제안: 이 함수는 서버 사이드 전용이므로 e2e 커버가 주된 수단이지만, unit 레벨에서 `global.fetch` 를 mock 하고 `INTERNAL_API_URL` 설정 시 올바른 URL 로 fetch 가 호출되는지 검증하는 케이스 1건이 `getServerApiBaseUrl()` 우선순위 로직을 보강한다. 단, constants.ts 테스트에서 `getServerApiBaseUrl()` 를 직접 테스트하면 이 갭의 대부분이 해소된다.

### [INFO] `assistant.ts` `streamMessage` URL 변경 — 기존 단위 테스트 부재 (이번 리팩터 무관)
- 위치: `codebase/frontend/src/lib/api/assistant.ts`
- 상세: 이번 변경은 `baseUrl` 로컬 const 를 `API_BASE_URL` import 로 교체한 동작 동치 리팩터이므로 회귀 위험은 낮다. 그러나 `parseSseRecord` 함수(file-private)와 401 retry 로직에 대한 단위 테스트가 원래부터 없어, 향후 변경 시 회귀 방지 망이 없다.
- 제안: 이번 PR 범위 외. 별도 이슈로 추적 권장.

### [INFO] `register-form.test.tsx` 의 `API_BASE_URL` 미mock — OAuth redirect 케이스 추가 시 주의 필요
- 위치: `codebase/frontend/src/components/auth/__tests__/register-form.test.tsx`
- 상세: `register-form.tsx` 는 `API_BASE_URL` 을 `@/lib/api/constants` 에서 import 하지만, 테스트는 이를 mock 하지 않는다. 현재 테스트들이 OAuth 버튼 클릭(`startOauth`)을 검증하지 않아 실질적 문제는 없다. 그러나 OAuth redirect URL 을 검증하는 테스트를 추가한다면 `vi.mock("@/lib/api/constants", ...)` 또는 `process.env` 제어가 필요하다.
- 제안: 현재는 INFO. OAuth 버튼 관련 테스트 추가 시 constants 모듈 mock 처리 필요.

## 요약

이번 리팩터(M-2)는 분산된 URL 상수를 `constants.ts` 로 통합하는 동작 동치 변경으로, 기존 테스트(unit 40건, e2e 214건)가 모두 PASS 했다고 커밋 메시지에 명시되어 있어 직접적 회귀 위험은 낮다. 그러나 신규 핵심 모듈 `constants.ts` 에 전용 단위 테스트가 없고, `client.test.ts` 와 `ws-client.test.ts` 도 baseURL/WS URL fallback 포트를 직접 assert 하지 않아, 향후 포트 오타(3001 재도입 등)를 자동으로 감지하는 회귀 방지 망이 부재하다. `webhook-url.test.ts` 가 `NEXT_PUBLIC_API_URL` env 조작 패턴을 잘 보여주므로 이를 참고해 `constants.test.ts` 를 작성하는 것이 이 리팩터의 테스트 완성도를 높이는 가장 효과적인 조치다.

## 위험도

LOW
