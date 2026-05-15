### 발견사항

**[INFO]** `ModelCombobox` — props 변경과 응답 도착 타이밍 겹칠 때 stale 모델 목록 렌더 가능성
- 위치: `model-combobox.tsx:57-70` — `onSuccess` 콜백
- 상세: `mutationFn`은 호출 시점의 `provider`/`apiKey`/`configId`를 클로저로 캡처한다. `disabled={... || loadMutation.isPending}` 가드로 동시 중복 발사는 차단되지만, 요청 진행 중 부모 폼에서 `provider`를 openai → anthropic으로 바꾸면 응답 도착 시 `onSuccess: (fetched) => setModels(fetched)`가 구(舊) provider의 모델 목록으로 state를 덮는다. 치명적 데이터 손상은 아니고 모델 선택 UX 오류 수준이며, 버튼 클릭 기반 사용자 인터랙션에서 실제 발생 빈도는 낮다.
- 제안: `useMutation`의 `variables`에 요청 시점 파라미터를 담아 `onSuccess` 내에서 현재 props와 비교 후 불일치 시 무시. 혹은 `useQuery`로 전환해 `queryKey: ['preview-models', provider, apiKey, baseUrl]`로 stale 응답을 자동 무효화.

**[INFO]** `models` state와 `useMutation` 내부 데이터 이중 관리 — 동일 렌더 사이클 내 일시적 불일치 가능
- 위치: `model-combobox.tsx:27-31` — `useState<ModelInfo[]>`, `useState<string | null>`
- 상세: mutation 완료 시 `useMutation`이 `isPending → isSuccess`로 전환되며 렌더 1회 발생, 이후 `setModels(fetched)` + `setErrorMessage(null)`이 추가 렌더를 유발한다. React 단일 스레드 특성상 실질적 데이터 오염은 없으나 두 개의 진실 소스(source of truth)가 존재한다. `loadMutation.data`를 직접 파생하면 단일 렌더로 수렴할 수 있다.
- 제안: `loadMutation.data`와 `loadMutation.isError`를 직접 참조하고 local state 제거. `chatModels`는 `useMemo(() => (loadMutation.data ?? []).filter(m => m.type === 'chat'), [loadMutation.data])`로 처리.

**[INFO]** `PreviewLlmModelsDto`, `llm-config.controller.spec.ts`, `llm-configs.test.ts` — 동시성 해당 없음
- 순수 DTO 선언, 테스트 코드, 리뷰 문서이므로 런타임 동시성과 관련 없음.

---

### 요약

리뷰 대상 파일 중 동시성 관련 코드는 `model-combobox.tsx`에만 존재한다. 나머지(DTO, 테스트, 리뷰 문서)는 동시성과 무관하다. `model-combobox.tsx`는 `loadMutation.isPending` 가드로 동시 중복 발사를 차단해 경쟁 조건의 주요 경로를 막고 있으며, `onMutate`에서 이전 에러를 초기화하는 패턴도 올바르다. 이론적 위험은 두 가지다: props 변경과 응답 도착 타이밍이 겹치는 stale response 시나리오(치명적 데이터 손상 없음, UX 수준)와 local state와 mutation 데이터의 이중 관리로 인한 이중 렌더(성능 영향 미미). 두 항목 모두 이전 리뷰에서 I-3, I-4로 식별되어 복잡도 대비 이득이 낮다고 보류된 내용과 일치한다.

### 위험도

**LOW**