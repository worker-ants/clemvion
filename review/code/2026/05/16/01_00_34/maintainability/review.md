# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `open-oauth-popup.ts` — 매직 넘버 `600`, `700`
  - 위치: `frontend/src/app/(main)/integrations/[id]/open-oauth-popup.ts` L2–L3
  - 상세: 팝업 창의 `width = 600`, `height = 700` 이 named constant 없이 하드코딩되어 있다. 숫자만 보면 그 의미(OAuth 팝업 권장 크기)를 바로 알 수 없다.
  - 제안: `const OAUTH_POPUP_WIDTH = 600; const OAUTH_POPUP_HEIGHT = 700;` 로 명명하거나, 파일 상단 주석으로 맥락을 명시한다.

- **[INFO]** `open-oauth-popup.ts` — 반환값 없음(void)에 대한 문서 부재
  - 위치: `frontend/src/app/(main)/integrations/[id]/open-oauth-popup.ts` 전체
  - 상세: `window.open()`의 반환값(팝업 핸들)을 버린다. 팝업이 차단된 경우를 감지하거나 포커스를 이동하는 용도로 핸들이 필요할 수 있는데 의도적으로 무시한다는 점이 코드 어디에도 명시되지 않았다. 기존 `page.tsx` 삭제된 코드와 동일한 결함을 그대로 복제했다.
  - 제안: `const popup = window.open(...)` 으로 받아서 차단 감지(popup이 null)를 처리하거나, 주석으로 의도적으로 무시함을 표시한다.

- **[INFO]** `scope-tab.tsx` — `cafe24Pending` 상태 타입이 인라인 익명 객체
  - 위치: `frontend/src/app/(main)/integrations/[id]/scope-tab.tsx` L595–L597
  - 상세: `useState<{ scopesAdded: string[] } | null>(null)` 처럼 상태 타입이 익명 구조체로 선언되어 있다. 이미 `RequestScopesResult`의 `cafe24_private_pending` 변형과 구조가 같으므로 기존 타입에서 Extract 하거나 별도 타입을 두어 이름을 부여하는 편이 읽기 좋다.
  - 제안: `type Cafe24PendingState = { scopesAdded: string[] }` 를 파일 상단 또는 `integrations.ts` 에 두고 참조한다.

- **[INFO]** `scope-tab.tsx` — `onSuccess` 분기에서 `onChanged()` 가 두 경우 모두 무조건 호출
  - 위치: `frontend/src/app/(main)/integrations/[id]/scope-tab.tsx` L604–L612
  - 상세: `cafe24_private_pending` 분기에서 `onChanged()`를 호출하면 부모가 integrations 데이터를 re-fetch 하게 된다. Cafe24 Private 경우에는 실제로 scope 가 아직 부여된 것이 아니라 "사용자가 Cafe24 Developers 에서 직접 활성화해야 함"이므로 re-fetch가 의미 있는지 재고할 필요가 있다. 코드 구조상 의도가 불분명하다.
  - 제안: 각 분기 안에서 `onChanged()` 호출 시점을 명확히 구분하거나, 주석으로 cafe24_private_pending 분기에서도 onChanged를 호출하는 이유를 설명한다.

- **[WARNING]** `scope-tab.tsx` — `ScopeTab` 컴포넌트가 여러 책임을 담당
  - 위치: `frontend/src/app/(main)/integrations/[id]/scope-tab.tsx` 전체(193줄)
  - 상세: 단일 컴포넌트가 (1) 현재 scope 목록 표시, (2) 부족한 scope 경고 표시, (3) Cafe24 Private pending 안내 alert 표시, (4) scope 선택 체크박스 렌더링, (5) mutation 실행 로직까지 5가지 역할을 수행한다. 193줄 분량이며 향후 분기가 더 추가되면 가독성이 급격히 떨어질 수 있다.
  - 제안: `CurrentScopesSection`, `MissingScopesAlert`, `Cafe24PendingAlert`, `ScopeSelector` 같은 sub-component 또는 custom hook(`useRequestScopesMutation`)으로 분리를 고려한다. 단, 현재 규모에서는 기능하므로 CRITICAL은 아니다.

- **[WARNING]** `scope-tab.tsx` — 동일한 `currentScopes.includes(s.value)` 표현식 두 번 사용
  - 위치: `frontend/src/app/(main)/integrations/[id]/scope-tab.tsx` L474 (disabled prop), L479 (이미 부여됨 badge)
  - 상세: 체크박스 렌더링 루프 안에서 `currentScopes.includes(s.value)` 가 동일 스코프에 대해 두 번 호출된다. 작은 배열에서는 성능 문제가 없지만 가독성·중복 관점에서 개선 여지가 있다.
  - 제안: 루프 body 상단에 `const isGranted = currentScopes.includes(s.value)` 로 변수를 추출하고 두 곳에서 재사용한다.

