### 발견사항

- **[INFO]** `useLocaleStore.setState` — 전역 Zustand store 직접 변이 (테스트 코드)
  - 위치: `authentication-form.test.tsx`, `beforeEach` 블록 (라인 89)
  - 상세: `useLocaleStore.setState({ locale: "en" })` 는 Zustand store 의 전역 상태를 직접 변이한다. `vi.clearAllMocks()` 와 `cleanup()` 으로 React 트리는 정리되지만 Zustand store 상태는 `cleanup()` 대상이 아니다. 동일 test suite 내에서는 `beforeEach` 마다 재설정되므로 격리가 유지되나, 향후 이 describe 블록 이후에 store 상태를 초기값으로 가정하는 테스트가 추가되면 오염이 발생할 수 있다.
  - 제안: `afterEach(() => useLocaleStore.setState({ locale: <defaultLocale> }))` 를 추가하거나, Zustand 의 `create` 에 `resetStore` 헬퍼를 노출해 테스트 클린업에 사용하면 다른 테스트 파일과의 격리가 더 견고해진다.

- **[INFO]** `window.setTimeout` 을 직접 호출 — 브라우저 전역 타이머 등록
  - 위치: `authentication/page.tsx`, `revealMutation.onSuccess` (라인 574)
  - 상세: `window.setTimeout(() => setRevealedSecret(null), 30_000)` 는 컴포넌트 언마운트 후에도 타이머가 계속 실행되어 `setRevealedSecret` 를 호출할 수 있다. React 18 의 strict mode 또는 테스트 환경(jsdom)에서 언마운트 후 setState 경고가 발생하며, 메모리 리크 위험도 있다. 이 변경은 신규가 아니라 기존 코드이므로 이번 PR 도입은 아니지만 언급한다.
  - 제안: `useEffect` 내에서 `clearTimeout` 으로 cleanup 하거나 `useRef` 로 타이머 id 를 추적해 언마운트 시 clear 한다.

- **[INFO]** `formIpWhitelist` 및 `formApiKeyHeader` 상태가 `resetForm` 에서만 초기화됨 — type 전환 시 잔류
  - 위치: `authentication/page.tsx`, 상태 선언부 및 `resetForm` 함수
  - 상세: 사용자가 폼에서 type 을 `api_key` → `basic_auth` 로 변경하면 `formApiKeyHeader` 의 기존 입력값이 그대로 유지된다. UI 상 해당 필드는 숨겨지고, 제출 시 `formType === "api_key"` 조건으로 걸러지므로 **실제 POST 페이로드에는 영향 없다**. 그러나 다시 `api_key` 로 전환하면 이전에 입력했던 헤더명이 그대로 남아있어 사용자가 의도하지 않은 값으로 제출할 가능성이 있다. `formIpWhitelist` 도 동일하게 type 전환 시 유지된다(단 이쪽은 "모든 type 공통" 의도이므로 IP 유지는 의도된 동작으로 볼 수 있다).
  - 제안: `formType` 이 변경될 때 `formApiKeyHeader` 를 `"X-API-Key"` 로 reset 하는 `onChange` 핸들러를 추가하거나, 혹은 현재 동작(type 전환 시 유지)이 의도라면 주석으로 명시한다.

- **[INFO]** i18n dict 에 새 키 추가 — TypeScript `Dict` 타입 정합 확인 필요
  - 위치: `en/authentication.ts` 및 `ko/authentication.ts`
  - 상세: `apiKeyHeaderLabel`, `ipWhitelistLabel`, `ipWhitelistHint` 3개 키가 영·한 dict 에 동시 추가됐다. `Dict["authentication"]` 타입이 두 파일에서 동시에 갱신되면 타입 오류는 없다. 그러나 `ko/authentication.ts` 파일이 `import type { Dict }` 를 선언하지 않고 `as const` 로 타입을 추론하므로, 향후 en dict 에만 키가 추가될 경우 ko 누락이 런타임까지 탐지되지 않을 위험이 있다. 이번 변경 자체는 양쪽에 동시 추가되어 안전하다.
  - 제안: `ko/authentication.ts` 도 `satisfies Dict["authentication"]` 또는 `import type { Dict }` + 명시적 타입 어노테이션을 적용해 타입 체커가 누락 키를 잡도록 한다.

### 요약

이번 변경은 `authentication/page.tsx` 에 컴포넌트-로컬 `useState` 2개(`formApiKeyHeader`, `formIpWhitelist`)를 추가하고 `resetForm` 에서 초기화하는 방식으로 구현되었다. 전역 변수·환경 변수·파일시스템·외부 네트워크 호출의 의도치 않은 부작용은 없다. 기존 공개 API(`apiClient.post` 시그니처, `resetForm` 시그니처)도 변경되지 않았다. 이벤트/콜백 계약 변경도 없다. 테스트 파일에서 `useLocaleStore.setState` 로 전역 Zustand store 를 직접 변이하는 패턴이 약한 테스트 격리 위험을 내포하고, type 전환 시 `formApiKeyHeader` 잔류가 UX 상 혼란을 유발할 수 있으나, 실제 POST 페이로드에는 영향이 없다. 전반적으로 부작용 위험도는 낮다.

### 위험도

LOW
