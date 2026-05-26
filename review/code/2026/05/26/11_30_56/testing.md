# 테스트(Testing) 리뷰

대상 변경: LLM 설정 / 임베딩 모델 선택 — select-only 전환 (Input+datalist → NativeSelect)

---

## 발견사항

### [WARNING] ModelCombobox: 재시도(retry) 시 에러 초기화 동작 테스트 누락
- 위치: `codebase/frontend/src/components/llm-config/__tests__/model-combobox.test.tsx`
- 상세: 기존 테스트 중 "clears the error message when a retry starts (onMutate)" 케이스가 삭제됐다. 해당 동작(재시도 클릭 → 이전 에러 메시지 즉시 사라짐)은 `useModelLoader`의 `onMutate: () => setErrorMessage(null)` 로직에 의존하며, `use-model-loader.test.tsx` 에도 직접적인 "onMutate 에러 클리어" 테스트가 없다. `model-combobox.test.tsx` 에서 삭제된 케이스는 통합 수준의 UX 검증이었으므로, 단위 훅 레벨에서도 커버되지 않는 갭이 생겼다.
- 제안: `use-model-loader.test.tsx` 에 "실패 후 재로드 시 errorMessage 가 null 로 초기화된다" 케이스를 추가하거나, `model-combobox.test.tsx` 의 "shows error → click retry → error disappears" 시나리오를 복원한다.

---

### [WARNING] ModelCombobox: 인플라이트 요청 중 select 비활성(isPending) 테스트 누락
- 위치: `codebase/frontend/src/components/llm-config/__tests__/model-combobox.test.tsx`
- 상세: 기존 "disables the load button while the request is pending" 케이스가 삭제됐다. 새 구현에서 `selectDisabled = disabled || !hasLoadedModels` 이고 버튼도 `isPending` 시 비활성이지만, 실제 pending 상태에서 버튼 비활성을 검증하는 테스트가 컴포넌트 레벨에 없다. `use-model-loader.test.tsx` 에는 `isPending` 상태를 직접 검증하는 케이스도 없다.
- 제안: 느린 프로미스(never-resolve)를 mock 으로 주입해 `isPending = true` 상태에서 버튼이 disabled 임을 확인하는 케이스를 추가한다. 기존 삭제된 케이스 패턴을 재활용할 수 있다.

---

### [WARNING] ModelCombobox: 이전에 로드된 모델 목록이 재시도 실패 후에도 유지되는지 테스트 누락
- 위치: `codebase/frontend/src/components/llm-config/__tests__/model-combobox.test.tsx`
- 상세: 기존 "keeps previously loaded models visible when a retry fails" 케이스가 삭제됐다. `useModelLoader.onError` 에는 `setModels()` 호출이 없어 이전 목록이 의도적으로 보존되지만, 이 동작을 검증하는 테스트가 컴포넌트 수준에서 사라졌다. `use-model-loader.test.tsx` 에도 실패 후 기존 모델 유지를 검증하는 케이스가 없다.
- 제안: `use-model-loader.test.tsx` 에 "첫 로드 성공 → 두 번째 로드 실패 → 기존 모델 목록 유지" 케이스를 추가한다.

---

### [WARNING] ModelCombobox: stale closure(인플라이트 중 provider 변경) 가드 테스트 누락
- 위치: `codebase/frontend/src/components/llm-config/__tests__/model-combobox.test.tsx`
- 상세: 기존 "ignores a stale response when provider changes mid-flight" 케이스가 삭제됐다. `useModelLoader.onSuccess` 에서 `snapshot.provider !== provider` 를 검사하는 스테일 클로저 가드는 현재 `use-model-loader.test.tsx` 에서도 검증되지 않는다. 이 가드가 없으면 경쟁 조건(race condition)으로 잘못된 provider 의 모델이 노출될 수 있다.
- 제안: `use-model-loader.test.tsx` 에 "요청 인플라이트 중 provider 변경 → 이전 응답 도착 → 모델 목록에 반영되지 않음" 케이스를 추가한다.

---

