# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `openOAuthPopup` 함수의 모듈 추출로 인한 공개 인터페이스 노출
  - 위치: `frontend/src/app/(main)/integrations/[id]/open-oauth-popup.ts`
  - 상세: 기존에는 `page.tsx` 내부의 private 함수였으나, 별도 모듈로 추출되어 `export`됨으로써 다른 모듈에서도 import 가능한 공개 함수가 되었다. 현재 범위 내에서는 `scope-tab.tsx`와 `page.tsx`가 이 함수를 사용하며, 의도된 변경이다. 다만 향후 이 함수의 시그니처나 동작 변경 시 모든 import 지점에 영향을 미치는 점을 인식해야 한다.
  - 제안: 현재 상태는 문제없음. 향후 시그니처 변경 시 `scope-tab.tsx`와 `page.tsx` 양쪽을 함께 수정해야 함을 문서화 권장.

- **[INFO]** `ScopeTab` 컴포넌트의 시그니처 변경 — `service` prop 타입이 narrowed됨
  - 위치: `frontend/src/app/(main)/integrations/[id]/scope-tab.tsx` (신규), `page.tsx`의 기존 ScopeTab 정의
  - 상세: 기존 `page.tsx` 내의 ScopeTab 은 `service: ServiceDefinition | undefined` 타입이었고, 신규 `scope-tab.tsx` 역시 동일한 시그니처를 유지한다. 이동(refactoring) 과정에서 시그니처가 변경되지 않았으므로 호환성 문제는 없다. `page.tsx` 에서 제거된 구 정의와 신규 `import { ScopeTab } from "./scope-tab"` 로의 교체가 1:1 대응됨을 확인.
  - 제안: 이상 없음.

- **[WARNING]** `requestScopes` 메서드의 반환 타입 변경 — `OAuthBeginResult` → `RequestScopesResult`
  - 위치: `frontend/src/lib/api/integrations.ts`, 라인 815-822
  - 상세: `integrationsApi.requestScopes()` 의 반환 타입이 `Promise<OAuthBeginResult>` 에서 `Promise<RequestScopesResult>` 로 변경되었다. `RequestScopesResult` 는 `OAuthBeginResult` 에 존재하는 두 유니온 브랜치(`{ authUrl, state }` 와 `{ mode: "cafe24_private_pending", ... }`)를 모두 포함하지만, `cafe24_private_pending` 분기에 `scopesAdded: string[]` 필드가 추가되었다. 즉, `RequestScopesResult` 는 `OAuthBeginResult` 의 `cafe24_private_pending` 브랜치를 확장한 슈퍼타입이다. 기존에 이 API 의 응답을 `OAuthBeginResult` 로 타입 단언하거나 처리하는 다른 호출자가 있다면, `scopesAdded` 필드가 없는 것으로 가정한 코드가 런타임에 예상치 못한 데이터를 받을 수 있다. 변경 범위 내 확인된 유일한 호출자는 `ScopeTab` 이므로 즉각적 위험은 없으나, 코드베이스 내 다른 호출 지점이 있는지 검증이 필요하다.
  - 제안: `grep` 등으로 `requestScopes` 호출 지점 전수 조사 후, `OAuthBeginResult`를 직접 참조하는 코드가 있으면 `RequestScopesResult`로 마이그레이션 또는 명시적 타입 가드를 추가한다.

- **[INFO]** `onMutate` 콜백에서 `cafe24Pending` 로컬 상태를 `null` 로 초기화하는 의도적 부작용
  - 위치: `frontend/src/app/(main)/integrations/[id]/scope-tab.tsx`, 라인 601-603
  - 상세: mutation 시작 시(`onMutate`) `cafe24Pending` 상태를 `null`로 리셋하여, 재요청 시 이전 amber alert 가 즉시 사라지도록 처리한다. 이것은 의도된 UX 처리이며 컴포넌트 로컬 상태에만 영향을 준다. 공유 상태나 전역 상태에는 영향 없음.
  - 제안: 이상 없음. 의도적이고 올바른 처리.

