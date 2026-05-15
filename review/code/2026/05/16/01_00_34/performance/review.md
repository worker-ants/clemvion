# 성능(Performance) 코드 리뷰

## 발견사항

- **[INFO]** `toggle` 함수에서 매 체크박스 클릭마다 `prev.includes(value)` 와 `prev.filter(...)` 를 연속 호출하여 배열을 두 번 순회
  - 위치: `frontend/src/app/(main)/integrations/[id]/scope-tab.tsx` — `toggle` 함수 (라인 625-628)
  - 상세: 선택된 스코프가 이미 포함된 경우 `includes` (O(n))와 `filter` (O(n)) 를 연속 실행한다. 스코프 목록이 일반적으로 수십 개 이하이므로 실제 성능 영향은 미미하지만, 불필요한 이중 순회 패턴이다.
  - 제안: `Set<string>` 을 state로 사용하면 `has`/`add`/`delete` 모두 O(1) 로 처리 가능. 단, 스코프 수가 적어 현재 구현으로도 문제없는 수준이며 필수 개선 사항은 아님.

- **[INFO]** `missingScopes` 계산 시 `allOptions.filter((s) => !currentScopes.includes(s.value))` 에서 `currentScopes.includes` 가 `allOptions` 배열 순회마다 호출되어 O(n×m) 복잡도 발생
  - 위치: `frontend/src/app/(main)/integrations/[id]/scope-tab.tsx` — `missingScopes` 계산 블록 (라인 588-592)
  - 상세: `currentScopes`를 `Set<string>` 으로 변환하면 내부 `includes` 가 O(1) 로 변경되어 전체 복잡도가 O(n+m) 으로 개선된다. 현재는 `allOptions` 길이(n) × `currentScopes` 길이(m) 만큼 선형 검색이 발생한다. 실제 스코프 수가 소규모이므로 런타임 영향은 없지만 패턴 개선 여지가 있다.
  - 제안: `const currentScopesSet = new Set(currentScopes);` 를 생성 후 `filter` 와 `disabled` 조건 체크 모두 `currentScopesSet.has(s.value)` 로 대체. 동일한 패턴이 render 내 체크박스 목록 (라인 717, 722) 에서도 반복되므로 Set 을 한 번만 계산해 재사용하면 효과적.

- **[INFO]** 렌더 함수 내에서 `currentScopes.includes(s.value)` 를 체크박스 `disabled` 와 "already granted" 뱃지 표시 두 곳에서 중복 호출
  - 위치: `frontend/src/app/(main)/integrations/[id]/scope-tab.tsx` — 라인 717, 722
  - 상세: `allOptions.map(...)` 내부에서 동일한 `currentScopes.includes(s.value)` 를 두 번 평가한다. 매 렌더마다 반복되는 불필요한 중복 계산이다.
  - 제안: `const alreadyGranted = currentScopesSet.has(s.value);` 로 한 번만 계산한 뒤 두 곳에서 참조.

- **[INFO]** 테스트 파일의 `Wrapper` 컴포넌트에서 매 render 호출 시 `new QueryClient(...)` 인스턴스 생성
  - 위치: `frontend/src/app/(main)/integrations/[id]/__tests__/scope-tab.test.tsx` — `Wrapper` 함수 (라인 135-138)
  - 상세: `Wrapper` 는 `wrapper` 옵션으로 전달되어 RTL 이 내부적으로 호출할 때마다 새 `QueryClient` 가 생성된다. 테스트 격리 목적으로는 올바른 패턴이나, `beforeEach` 에서 한 번 생성하거나 `useMemo` 없이 함수 내 즉시 생성하는 현재 구조는 렌더 횟수에 비례해 인스턴스를 생성한다. 테스트 환경에서의 영향이므로 프로덕션 성능과 무관하지만 기재한다.
  - 제안: `beforeEach` 에서 `queryClient` 를 생성하고 `afterEach` 에서 `queryClient.clear()` 를 호출하는 패턴으로 변경하면 인스턴스 재사용이 가능하다. 현재 테스트 수준에서는 무시 가능.

- **[INFO]** `openOAuthPopup` 함수에서 `window.screenX`, `window.outerWidth` 등 레이아웃 속성을 동기적으로 읽어 팝업 위치를 계산
  - 위치: `frontend/src/app/(main)/integrations/[id]/open-oauth-popup.ts` — 라인 282-286
  - 상세: `window.screenX`, `window.outerWidth`, `window.outerHeight` 는 브라우저가 레이아웃 정보를 즉시 반환하는 속성이다. 이들은 강제 reflow 를 유발하지 않는 `screen`/`outer` 계열 속성이므로 성능 영향은 없다. 다만 `window.open` 자체는 블로킹 OS 호출이며 팝업 차단 시 null 을 반환하는데 이를 처리하지 않고 있다 (성능 문제보다는 오류 처리 문제).
  - 제안: 성능 측면에서는 현재 구현이 적절하다. 팝업 차단 감지는 별도 안전성 리뷰에서 다루는 것이 적합.

## 요약

이번 변경은 Cafe24 Private `request-scopes` 응답 처리를 위한 UI 분기 추가 및 `ScopeTab` 컴포넌트 모듈 분리가 주요 내용이다. 성능 관점에서 전반적으로 경량한 변경이며, 다루는 데이터(스코프 목록)는 수십 개 수준으로 알고리즘 복잡도 문제가 실질적 영향을 미칠 가능성이 낮다. 발견된 이슈는 모두 INFO 수준으로, `currentScopes.includes` 가 render 내 복수 위치에서 중복 호출되고 `Set` 으로 대체 시 개선 여지가 있으나 현재 스코프 규모에서는 무시 가능한 수준이다. N+1 쿼리, 블로킹 I/O, 메모리 누수, 캐시 전략 누락 등 주요 성능 위험 요소는 관찰되지 않았다. `useMutation` 기반의 단일 API 호출 구조와 React state 를 통한 단순 UI 상태 관리는 성능 설계 측면에서 적절하다.

## 위험도

LOW
