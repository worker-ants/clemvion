# 테스트(Testing) 리뷰

## 발견사항

- **[INFO]** `Wrapper` 컴포넌트가 매 render 호출마다 새 `QueryClient` 인스턴스를 생성함
  - 위치: `scope-tab.test.tsx` 라인 74-77
  - 상세: `Wrapper` 함수 내부에서 `new QueryClient(...)` 를 직접 생성하면, React Testing Library 가 wrapper 를 재렌더링할 때마다 새 인스턴스가 만들어진다. 현재 테스트는 단일 render 이고 테스트 격리도 `cleanup()` 으로 충분히 처리되므로 즉각적인 문제는 없지만, 다른 테스트가 동일 패턴을 복사·확장할 때 캐시 공유 문제로 이어질 수 있다. `beforeEach` 또는 test body 에서 인스턴스를 만들고 wrapper 에 주입하는 패턴이 더 안전하다.
  - 제안: `beforeEach` 에서 `queryClient = new QueryClient(...)` 를 생성하고 `afterEach` 에서 `queryClient.clear()` 를 호출하는 방식으로 전환할 것.

- **[WARNING]** `onChanged` 콜백 호출 검증이 누락됨
  - 위치: `scope-tab.test.tsx` 라인 85, `scope-tab.tsx` 라인 611
  - 상세: `ScopeTab` 은 `onSuccess` 에서 분기 종류(cafe24_private_pending / authUrl)에 무관하게 항상 `onChanged()` 를 호출한다. 이는 부모 컴포넌트가 integration 데이터를 갱신하는 핵심 사이드이펙트다. 두 테스트 케이스 모두 `onChanged` 가 실제로 호출됐는지 검증하지 않으므로, 이 콜백이 실수로 제거되거나 조건문 안으로 이동해도 테스트가 통과하는 회귀 취약성이 있다.
  - 제안: `onChanged` 를 `vi.fn()` 으로 교체하고 양쪽 테스트에 `expect(onChangedMock).toHaveBeenCalledTimes(1)` 단언을 추가할 것.

- **[WARNING]** 오류 분기(`onError`) 테스트 케이스 없음
  - 위치: `scope-tab.tsx` 라인 614, 테스트 파일 전체
  - 상세: `requestMutation.onError` 에서 `toast.error(t("integrations.requestScopesFailed"))` 를 호출하는 경로가 테스트되지 않는다. API 실패 시 에러 toast 가 표시되고 cafe24Pending 상태가 null 로 유지되는지 확인하는 케이스가 없다.
  - 제안: `requestScopesMock.mockRejectedValue(new Error("500"))` 으로 실패 시나리오 테스트를 추가하고, `toast.error` mock 을 통해 에러 메시지 노출 여부를 검증할 것.

- **[WARNING]** `cafe24Pending` 재설정(reset) 동작이 테스트되지 않음
  - 위치: `scope-tab.tsx` 라인 601-603, 테스트 파일 전체
  - 상세: `onMutate` 에서 `setCafe24Pending(null)` 을 호출해 이전 pending 알림을 지우는 로직이 있다. "첫 번째 요청이 cafe24_private_pending → 두 번째 요청 제출 → 알림이 사라지는지" 를 검증하는 케이스가 없다. 이 케이스를 커버하지 않으면 UI 상태 누적 버그를 놓칠 수 있다.
  - 제안: 순차적으로 두 번 mutate 하는 테스트를 추가해 두 번째 요청 시작 시점에 `queryByRole("status")` 가 null 임을 단언할 것.

- **[INFO]** `authUrl` 분기 테스트에서 `toast.success` 호출 검증 없음
  - 위치: `scope-tab.test.tsx` 라인 141-170
  - 상세: authUrl 분기에서 `openOAuthPopup` 호출 여부는 검증하지만, `toast.success(t("integrations.scopeRequestOpened"))` 호출은 확인하지 않는다. toast 는 UX 피드백의 일부이므로 회귀 방지를 위해 검증이 권장된다.
  - 제안: `vi.mock("sonner", ...)` 으로 toast 를 mock 하고 `expect(toast.success).toHaveBeenCalled()` 를 추가할 것.

