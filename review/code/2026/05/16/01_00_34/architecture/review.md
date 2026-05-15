# Architecture Review — cafe24 Private request-scopes UI

## 발견사항

- **[INFO]** ScopeTab 모듈 추출 — 단일 책임 원칙(SRP) 준수
  - 위치: `frontend/src/app/(main)/integrations/[id]/scope-tab.tsx` (신규)
  - 상세: `page.tsx` 안에 인라인으로 존재하던 `ScopeTab` 컴포넌트와 `openOAuthPopup` 함수를 각각 별도 모듈(`scope-tab.tsx`, `open-oauth-popup.ts`)로 분리한 것은 SRP 관점에서 올바른 방향이다. Next.js page 파일의 named export 제약(테스트 직접 import 불가)을 해결하는 실용적인 근거도 있다. 추출 후 `page.tsx`는 라우팅·레이아웃 책임에 집중할 수 있게 되었다.
  - 제안: 현 구조 유지.

- **[INFO]** `RequestScopesResult` 타입 분리 — 인터페이스 분리 원칙(ISP) 긍정적 적용
  - 위치: `frontend/src/lib/api/integrations.ts` L798-L806
  - 상세: `OAuthBeginResult`(`authUrl | cafe24_private_pending`)와 `RequestScopesResult`(`authUrl | cafe24_private_pending + scopesAdded`)를 별도 Union 타입으로 선언했다. `requestScopes` 함수의 반환 타입이 이제 사용 호출측의 실제 필요(`scopesAdded`)를 정확히 표현한다. 두 타입이 구조적으로 일부 겹치지만, 사용 맥락(OAuth 시작 vs. 스코프 요청 결과)이 달라 분리가 정당하다.
  - 제안: 현 구조 유지. 향후 `OAuthBeginResult`와 `RequestScopesResult`의 공통 베이스(`cafe24_private_pending` 판별자 shape)를 공유 타입으로 추출하면 구조적 중복을 줄일 수 있으나, 현재 규모에서는 과도한 추상화일 수 있어 선택 사항이다.

- **[WARNING]** `openOAuthPopup` 의 위치 — 모듈 경계 불명확
  - 위치: `frontend/src/app/(main)/integrations/[id]/open-oauth-popup.ts`
  - 상세: `openOAuthPopup`은 integrations 상세 페이지 디렉토리(`[id]/`) 안에 위치한다. 그러나 이 함수는 OAuth 팝업을 여는 순수 유틸리티로서 특정 통합 인스턴스에 종속되지 않는다. 향후 다른 페이지(예: 새 통합 연결 플로우, 재인증 팝업)에서 재사용이 필요해질 때, 현재 위치에서 import하면 레이어 경계를 넘는 의존성이 생긴다(`app/` 내 한 라우트 세그먼트가 다른 라우트 세그먼트의 모듈을 참조하는 구조).
  - 제안: `frontend/src/lib/integrations/open-oauth-popup.ts` 또는 `frontend/src/lib/utils/open-oauth-popup.ts`로 이동하는 것을 검토한다. 현재는 단일 사용처이므로 즉각 이동은 불필요하지만, 두 번째 사용처가 생기기 전에 이동하는 것이 좋다.

- **[WARNING]** `ScopeTab` 내부의 Cafe24 특화 분기 하드코딩 — 개방-폐쇄 원칙(OCP) 잠재적 위반
  - 위치: `frontend/src/app/(main)/integrations/[id]/scope-tab.tsx` L605-L611
  - 상세: `onSuccess` 핸들러에서 `res.mode === "cafe24_private_pending"` 문자열 리터럴을 직접 비교한다. 현재는 Cafe24 Private 하나의 특수 케이스이지만, 향후 다른 통합(예: Shopify, Naver 등)이 유사한 비동기 pending 모드를 갖게 될 경우 `ScopeTab` 내부를 직접 수정해야 한다. `ScopeTab`은 통합 종류에 무관한 공용 컴포넌트를 지향해야 하는데, 서비스 식별자("`cafe24_private_pending`")가 프레젠테이션 컴포넌트 안에 직접 박혀 있어 확장성이 제한된다.
  - 제안: 단기적으로는 현 구조가 허용 범위 내다. 중기적으로는 `onSuccess` 결과의 분기 처리를 `ScopeTab` 외부(호출측 `page.tsx` 혹은 별도 훅)로 올리고, `ScopeTab`에는 `pendingAlert?: { title: string; desc: string; scopesAdded: string[] }` 같은 범용 prop을 전달하는 방식이 OCP를 더 잘 준수한다.

- **[INFO]** `cafe24Pending` 상태의 로컬 관리 — 레이어 책임 적절
  - 위치: `frontend/src/app/(main)/integrations/[id]/scope-tab.tsx` L595-L597
  - 상세: Cafe24 pending 응답 데이터를 컴포넌트 로컬 state(`useState`)로 관리한다. 이 데이터는 해당 탭 세션에만 유효한 UI 피드백이므로 전역 store나 서버 상태(React Query cache)에 올리지 않은 것은 올바른 레이어 판단이다. `onMutate`에서 pending 상태를 초기화하는 것도 mutation 라이프사이클과 잘 정렬되어 있다.
  - 제안: 현 구조 유지.

- **[INFO]** 테스트 파일 위치 — 모듈 경계와 일치
  - 위치: `frontend/src/app/(main)/integrations/[id]/__tests__/scope-tab.test.tsx`
  - 상세: `ScopeTab`을 별도 모듈로 추출함으로써 `__tests__/` 디렉토리에 단위 테스트를 위치시키는 Next.js 관례를 따를 수 있게 되었다. `vi.mock`을 통한 의존성 격리(`integrationsApi`, `next/navigation`)도 적절하다. `Wrapper`/`HostedScopeTab` 헬퍼로 테스트 설정을 분리한 구조도 가독성을 높인다.
  - 제안: 현 구조 유지.

- **[INFO]** 순환 의존성 없음
  - 상세: 변경된 모듈 간 의존 방향을 확인하면 `page.tsx` → `scope-tab.tsx` → `open-oauth-popup.ts`, `page.tsx` → `open-oauth-popup.ts`, `scope-tab.tsx` → `@/lib/api/integrations` 로 단방향 DAG를 형성하며 순환 참조가 없다.
  - 제안: 해당 없음.

---

## 요약

이번 변경은 `page.tsx`에 인라인되어 있던 `ScopeTab`과 `openOAuthPopup`을 독립 모듈로 추출하고, `RequestScopesResult` 타입을 `OAuthBeginResult`와 분리하여 Cafe24 Private pending 응답을 type-safe하게 처리하는 아키텍처 개선을 포함한다. SRP 및 ISP 관점에서 방향성은 올바르며, 단위 테스트 가능성도 높아졌다. 주요 주의점은 두 가지다. 첫째, `openOAuthPopup`이 특정 라우트 세그먼트(`[id]/`) 안에 위치해 재사용 시 레이어 경계 문제가 발생할 수 있으므로, 두 번째 사용처가 생기기 전에 `lib/` 계층으로 이동하는 것이 권장된다. 둘째, `ScopeTab` 내부에 `"cafe24_private_pending"` 문자열 리터럴이 직접 존재하는 구조는 OCP를 약하게 위반하며, 동일한 pending 패턴을 가진 다른 통합 서비스가 추가될 때 컴포넌트 수정이 불가피해진다는 점에서 중기적 리팩터링 대상으로 관리해야 한다.

## 위험도

LOW
