### 발견사항

- **[INFO]** `useMutation` onSuccess 내 상태 업데이트 순서 — `onChanged()` 호출 후 부모 리렌더가 먼저 발생할 때 `cafe24Pending` 상태가 외부 갱신으로 덮어쓰일 가능성
  - 위치: `scope-tab.tsx` 607~616번 라인, `onSuccess` 콜백
  - 상세: `setCafe24Pending({ scopesAdded: res.scopesAdded })` 를 설정한 직후 `onChanged()` 를 호출한다. `onChanged` 가 부모에서 통합 데이터를 refetch 하면 부모가 `ScopeTab` 을 새 props 로 리렌더하거나 언마운트·재마운트할 수 있다. React 의 배치 업데이트 덕분에 같은 동기 tick 안에서는 안전하지만, `onChanged` 내부가 `invalidateQueries` 등 비동기 refetch 를 유발하는 경우 해당 비동기 흐름이 완료되기 전에 `cafe24Pending` 이 표시된다는 점은 의도된 설계다. 현재 구현상 실질적 결함은 없으나, `onChanged` 의 구현이 동기인지 비동기인지에 따라 UI 표시 순서가 달라질 수 있음을 인지해야 한다.
  - 제안: `onChanged()` 호출을 `setCafe24Pending` 보다 앞에 두거나, `onChanged` 의 계약(동기/비동기)을 타입 또는 주석으로 명시해 향후 구현 변경 시 주의를 환기한다.

- **[INFO]** `onMutate` 에서 `setCafe24Pending(null)` 리셋 — 중복 요청 방지 처리 확인
  - 위치: `scope-tab.tsx` 604~606번 라인, `onMutate` 콜백
  - 상세: `requestMutation.isPending` 으로 버튼을 `disabled` 처리하므로 동시 중복 요청은 UI 수준에서 차단된다. `useMutation` 자체도 단일 pending 인스턴스를 관리하므로 경쟁 조건 없이 안전하다.
  - 제안: 현재 구현으로 충분하다. 추가 조치 불필요.

- **[INFO]** `openOAuthPopup` 의 팝업 창 참조 미관리
  - 위치: `open-oauth-popup.ts` 전체 (11 라인)
  - 상세: `window.open` 의 반환값(팝업 창 참조)을 버린다. 팝업이 이미 열린 상태에서 사용자가 다시 요청을 실행할 경우 새 팝업이 중복 생성될 수 있다. 다만 현재 코드에서는 mutation `isPending` 동안 버튼이 비활성화되어 중복 호출 가능성이 낮고, `window.open` 의 두 번째 인자 `"integration-oauth"` 로 동일 이름 팝업은 재사용되므로 실질적 중복 창 문제는 발생하지 않는다. 팝업 닫힘 감지(polling `closed`)는 이 모듈 범위 밖이며 기존 코드와 동일하다.
  - 제안: 현재 동작은 허용 가능하나, 향후 팝업 닫힘 후 콜백 처리가 필요해지면 창 참조를 `useRef` 로 관리하는 방향을 고려한다.

- **[INFO]** 테스트의 `QueryClient` 인스턴스를 `Wrapper` 컴포넌트 안에서 매번 생성
  - 위치: `scope-tab.test.tsx` 138~141번 라인
  - 상세: `Wrapper` 가 리렌더될 때마다 새 `QueryClient` 인스턴스가 생성된다. 테스트 환경에서는 `render` 마다 독립된 클라이언트가 보장되므로 의도된 패턴이지만, 프로덕션 컴포넌트에서 동일 패턴을 적용하면 리렌더마다 캐시가 초기화되는 문제가 발생한다. 테스트 코드이므로 실제 위험은 없다.
  - 제안: 테스트 코드 범위에서는 문제없다. 실수로 프로덕션 컴포넌트에 동일 패턴이 복사되지 않도록 주석으로 "test-only" 를 명시하면 좋다.

### 요약

이번 변경은 React 단일 스레드 이벤트 루프 위에서 동작하는 프론트엔드 UI 코드이며, 멀티스레드·공유 메모리 동시성 문제는 구조적으로 발생하지 않는다. `useMutation` 을 통한 비동기 API 호출은 React Query 의 lifecycle 내에서 올바르게 관리되고 있고, `isPending` 으로 중복 요청이 UI 수준에서 차단된다. `onMutate` 에서 알림 상태를 초기화하고 `onSuccess` 에서 설정하는 패턴도 React 의 동기 배치 업데이트 내에서 안전하다. `openOAuthPopup` 은 동명 팝업 재사용 메커니즘(`window.open` 두 번째 인자)을 통해 중복 창 생성을 암묵적으로 방지하고 있다. 발견된 항목 4건은 모두 INFO 수준으로, 현재 구현에 즉각적인 동시성 결함은 없다.

### 위험도
NONE