- **[INFO]** `window.open` 호출을 통한 팝업 오픈 — 브라우저 팝업 차단 가능성
  - 위치: `frontend/src/app/(main)/integrations/[id]/open-oauth-popup.ts`
  - 상세: 이 동작은 기존 코드에서도 동일하게 존재했으며, 새로 추출된 것이다. 추가적인 네트워크 호출이나 환경 변수 접근은 없다. `window.screenX`, `window.outerWidth` 등 브라우저 전역 객체를 읽으며, SSR 환경에서는 `window` 가 undefined 이므로 서버에서 호출될 경우 오류가 발생한다. 단, 해당 파일은 `scope-tab.tsx` 가 `"use client"` 지시어를 갖고 있어 클라이언트 컨텍스트에서만 호출되므로 현재 구조에서는 안전하다.
  - 제안: `open-oauth-popup.ts` 자체는 `"use client"` 지시어가 없다. 명시적으로 파일 상단에 주석(`// Browser-only utility — must not be called in server context`)을 추가하거나, 필요 시 `if (typeof window === 'undefined') return;` 가드를 추가하면 방어적으로 더 안전하다.

- **[INFO]** i18n 딕셔너리(`en.ts`, `ko.ts`) 에 신규 키 추가
  - 위치: `frontend/src/lib/i18n/dict/en.ts`, `frontend/src/lib/i18n/dict/ko.ts`
  - 상세: 기존 i18n 딕셔너리 객체에 3개의 새 키(`cafe24PrivateScopeRequestTitle`, `cafe24PrivateScopeRequestDesc`, `cafe24PrivateScopeRequestScopesAdded`)가 추가되었다. 기존 키를 수정하거나 삭제하지 않았으므로 기존 사용자에 대한 부작용은 없다. i18n 시스템이 정적 타입(`Dict` 타입)을 사용하는 경우, 새 키가 타입에 포함되어 있어야 컴파일이 통과한다.
  - 제안: `Dict` 타입 정의와 `en.ts`/`ko.ts` 양쪽 모두에 키가 추가되었는지, 두 언어 간 키 개수가 일치하는지 확인 권장 (본 변경에서는 양쪽 3개씩 균등하게 추가됨을 확인).

- **[INFO]** 테스트 파일에서 `useLocaleStore.setState` 직접 호출
  - 위치: `frontend/src/app/(main)/integrations/[id]/__tests__/scope-tab.test.tsx`, 라인 155
  - 상세: `beforeEach`에서 `useLocaleStore.setState({ locale: "en" })`을 호출해 Zustand store 상태를 테스트 간에 설정한다. `vi.clearAllMocks()`와 `cleanup()`도 함께 호출하여 정리한다. 이 패턴은 테스트 격리를 위한 표준적 접근이다. 단, `setState`는 이전 상태를 완전히 대체하지 않고 merge하는 방식이므로(Zustand 기본 동작), locale 이외의 store 필드가 있다면 테스트 간 상태가 오염될 가능성이 있다.
  - 제안: store를 완전히 초기화하려면 `useLocaleStore.setState({ locale: "en" }, true)` (두 번째 인자 `true` = replace)를 사용하는 것을 고려한다. 현재는 `locale` 필드만 있는 단순 store라면 문제없다.

- **[INFO]** 테스트에서 `window.open` spy를 `mockRestore()`로 복구
  - 위치: `frontend/src/app/(main)/integrations/[id]/__tests__/scope-tab.test.tsx`, 라인 230
  - 상세: `vi.spyOn(window, "open").mockImplementation(...)` 후 테스트 종료 시 `openSpy.mockRestore()`를 명시적으로 호출하여 전역 `window.open` 을 원래 상태로 복원한다. 올바른 정리 패턴으로 다른 테스트에 대한 전역 상태 오염 우려가 없다.
  - 제안: 이상 없음.

## 요약

이번 변경은 Cafe24 Private `request-scopes` 응답에 대한 UI 처리 누락 버그를 수정하고, 관련 컴포넌트를 별도 모듈로 추출하는 리팩토링을 포함한다. 부작용 관점에서 가장 주목할 변경은 `integrationsApi.requestScopes()` 의 반환 타입이 `OAuthBeginResult`에서 `RequestScopesResult`로 변경된 것이다. 이 변경은 기존 타입의 Cafe24 분기를 `scopesAdded` 필드로 확장한 것으로, 해당 메서드의 다른 호출자가 없는 한 실제 런타임 부작용은 없다. `openOAuthPopup` 의 모듈 추출, `ScopeTab` 컴포넌트 분리, i18n 키 추가 모두 전역 상태·환경 변수·예상치 못한 네트워크 호출·이벤트 변경 없이 의도된 범위 안에서 이루어졌으며, 테스트 코드의 정리 패턴도 적절하다. `window.open` 호출은 기존과 동일한 동작이고, `open-oauth-popup.ts`에 SSR 가드 주석이 없다는 점이 낮은 수준의 개선 권고로 남는다.

## 위험도

LOW