- **[INFO]** `scopesAdded` 가 빈 배열일 때 UI 처리 경계 케이스 누락
  - 위치: `scope-tab.tsx` 라인 681, 테스트 파일 전체
  - 상세: `cafe24Pending.scopesAdded.length > 0` 조건으로 scope 목록을 조건부 렌더링하는 분기가 있다. `scopesAdded: []` 로 응답이 왔을 때 scope 목록이 렌더링되지 않고 타이틀/설명만 표시되는지 확인하는 케이스가 없다.
  - 제안: `scopesAdded: []` 를 담은 응답으로 테스트를 추가하고, `mall.write_product` / `mall.read_order` 같은 텍스트가 없음을 단언할 것.

- **[INFO]** `openOAuthPopup` 유틸의 독립 단위 테스트 부재
  - 위치: `frontend/src/app/(main)/integrations/[id]/open-oauth-popup.ts`
  - 상세: `openOAuthPopup` 이 공용 모듈로 추출됐으나 별도 단위 테스트가 없다. 현재 `scope-tab.test.tsx` 의 authUrl 분기 테스트가 `window.open` spy 로 간접 검증하고 있어 기능 회귀는 감지 가능하다. 다만 팝업 창 크기·위치 계산 로직 자체는 커버되지 않는다. 복잡도가 낮아 즉각적인 위험은 없으나 재사용 빈도가 늘면 별도 테스트가 권장된다.
  - 제안: `open-oauth-popup.test.ts` 를 추가해 `window.open` 호출 시 전달되는 feature string(width, height 등)을 검증할 것.

- **[INFO]** `QueryClient` mutation 옵션에 `retry: false` 설정 없음
  - 위치: `scope-tab.test.tsx` 라인 75
  - 상세: `defaultOptions.queries.retry: false` 는 설정됐지만 `mutations` 에 대한 retry 설정이 없다. TanStack Query v5 에서 mutation 기본 retry 는 0 이라 실제로는 문제 없지만, 명시적 선언이 있으면 테스트 의도가 더 명확해진다.
  - 제안: `defaultOptions: { queries: { retry: false }, mutations: { retry: false } }` 로 명시할 것 (선택 사항).

- **[INFO]** `non-oauth2` authType 분기 테스트 없음
  - 위치: `scope-tab.tsx` 라인 617-622, 테스트 파일 전체
  - 상세: `authType !== "oauth2"` 일 때 "Scope management is only available for OAuth integrations." 안내만 표시하는 얼리 리턴 분기가 존재하지만 테스트 케이스가 없다.
  - 제안: `buildIntegration({ authType: "api_key" })` 를 사용해 해당 분기의 렌더링 결과를 검증하는 케이스를 추가할 것.

## 요약

이번 변경에서 핵심 신규 기능인 `cafe24_private_pending` 분기와 기존 `authUrl` 분기 모두에 대해 컴포넌트 단위 테스트가 추가됐으며, ScopeTab 을 별도 모듈로 분리함으로써 Next.js page 파일의 named export 제약을 극복한 점은 테스트 용이성 측면에서 긍정적이다. mock 모듈 구성도 실제 API 모듈 구조에 충실하며 격리 실행(`vi.clearAllMocks`, `cleanup`)도 적절하다. 그러나 `onChanged` 콜백 호출 미검증, 오류 분기(`onError`) 테스트 부재, `onMutate` 의 상태 리셋 동작 비검증 등 핵심 사이드이펙트에 대한 회귀 방지 케이스가 누락되어 있어 기능 변경 시 이 코드 경로들이 조용히 깨질 위험이 있다. `onChanged` 와 `onError` 케이스 보완이 가장 시급하다.

## 위험도

MEDIUM
