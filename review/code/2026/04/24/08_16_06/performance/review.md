### 발견사항

---

**[WARNING] mutation 완료 시 불필요한 이중 렌더**
- 위치: `model-combobox.tsx:57-70` — `onSuccess`/`onError` 콜백
- 상세: mutation 상태 전환(`isPending → isSuccess/isError`)이 첫 번째 렌더를 유발하고, `setModels(fetched)` + `setErrorMessage(null)` 호출이 두 번째 렌더를 추가로 유발한다. React 18 자동 배칭이 동일 마이크로태스크 내에서 일부를 묶어주지만, `useState`와 `useMutation.data`라는 두 개의 진실 소스가 동기화되는 지점마다 렌더가 두 번 발생하는 구조는 해소되지 않는다.
- 제안: `models` / `errorMessage` 로컬 state 제거 후 `loadMutation.data`와 `loadMutation.error`에서 직접 파생. `chatModels`는 `useMemo(() => (loadMutation.data ?? []).filter(m => m.type === 'chat'), [loadMutation.data])`로 처리.

---

**[WARNING] 동일 자격증명 반복 클릭 시 결과 캐싱 없음**
- 위치: `model-combobox.tsx:36-72` — `loadMutation`
- 상세: `useMutation`은 결과를 캐시하지 않는다. `isPending` 중 버튼은 비활성화되지만 완료 후 즉시 재클릭하면 동일 `(provider, apiKey, baseUrl)` 조합으로 외부 Provider API가 재호출된다. Rate Limit(10/60s)이 백엔드에 걸려 있으나 10회 소진 전까지 중복 외부 API 비용이 발생한다.
- 제안: `useQuery`로 전환하고 `queryKey: ['preview-models', provider, trimmedKey, trimmedBaseUrl]`, `staleTime: 60_000`, `gcTime: 0`으로 설정하면 동일 파라미터 재사용 시 캐시를 반환. 단, API Key를 queryKey에 포함하는 것이 보안 정책("API Key를 캐시에 저장하지 않는다")과 상충하는지 팀 정책 결정이 선행되어야 한다.

---

**[INFO] `apiKey.trim()` 중복 평가**
- 위치: `model-combobox.tsx:44` (`mutationFn`), `model-combobox.tsx:84` (`canLoad` useMemo)
- 상세: `trimmedKey = apiKey.trim()`이 `mutationFn` 내에서, `apiKey.trim().length > 0`이 `canLoad` useMemo 내에서 각각 독립적으로 계산된다. O(n) 연산이고 문자열이 짧아 실측 영향은 없으나 일관성이 낮다.
- 제안: `canLoad`는 memoized이므로 현행 유지 가능. `mutationFn` 내부의 `trimmedKey`는 이미 변수로 추출되어 있어 문제없음.

---

**[INFO] `ValidateIf`의 `Array.includes` — Set 전환 고려**
- 위치: `preview-llm-models.dto.ts:43`
- 상세: `PROVIDERS_REQUIRING_BASE_URL.includes(dto.provider)`는 `ReadonlyArray`에 대한 O(n) 탐색이다. 현재 배열 크기가 2이므로 실질적 영향은 없으나, 프론트엔드의 `PROVIDERS_REQUIRING_BASE_URL = new Set([...])` 패턴과 일관성이 없다.
- 제안: `const PROVIDERS_REQUIRING_BASE_URL: ReadonlySet<LlmProvider> = new Set(['azure', 'local'])`으로 변경하면 O(1) 조회 + 프론트엔드 패턴과 일치.

---

### 요약

성능 위험의 중심은 `model-combobox.tsx`에 있다. `onSuccess`/`onError`에서 로컬 state를 갱신하는 패턴이 mutation 상태 전환마다 렌더를 이중 유발하며, `useMutation`의 결과 캐싱 부재로 동일 자격증명에 대한 반복 외부 API 호출이 발생한다. 후자는 백엔드 Rate Limit으로 남용이 제한되나 한도 내에서는 여전히 불필요한 비용이다. `useQuery`로의 전환이 두 문제를 동시에 해소하지만 API Key의 queryKey 포함 여부에 대한 보안 정책 결정이 전제된다. 나머지 지적(trim 중복 평가, Array vs Set)은 코드 일관성 수준의 INFO이며 즉각적인 성능 위험은 없다.

### 위험도

**LOW**