- **[INFO]** `scope-tab.test.tsx` — `buildIntegration` 팩토리 내 하드코딩된 날짜 문자열
  - 위치: `frontend/src/app/(main)/integrations/[id]/__tests__/scope-tab.test.tsx` L114–L115
  - 상세: `createdAt: "2026-05-16T00:00:00Z"`, `updatedAt: "2026-05-16T00:00:00Z"` 처럼 현재 날짜가 하드코딩되어 있다. 테스트 데이터에서 날짜가 실제로 검증되지 않으므로 의미 없는 매직 스트링이다. 시간이 지나면 "왜 이 날짜인가"라는 혼란을 줄 수 있다.
  - 제안: `new Date().toISOString()` 이나 고정 의미 없는 문자열(`"2000-01-01T00:00:00Z"`) 로 교체하거나, 그냥 빈 문자열/null 로 두고 타입이 허용한다면 생략한다.

- **[INFO]** `scope-tab.test.tsx` — `HostedScopeTab` 헬퍼 컴포넌트 내 `useT()` 호출 방식
  - 위치: `frontend/src/app/(main)/integrations/[id]/__tests__/scope-tab.test.tsx` L140–L150
  - 상세: `HostedScopeTab`은 `useT()` 훅을 사용해 `t` 를 얻어 `ScopeTab` 에 전달한다. 테스트가 훅 결합 방식을 래핑하고 있어서, 컴포넌트 인터페이스(`t` prop 주입 방식)가 실제 사용 패턴을 대표하는지 확인이 필요하다. 실제 page.tsx 에서 동일한 방식으로 t를 전달한다면 일관성은 있다.
  - 제안: 테스트 헬퍼 명칭을 `HostedScopeTab` 대신 `ScopeTabWithLocale` 등 역할이 드러나는 이름으로 변경한다.

- **[INFO]** `integrations.ts` — `OAuthBeginResult` 와 `RequestScopesResult` 의 중복 구조
  - 위치: `frontend/src/lib/api/integrations.ts` L15–L16, L798–L806
  - 상세: `OAuthBeginResult`의 두 변형(`{ authUrl; state }`, `{ mode: "cafe24_private_pending"; integrationId; appUrl; callbackUrl }`) 이 `RequestScopesResult`에서도 동일하게 반복되고, `cafe24_private_pending` 변형에만 `scopesAdded`가 추가된 차이다. 두 타입 간에 공유 가능한 `Cafe24PrivatePendingBase` 를 추출하면 향후 변경 시 두 곳을 동시에 수정하는 일을 피할 수 있다.
  - 제안:
    ```ts
    type Cafe24PrivatePendingBase = { mode: "cafe24_private_pending"; integrationId: string; appUrl: string; callbackUrl: string; };
    export type OAuthBeginResult = { authUrl: string; state: string } | Cafe24PrivatePendingBase;
    export type RequestScopesResult = { authUrl: string; state: string } | (Cafe24PrivatePendingBase & { scopesAdded: string[] });
    ```

- **[INFO]** `en.ts` — 긴 `cafe24PrivateScopeRequestDesc` 문자열에 개행 없음
  - 위치: `frontend/src/lib/i18n/dict/en.ts` L877
  - 상세: 한 줄로 이어진 긴 설명문이 80자를 훨씬 초과한다. 코드 리뷰나 git diff 에서 줄 전체를 읽어야 내용을 파악할 수 있다. 기존 i18n 파일의 다른 키들도 동일한 패턴이라면 일관성 문제는 없지만, 이 항목은 특히 길다.
  - 제안: 현 codebase 스타일상 허용 범위라면 그대로 두어도 무방하다. 파일 전체에서 이 패턴이 통일되어 있다면 WARNING 수준은 아니다.

---

## 요약

이번 변경은 기존에 단일 대형 파일(`page.tsx`)에 인라인으로 존재하던 `ScopeTab` 컴포넌트와 `openOAuthPopup` 함수를 각각 독립 모듈로 추출하고, Cafe24 Private pending 응답에 대한 UI 분기를 추가한 것으로 모듈 분리 방향은 올바르다. 전반적인 가독성과 네이밍 품질은 양호하며 i18n 일관성도 잘 유지되었다. 다만 `ScopeTab` 컴포넌트(193줄)가 상태 관리·mutation·렌더링을 모두 담당하는 점, `OAuthBeginResult`와 `RequestScopesResult` 간 구조적 중복, 그리고 루프 내 `currentScopes.includes()` 이중 호출이 소소한 유지보수 부담 요소로 남아 있다. 매직 넘버와 익명 상태 타입 등 가독성 관련 INFO 항목들은 현재 규모에서 즉각적인 위험을 초래하지는 않으나 컴포넌트가 확장될 때 혼란의 씨앗이 될 수 있다.

## 위험도

LOW