### [WARNING] EmbeddingModelCombobox: `missing-config-id` 에러 경로(effectiveConfigId 없음) 테스트 누락
- 위치: `codebase/frontend/src/components/knowledge-base/__tests__/embedding-model-combobox.test.tsx`
- 상세: `loadMutation.mutationFn` 내부에 `if (!effectiveConfigId) throw new Error("missing-config-id")` 분기가 존재하지만, 이 경로를 유발하는 케이스(getAll 결과가 빈 배열 → defaultConfigId 가 undefined, llmConfigId 도 미지정 상태에서 버튼 클릭)가 테스트에 없다. `canLoad = Boolean(effectiveConfigId)` 이므로 정상 흐름에서는 버튼 자체가 비활성이지만, `canLoad` 조건 우회나 타이밍 이슈로 호출될 가능성이 있다.
- 제안: `getAll` 이 빈 배열을 반환할 때 버튼이 disabled 상태임을 검증하는 케이스를 추가한다(`canLoad = false` 분기 커버).

---

### [WARNING] EmbeddingModelCombobox: `getAll` API 실패 시 UI 상태 테스트 누락
- 위치: `codebase/frontend/src/components/knowledge-base/__tests__/embedding-model-combobox.test.tsx`
- 상세: `useQuery` 로 `getAll` 을 호출하는데, 이 쿼리가 실패할 경우(configsRes 가 undefined 유지, configs 가 빈 배열, defaultConfigId 가 undefined) 로드 버튼이 비활성 상태로 유지되어야 한다. 이 케이스를 검증하는 테스트가 없다.
- 제안: `llmConfigsApi.getAll` 이 rejected 될 때 버튼이 disabled 임을 확인하는 케이스를 추가한다.

---

### [WARNING] EmbeddingModelCombobox: `isEmpty` 상태(로드 성공 + 빈 목록) UI 메시지 테스트 누락
- 위치: `codebase/frontend/src/components/knowledge-base/__tests__/embedding-model-combobox.test.tsx`
- 상세: `isEmpty = !errorMessage && loadMutation.isSuccess && embeddingModels.length === 0` 조건에서 "모델이 없어요" 메시지를 표시하는 분기가 테스트되지 않는다. `model-combobox.test.tsx` 에는 "shows the empty-list hint after a successful empty response" 케이스가 있지만, embedding combobox 테스트에는 동등한 케이스가 없다.
- 제안: `listModels` 가 빈 배열을 반환할 때 `noModelsFound` 메시지가 표시되는 케이스를 추가한다.

---

### [WARNING] EmbeddingModelCombobox: `prevResetKey` 초기화 로직의 타이밍 의존성
- 위치: `codebase/frontend/src/components/knowledge-base/embedding-model-combobox.tsx`, 라인 358-370
- 상세: render 중 `setPrevResetKey` / `setModels` / `setErrorMessage` 를 호출하는 "reset on prop change" 패턴은 React 권장 패턴이지만, 초기 렌더링 시 `effectiveConfigId` 가 아직 undefined(getAll 미완료)이면 `prevResetKey` 가 `""` 로 초기화된다. 이후 `getAll` 완료로 `effectiveConfigId` 가 `"default-cfg"` 가 되면 `resetKey` 가 변경되어 의도치 않은 reset 이 발생하지 않는지 검증하는 테스트가 없다. 현재 "clears loaded models and resets select when llmConfigId changes" 테스트는 이 초기화 시나리오를 커버하지 않는다.
- 제안: `getAll` 로딩 완료 후 `effectiveConfigId` 가 처음 설정되는 시점에 이미 로드된 모델 목록이 초기화되지 않는지 확인하는 케이스를 추가한다.

---

### [INFO] ModelCombobox: `trims apiKey and baseUrl` 동작 테스트 삭제
- 위치: `codebase/frontend/src/components/llm-config/__tests__/model-combobox.test.tsx`
- 상세: 기존 "trims apiKey and baseUrl before calling preview endpoint" 케이스가 삭제됐다. 트리밍 로직은 `useModelLoader` 내부(`apiKey.trim()`, `baseUrl?.trim()`)에 있으므로, 이 동작은 `use-model-loader.test.tsx` 에서 검증되어야 하지만 현재 해당 케이스가 없다.
- 제안: `use-model-loader.test.tsx` 에 공백이 포함된 apiKey/baseUrl 이 trim 되어 API 에 전달됨을 검증하는 케이스를 추가한다. 단, 이는 중간 심각도의 회귀 위험이므로 WARNING 에서 INFO 로 분류한다.

