## Side Effect Code Review

### 발견사항

---

**[WARNING]** `onError` 핸들러가 이전 성공 결과를 무조건 초기화
- **위치**: `model-combobox.tsx` — `onError` 핸들러 `setModels([])`
- **상세**: 모델 목록을 성공적으로 로드한 뒤 사용자가 버튼을 재클릭해 에러가 발생하면, 이미 렌더된 datalist 옵션 전체가 사라진다. `value` state(선택된 모델명)는 유지되지만 드롭다운 후보 목록은 초기화된다. 이전 성공 결과를 보존하면서 에러만 표시하는 것이 UX상 더 안전하다.
- **제안**: `onError`에서 `setModels([])` 제거 후 이전 목록 유지. 에러 메시지만 업데이트한다.

---

**[WARNING]** `mutationFn` 클로저와 `onSuccess` 핸들러 간 props 불일치 가능성
- **위치**: `model-combobox.tsx` — `loadMutation.mutationFn` / `onSuccess`
- **상세**: `mutationFn`은 버튼 클릭 시점의 `provider`, `apiKey`, `configId`를 클로저로 캡처한다. 그러나 `onSuccess(fetched)`는 항상 실행되며, 요청 중 부모 컴포넌트가 `provider`를 `openai → anthropic`으로 바꾼 경우 openai 모델 목록이 anthropic 컨텍스트에 세팅된다. `useMutation`은 자동 취소를 하지 않으므로 stale 결과가 silently 적용된다. (concurrency 리뷰에서도 지적됨)
- **제안**: `mutationFn`에서 `variables`로 캡처한 `{ provider, apiKey }` 를 `onSuccess`의 클로저로 전달하고, 현재 props와 비교해 일치할 때만 `setModels`를 호출한다.

---

**[WARNING]** 재클릭 시 이전 에러 메시지가 즉시 초기화되지 않음
- **위치**: `model-combobox.tsx` — `loadMutation` — `onMutate` 핸들러 부재
- **상세**: 에러 상태에서 사용자가 버튼을 다시 클릭하면, 새 요청이 완료될 때까지 이전 에러 메시지가 그대로 표시된다. `onSuccess`에서 `setErrorMessage(null)`을 호출하지만 그 시점은 요청 완료 후다. `isPending` 중에 에러 메시지가 함께 표시되어 UI 상태가 혼재한다.
- **제안**: `onMutate: () => { setErrorMessage(null); }` 추가.

---

**[INFO]** `useSavedConfig && configId` 이중 검사 — 논리 중복 (side effect 없음)
- **위치**: `model-combobox.tsx:44–47`
- **상세**: `useSavedConfig = Boolean(configId) && !trimmedKey` 이므로 `if (useSavedConfig && configId)` 에서 `&& configId` 는 항상 true일 때만 진입하므로 중복 검사다. 런타임 동작에 영향 없으나 가독성을 낮춘다.
- **제안**: `if (useSavedConfig)` 로 단순화.

---

**[INFO]** `model-combobox.test.tsx` — 에러 mock이 동기 throw 사용
- **위치**: `model-combobox.test.tsx` — "shows a sanitized error message" 케이스
- **상세**: `mutationFn`이 `async`이므로 동기 `throw`는 async wrapper에 의해 rejection으로 변환되어 현재는 동작한다. 그러나 이 패턴은 실제 axios 에러 응답 형태(rejected Promise)와 다르며, 향후 `mutationFn` 내부에서 try/catch가 추가되면 동기 throw가 catch로 흡수되어 `onError`가 호출되지 않을 수 있다.
- **제안**: `vi.mocked(llmConfigsApi.previewModels).mockRejectedValue(...)` 로 변경해 의미상 정확도 확보.

---

**[INFO]** `llm-configs.test.ts` — `beforeEach` + `afterEach` mock 정리 중복
- **위치**: `llm-configs.test.ts:15–19`
- **상세**: `beforeEach(() => vi.clearAllMocks())` 와 `afterEach(() => vi.restoreAllMocks())` 가 함께 있다. `vi.clearAllMocks()`는 호출 기록을 초기화하고, `vi.restoreAllMocks()`는 spy를 원래 구현으로 복원한다. 이 파일에서는 `vi.mock()`으로 전체 모듈을 대체하므로 `restoreAllMocks`가 의도한 효과를 내지 않는다(모듈 mock은 `vi.resetModules()`가 필요). 기능상 무해하나 의도가 불명확하다.
- **제안**: `afterEach(() => vi.restoreAllMocks())` 제거 또는 주석으로 의도 명시.

---

### 요약

`model-combobox.tsx`의 핵심 부작용은 세 가지다. ① `onError`에서 `setModels([])`가 이전 성공 결과를 무조건 초기화해 재시도 실패 시 사용자가 이미 로드한 datalist 옵션을 잃는다. ② `useMutation` 클로저와 `onSuccess` 핸들러 사이에 props 불일치가 발생할 경우 stale 제공자의 모델 목록이 silently 적용된다. ③ `onMutate` 미구현으로 재클릭 시 이전 에러 메시지가 pending 중에도 표시된다. 테스트 파일에서는 동기 throw 패턴이 향후 try/catch 변경에 취약할 수 있으나 현재는 동작한다. 전반적으로 DB·파일시스템·전역 상태에 대한 의도치 않은 부작용은 없으며, 위험은 UI 상태 관리 수준에 집중된다.

### 위험도
**LOW**