### 발견사항

- **[INFO]** IP Whitelist 파싱이 매 create mutation 실행 시 인라인 실행됨
  - 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` 라인 489-492 (`createMutation` 내부)
  - 상세: `formIpWhitelist.split("\n").map(...).filter(...)` 체인이 mutation 실행 시점에만 호출되므로 입력 변경 시마다 재계산되지 않는다. 문자열 길이가 실무 수준(수십 CIDR)을 넘지 않을 것이므로 O(n) 연산 자체는 경미하다. `handleCreate`가 mutation만 호출하고 파싱은 mutation 내부에서만 이루어지므로 중복 계산은 없다. 허용 범위.
  - 제안: 현상 유지.

- **[INFO]** `configs.find()` 선형 탐색이 매 렌더링 시 실행됨
  - 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` 라인 457 (`const selectedConfig = configs.find(...)`)
  - 상세: `selectedConfig`가 `useMemo` 없이 컴포넌트 바디에 직접 선언되어 있어 어떤 상태라도 변경될 때마다 `configs` 배열 전체를 순회한다. 인증 설정 목록이 수백 건을 넘기 어려운 관리 UI이므로 실무 영향은 거의 없다. 그러나 동일 컴포넌트에 많은 `useState`가 있어 잦은 리렌더 발생 시 매번 O(n) 순회가 이루어진다.
  - 제안: `useMemo(() => configs.find(c => c.id === selectedConfigId), [configs, selectedConfigId])`로 메모이제이션. 필수 수준은 아님.

- **[INFO]** 단일 거대 컴포넌트에서 다수 `useState`로 폼 상태 관리 — 이번 변경으로 상태 2개 추가
  - 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` 라인 426-447
  - 상세: `formApiKeyHeader`, `formIpWhitelist` 2개 상태가 추가되어 이 컴포넌트의 총 `useState` 수가 13개 이상이 됐다. 각 상태 변경이 전체 컴포넌트 리렌더를 유발하며, `textarea`의 `onChange`(`setFormIpWhitelist`)는 키 입력마다 리렌더를 발생시킨다. IP 화이트리스트가 긴 텍스트를 포함할 수 있는 `textarea`이므로 연속 키입력 중 무거운 JSX 트리(모달 5개 + 테이블 + 드로어)가 매번 재평가된다.
  - 제안: 단기적으로는 허용 가능하나, 폼 상태를 별도 컴포넌트(`CreateAuthConfigDialog`)로 분리하면 폼 상태 변경이 리스트/드로어 등 외부 트리 리렌더를 유발하지 않아 체감 성능이 개선된다.

- **[INFO]** `window.setTimeout`으로 등록된 30초 타이머에 cleanup 없음 (기존 코드)
  - 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` 라인 574
  - 상세: `revealMutation.onSuccess`에서 `window.setTimeout(() => setRevealedSecret(null), 30_000)`을 등록하는데, 반환된 timer ID를 저장하지 않아 컴포넌트 언마운트 시 `clearTimeout`이 불가능하다. 이번 diff와 직접 관련은 없으나, 언마운트 후 `setRevealedSecret(null)` 호출 시 React 경고가 발생할 수 있다.
  - 제안: `useRef`로 timer ID를 보관하고 `useEffect` cleanup에서 `clearTimeout` 호출. 이번 변경 범위는 아니나 함께 개선 권장.

- **[INFO]** 테스트에서 각 `it` 블록마다 `QueryClient` 인스턴스를 새로 생성함
  - 위치: `codebase/frontend/src/app/(main)/authentication/__tests__/authentication-form.test.tsx` 라인 71 (`renderPage` 함수)
  - 상세: `renderPage()` 호출 시마다 `new QueryClient()`가 생성된다. 테스트 격리 측면에서는 올바른 패턴이며, 테스트 수도 2개뿐이므로 실제 영향 없음.
  - 제안: 현상 유지.

---

### 요약

이번 변경은 IP Whitelist `textarea`와 API Key Header 입력 필드를 기존 단일 대형 컴포넌트(`AuthenticationPage`)에 추가한 소규모 UI 확장이다. 도입된 연산(`split/map/filter` 파싱 체인)은 mutation 실행 시 1회만 수행되며 O(n) 수준으로 무해하다. 핵심 성능 이슈는 신규 도입보다 기존 아키텍처에서 기인한다: 13개 이상의 `useState`를 단일 컴포넌트가 소유하여 `textarea` 키입력마다 무거운 JSX 트리(모달 5개 + 테이블 + 드로어) 전체가 재평가된다. 이는 IP 목록이 긴 입력에서 타이핑 지연으로 체감될 수 있으나, 관리 화면의 사용 빈도와 데이터 규모를 감안할 때 현시점에서 즉각적인 차단 사유는 아니다. `configs.find` 무메모이제이션과 `setTimeout` cleanup 누락은 기존 코드에서 이어지는 소소한 결함이다.

### 위험도

LOW
