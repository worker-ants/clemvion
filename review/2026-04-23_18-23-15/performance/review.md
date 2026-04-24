## 발견사항

---

- **[WARNING]** mutation 완료 시 이중 렌더 사이클 발생
  - 위치: `model-combobox.tsx:57-70` — `onSuccess`/`onError` 콜백
  - 상세: `useMutation`의 상태 변경(`isPending → isSuccess/isError`)이 렌더를 한 번 유발한 뒤, `setModels(fetched)` + `setErrorMessage(null)`이 추가로 상태 변경을 발생시켜 렌더가 최소 2회 연속으로 실행된다. `loadMutation.data`와 `loadMutation.error`를 직접 파생하면 mutation 완료 시 단일 렌더로 수렴한다.
  - 제안: local `models`/`errorMessage` state 제거 후 `loadMutation.data`, `loadMutation.isError`에서 직접 파생. `chatModels`는 `useMemo(() => (loadMutation.data ?? []).filter(m => m.type === 'chat'), [loadMutation.data])` 로 처리.

- **[WARNING]** 동일 자격증명 반복 클릭 시 결과 캐싱 없음
  - 위치: `model-combobox.tsx:36-72` — `loadMutation`
  - 상세: `useMutation`은 결과를 캐시하지 않는다. provider/apiKey가 바뀌지 않았더라도 버튼 재클릭 시 외부 Provider API를 다시 호출한다. `isPending` 중 버튼은 비활성화되지만 완료 후 즉시 재클릭 가능하다.
  - 제안: `useQuery`로 전환하고 `queryKey: ['preview-models', provider, trimmedKey, trimmedBaseUrl]`로 설정하면 동일 파라미터에서 캐시를 재사용. 버튼 클릭은 `refetch()`로 트리거. 단, 이는 보안 정책(API key를 캐시에 저장하지 않는다는 원칙)과 상충하므로 세션 범위 내 단기 캐싱(`staleTime: 60_000`, `gcTime: 0`)만 허용할 것인지 명확히 결정 필요.

- **[INFO]** `apiKey.trim()` 중복 평가
  - 위치: `model-combobox.tsx:44,90` — `mutationFn`과 `canLoad` useMemo
  - 상세: `apiKey.trim()`이 `mutationFn` 내부와 `canLoad` useMemo 내부에서 각각 독립적으로 계산된다. 문자열 trim은 O(n)이고 실용적 성능 영향은 없지만, `mutationFn` 실행 시점에 이미 `canLoad`가 계산된 후이므로 결과를 props 수준에서 공유할 기회가 있다.
  - 제안: `canLoad` 범위 수정은 불필요하나 `mutationFn`의 `trimmedKey`는 이미 변수로 추출되어 있음. 현행 유지.

- **[INFO]** `wrap()` 함수에서 테스트마다 새 `QueryClient` 생성
  - 위치: `model-combobox.test.tsx:18-23` — `wrap` 함수
  - 상세: 각 `it` 블록마다 `new QueryClient()`를 생성한다. 테스트 격리 측면에서 올바른 설계이나, `beforeEach`에서 한 번 생성하고 `afterEach`에서 `qc.clear()`를 호출하는 패턴이 더 명시적이다. 현재 규모에서 성능 영향은 없다.
  - 제안: 현행 유지. 테스트 격리가 더 중요한 가치.

- **[INFO]** `PROVIDERS_REQUIRING_BASE_URL` 모듈 수준 `Set` — 올바른 설계
  - 위치: `model-combobox.tsx:34`
  - 상세: 렌더마다 재생성되지 않고 `Set.has()`로 O(1) 조회. 향후 provider 목록이 늘어도 `canLoad` 계산 비용에 영향 없다.

---

## 요약

성능 관점에서 주요 위험은 두 가지다. 첫째, `onSuccess`/`onError`에서 local state를 갱신하는 패턴이 mutation 완료 시 렌더를 2회 유발한다. 이는 mutation 데이터를 직접 파생하는 방식으로 단일 렌더로 줄일 수 있다. 둘째, `useMutation`의 결과 캐싱 부재로 동일 자격증명에 대한 반복 외부 API 호출이 발생할 수 있다. 단, `useQuery` 캐싱은 "API key를 캐시에 저장하지 않는다"는 보안 원칙과 상충하므로 명확한 정책 결정이 선행되어야 한다. 나머지는 실용적 영향이 없는 INFO 수준이다. 백엔드의 Rate Limiting·Timeout 부재는 기존 performance 리뷰에서 이미 CRITICAL/WARNING으로 다루었으며 RESOLUTION.md에서 조치 완료 기재됨.

## 위험도

**LOW** — 렌더 이중 발생은 UX 체감 지연으로 이어지지 않으며, 캐싱 부재는 C-1 Rate Limiting(조치 완료)으로 백엔드에서 차단됨. 프론트엔드 단독 성능 위험은 낮다.