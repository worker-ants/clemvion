## Performance Code Review

### 발견사항

---

**[WARNING]** 요청 중복 실행 방지 전략 부재 — 캐싱 없이 매 클릭마다 네트워크 호출
- **위치**: `model-combobox.tsx` — `useMutation` 사용 전반
- **상세**: `useMutation`은 캐싱을 제공하지 않는다. 동일한 `provider` + `apiKey` 조합에 대해 버튼을 반복 클릭하면 매번 새로운 네트워크 요청이 발생한다. 같은 결과를 반환할 것이 보장된 요청임에도 중복 실행된다. `useQuery`에 `{ provider, apiKey, configId }` 조합을 캐시 키로 사용하면 동일 조합 재요청 시 캐시 히트로 처리하고 `staleTime`으로 TTL을 제어할 수 있다.
- **제안**: `useMutation` → `useQuery` + `enabled` 플래그 패턴으로 전환. 또는 `useMutation` 유지 시 이전 요청 결과를 `useRef`에 보관하고 동일 파라미터 재요청 시 스킵 처리.

---

**[WARNING]** 인-플라이트 요청 취소 미구현 — 불필요한 네트워크 리소스 소비
- **위치**: `model-combobox.tsx` — `loadMutation.mutationFn`
- **상세**: side_effect 리뷰에서 지적된 `provider` 변경 시 stale 결과 적용 문제는 UX 버그이기도 하지만 성능 문제이기도 하다. 이전 요청이 취소되지 않으므로 provider 변경이 빠르게 일어날 경우 복수의 인-플라이트 요청이 병행 실행되어 서버와 네트워크 대역폭을 낭비한다. axios는 `CancelToken` 또는 `AbortController`를 지원한다.
- **제안**: `mutationFn`에 `AbortController`를 주입하고, `onMutate` 또는 컴포넌트 unmount 시 `abort()` 호출. React Query v5의 경우 `mutationFn`의 `signal` 파라미터 활용.

---

**[WARNING]** 다수의 분리된 `setState` 호출 — 불필요한 다중 리렌더 가능성
- **위치**: `model-combobox.tsx` — `onSuccess` / `onError` 핸들러
- **상세**: `onSuccess`에서 `setModels(fetched)` + `setErrorMessage(null)` 두 개, `onError`에서 `setModels([])` + `setErrorMessage(msg)` 두 개의 setState가 순차 호출된다. React 18의 자동 배치(Automatic Batching)는 이벤트 핸들러와 Promise then 내부를 배치 처리하지만, `useMutation` 콜백 실행 컨텍스트에 따라 플러시 타이밍이 달라질 수 있다. 연관 상태를 단일 객체로 통합하면 배치 보장과 무관하게 항상 단일 리렌더로 수렴한다.
- **제안**: `{ models: string[], errorMessage: string | null }` 단일 `useReducer` 또는 `useState` 객체로 통합. `dispatch({ type: 'SUCCESS', models: fetched })` 형태로 원자적 업데이트.

---

**[INFO]** `onError` 시 `setModels([])` 호출 — 불필요한 리렌더 유발
- **위치**: `model-combobox.tsx` — `onError` 핸들러
- **상세**: side_effect 리뷰에서 UX 문제로 지적된 `setModels([])`는 성능 측면에서도 문제다. 이미 `models`가 빈 배열인 상태에서 에러가 발생하면 동일 값으로 setState가 호출되어 불필요한 리렌더가 트리거된다. React는 참조 동등성(`Object.is`)으로 state 변경을 감지하므로 새로 생성된 `[]`는 항상 이전 `[]`와 다른 참조다.
- **제안**: `setModels([])` 제거(side_effect 리뷰 제안과 일치). 제거할 수 없다면 `models.length > 0`일 때만 조건부로 호출.

---

**[INFO]** 테스트의 영구 대기 Promise — 메모리 누수 위험
- **위치**: `model-combobox.test.tsx` — testing 리뷰 내 `isPending` 케이스 제안 코드
- **상세**: testing 리뷰가 제안한 `() => new Promise(() => {})` 패턴은 resolve/reject되지 않아 GC 대상이 되지 않는 Promise를 생성한다. 테스트 수가 늘어나거나 해당 케이스가 반복 실행되면 누적된 pending Promise가 메모리를 점유한다. Vitest는 `--pool=forks` 환경에서 워커 프로세스를 재활용하므로 누수가 빌드 전체에 걸쳐 누적될 수 있다.
- **제안**: `vi.useFakeTimers()` + 수동 진행 또는 `deferred Promise` 패턴 사용:
  ```ts
  let resolve: () => void;
  vi.mocked(llmConfigsApi.previewModels).mockImplementation(
    () => new Promise((res) => { resolve = res; })
  );
  // ... test ...
  resolve!(); // cleanup
  ```

---

**[INFO]** `document.querySelectorAll("datalist option")` — 전체 DOM 탐색
- **위치**: `model-combobox.test.tsx` — `calls previewModels ... and renders chat-only options` 케이스
- **상세**: `document.querySelectorAll`은 테스트 환경의 전체 DOM 트리를 선형 탐색한다. 테스트가 많아지고 컴포넌트 DOM이 복잡해지면 탐색 비용이 누적된다. 테스트 성능 자체에 미치는 영향은 미미하나, 격리된 컨테이너 내에서 쿼리하는 것이 원칙에 맞다.
- **제안**: `container.querySelectorAll("datalist option")` (`render`가 반환하는 `{ container }` 사용)로 범위 제한.

---

### 요약

성능 관점에서 가장 영향이 큰 문제는 두 가지다. 첫째, `useMutation` 기반 구현이 동일 파라미터에 대한 캐싱 없이 매 클릭마다 네트워크 요청을 발생시키며, 인-플라이트 요청 취소 로직이 없어 provider 전환 시 불필요한 병렬 요청이 누적된다. 둘째, `onSuccess`/`onError`에서 분리된 다중 `setState` 호출이 리렌더를 추가로 유발할 수 있다. 나머지 문제들(영구 대기 Promise, querySelectorAll 범위)은 테스트 환경에 한정되며 실제 런타임 성능에는 영향이 없다. 전반적으로 API 응답 캐싱 전략 부재가 가장 개선 효과가 크다.

### 위험도
**LOW**