---

### [INFO] EmbeddingModelCombobox: `llmConfigsApi.listModels` mock 에 non-embedding 타입 포함한 필터링 테스트 없음
- 위치: `codebase/frontend/src/components/knowledge-base/__tests__/embedding-model-combobox.test.tsx`
- 상세: 구현 내 `embeddingModels = models.filter((m) => m.type === "embedding")` 로직이 있지만, `type: "chat"` 모델을 포함한 응답에서 chat 모델이 select 에 나타나지 않는지 검증하는 테스트가 없다. `model-combobox.test.tsx` 에는 "chat 모델만 option, embedding 모델 제외" 케이스가 있어 비대칭이다.
- 제안: `listModels` 반환값에 `type: "chat"` 모델을 포함시키고, select option 에서 제외되는지 확인하는 케이스를 추가한다.

---

### [INFO] 테스트 격리: `wrap()` 함수가 매 케이스마다 새 QueryClient 생성
- 위치: `embedding-model-combobox.test.tsx`, 라인 47-52 / `model-combobox.test.tsx` 동일 패턴
- 상세: `wrap()` 내부에서 `new QueryClient()` 를 생성해 QueryCache 가 테스트 간 공유되지 않는다. 테스트 격리는 적절하다. 단, `rerender` 케이스에서는 `wrap()` 반환값의 `rerender` 에 새 `QueryClientProvider` 를 직접 조립하는데(`new QueryClient(...)` 재생성), 이 패턴이 일관되게 적용되어 있다.
- 제안: 현행 유지. 특이사항 없음.

---

### [INFO] Mock 적절성: `vi.mock("@/lib/api/llm-configs")` 모듈 수준 mock 사용
- 위치: 두 테스트 파일 모두
- 상세: `llmConfigsApi.getAll` / `listModels` / `previewModels` 를 `vi.fn()` 으로 대체하고 `beforeEach` 에서 `vi.clearAllMocks()` 를 호출한다. 실제 axios 호출을 차단하고 있어 네트워크 의존성 없음. `axios.isAxiosError` 를 직접 활용하는 에러 파싱 로직은 `Object.assign(new Error(), { isAxiosError: true, response: ... })` 패턴으로 시뮬레이션하고 있어 적절하다.
- 제안: 현행 유지.

---

## 요약

이번 변경은 Input+datalist 자유 입력 방식에서 NativeSelect select-only 방식으로의 전환이며, 새로운 동작에 맞는 테스트가 대부분 신규 작성 또는 업데이트됐다. `EmbeddingModelCombobox` 에 대한 신규 테스트 파일(7개 케이스)은 핵심 시나리오(로드 전 disabled, 명시 config/default config fallback, onChange, 저장값 보존, 에러, config 변경 시 리셋)를 잘 커버한다. `ModelCombobox` 테스트도 select-only 패턴에 맞게 재작성됐다. 그러나 이전 구현에서 커버하던 중요 경계 시나리오 4개(재시도 에러 클리어, 인플라이트 버튼 비활성, 재시도 실패 후 기존 모델 유지, stale closure 가드)가 컴포넌트 테스트에서 삭제되면서 `use-model-loader.test.tsx` 에도 동등한 커버리지가 추가되지 않았다. 이 갭들은 `useModelLoader` 훅의 복잡한 비동기 상태 관리(onMutate, onError 모델 보존, 스테일 클로저)를 검증하지 못하는 문제로, 향후 회귀 발생 시 진단이 어려워질 수 있다. 또한 `EmbeddingModelCombobox` 는 `useModelLoader` 를 쓰지 않고 별도 `useMutation` 을 구현하므로 훅 단위 테스트가 없어 직접 컴포넌트 테스트에서 더 많은 경계 케이스를 커버해야 한다.

## 위험도

MEDIUM
