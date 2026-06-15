# 동시성(Concurrency) 리뷰 결과

## 발견사항

### [INFO] handleSelect의 중복 클릭 방지 — loadingId 가드 설계 검토

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/components/editor/run-results/execution-history-panel.tsx` L310–342, L406
- 상세:
  `handleSelect`는 `setLoadingId(id)` → `await executionsApi.getById(id)` → `loadHistoricalExecution(detail)` → `onClose()` 순으로 동작한다.
  버튼 수준에서 `disabled={loadingId !== null}` 로 진입을 막으므로, 첫 클릭 이후 동일 버튼이 재클릭될 여지는 실질적으로 없다.
  단, `disabled` 속성은 키보드 포커스 이동 + Enter 연타, 또는 동일 렌더 사이클 내 빠른 이중 이벤트(ex. touch + click) 시 브라우저 구현에 따라 두 번 이벤트가 발행될 수 있다. 이 경우 `loadingId` 상태 업데이트가 아직 적용되기 전에 두 번째 `handleSelect` 호출이 시작되어, 병렬로 두 요청이 진행될 수 있다.
  현재 구현에서 두 번째 요청이 완료되면 `loadHistoricalExecution`이 두 번 호출되고 `onClose`가 두 번 호출된다. React 상태 업데이트 비동기성 특성상 이론적 경쟁 창이 존재한다.
- 제안:
  `handleSelect` 내부에 ref 기반 in-flight 가드를 추가하면 완전히 차단할 수 있다. 예: `const inFlight = useRef(false)` → 함수 진입 시 `if (inFlight.current) return; inFlight.current = true;` → finally에서 `inFlight.current = false;`. 또는 `useCallback` 의존 배열에 `loadingId`를 추가하여 `loadingId !== null`일 때 조기 반환하는 가드를 함수 최상단에 배치한다. 현재 의존 배열 `[onClose, t]`에 `loadingId`가 없어 클로저가 오래된 값을 캡처할 가능성도 있다.

---

### [INFO] useCallback 의존 배열 누락 — loadingId 클로저 캡처

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/components/editor/run-results/execution-history-panel.tsx` L326, deps: `[onClose, t]`
- 상세:
  `handleSelect`가 `loadingId` 상태를 직접 읽지는 않지만, 이 콜백 안에서 `setLoadingId`를 호출한다. `setLoadingId`는 setter라 deps에 불필요하다. 그러나 만약 향후 `loadingId !== null`이면 조기 반환하는 가드를 이 함수 안에 추가하면 반드시 deps에 `loadingId`를 포함해야 한다. 현재는 문제없지만, 가드 추가 시 누락 위험이 있다.
- 제안:
  in-flight ref 방식을 채택하면 deps 관리 문제를 피할 수 있다.

---

### [INFO] 테스트 내 미해소 Promise — cleanup 후 상태 업데이트 경고 가능성

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/components/editor/run-results/__tests__/execution-history-panel.test.tsx` L118, L207–211
- 상세:
  `조회 중에는 로딩 UI 를 렌더한다` 테스트에서 `new Promise(() => {})` (미해소 Promise)를 반환하여 로딩 상태를 유지한다. 테스트가 끝난 후 `beforeEach`의 `cleanup()`이 컴포넌트를 언마운트하지만, 언마운트 이후 React Query가 내부적으로 상태 업데이트를 시도하면 "Can't perform a React state update on an unmounted component" 경고가 발생할 수 있다. vitest 환경에서는 React Query의 `QueryClient`가 `cancelQueries`를 자동 호출하지 않으므로 잠재적 노이즈 소스가 된다.
  `적재 진행 중(loadingId)에는 항목 버튼이 disabled 된다` 테스트도 `resolveDetail?.(...)`로 테스트 종료 전 정리하나, `waitFor` 없이 완료 처리를 마치지 않아 다음 테스트에서 비동기 flush가 교차할 수 있다.
- 제안:
  `renderPanel` 유틸에서 `QueryClient`를 생성할 때 `unmountOnUnmount` 또는 `afterEach(() => qc.clear())` 패턴을 적용한다. 미해소 Promise 테스트 이후 `cleanup()`이 `beforeEach`에서 호출되므로 현재 순서상 실질 문제는 적으나, 명시적으로 `qc.destroy()`를 afterEach에 두는 것이 안전하다.

---

## 요약

변경 코드는 단일 스레드 브라우저 이벤트 루프에서 동작하는 React 컴포넌트로, 전통적 의미의 멀티스레드 동시성 문제(mutex, 데드락, 공유 메모리 경쟁 등)는 해당 없다. 주목할 부분은 `handleSelect`의 중복 클릭 방지 로직이다. `disabled={loadingId !== null}` UI 가드가 실질적으로 잘 동작하나, React 상태 업데이트 비동기성으로 인해 이론적 경쟁 창이 존재한다. in-flight ref 가드를 추가하면 완전히 닫을 수 있다. `useCallback` 의존 배열에 `loadingId`가 없는 점은 현재 구현에서는 무해하지만 향후 가드 추가 시 버그 유입 경로가 될 수 있다. 테스트의 미해소 Promise 패턴은 React Query 내부 상태 업데이트 경고를 유발할 수 있는 가벼운 잠재 노이즈다. 전반적으로 async/await 사용은 올바르고, await 누락, 이벤트 루프 블로킹, 콜백 지옥 등의 문제는 없다.

## 위험도

LOW
