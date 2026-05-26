# Testing Review — LLM Model Select-Only 전환

## 발견사항

### [WARNING] `sanitize-loader-error.ts` 에 대한 단위 테스트 없음
- 위치: `codebase/frontend/src/components/llm-config/sanitize-loader-error.ts` (신규 파일)
- 상세: `sanitizeLoaderError`는 에러 메시지 sanitize 로직(200자 상한, 배열 join, Axios 판별)을 캡슐화한 순수 함수로 독립 테스트가 용이하다. 그러나 전용 테스트 파일이 존재하지 않는다. 현재는 `use-model-loader.test.tsx`와 `model-combobox.test.tsx`의 에러 케이스를 통해 간접적으로만 검증된다.
- 제안: `codebase/frontend/src/components/llm-config/__tests__/sanitize-loader-error.test.ts` 추가. 테스트 케이스:
  - Axios 에러 + 문자열 `message` → 원본 반환
  - Axios 에러 + 배열 `message` → 쉼표 join 반환
  - Axios 에러 + 201자 이상 `message` → 200자 슬라이스 반환
  - Axios 에러 + `message` 없음 → fallback 반환
  - non-Axios 에러 → fallback 반환

### [WARNING] `use-embedding-model-loader.ts` 에 대한 독립 단위 테스트 없음
- 위치: `codebase/frontend/src/components/llm-config/use-embedding-model-loader.ts` (신규 파일)
- 상세: `useModelLoader`에는 `use-model-loader.test.tsx`(13개 케이스)가 있으나, 동일 패턴으로 추출된 `useEmbeddingModelLoader`에는 전용 훅 테스트가 없다. `embedding-model-combobox.test.tsx`가 컴포넌트 수준에서 간접 커버하지만, 다음 시나리오가 누락된다:
  - 재시도 시 `errorMessage`가 null로 초기화되는지 (`onMutate` 에러 클리어)
  - 첫 로드 성공 후 두 번째 로드 실패 시 기존 모델 목록 유지
  - stale closure 가드(`snapshot !== configId`)가 실제 응답을 버리는지
  - `configId` 미정의 시 `canLoad=false` 및 `mutationFn` 방어 throw
- 제안: `codebase/frontend/src/components/llm-config/__tests__/use-embedding-model-loader.test.ts` 추가. `use-model-loader.test.tsx`의 구조를 참조해 대칭 케이스 작성.

### [WARNING] `model-select-field.tsx` 에 대한 독립 단위 테스트 없음
- 위치: `codebase/frontend/src/components/llm-config/model-select-field.tsx` (신규 파일)
- 상세: `ModelSelectField`는 `ModelCombobox`와 `EmbeddingModelCombobox` 양쪽에서 공유하는 UI 컴포넌트로, 4-way 힌트 메시지(error / empty / not-yet-loaded / loaded), `savedValueMissingFromLoaded` 처리, `renderOption` 커스터마이즈, `disabled` 전파, `testIdPrefix` 동적 testId 등 독립 테스트 가치가 높다. 현재 각 상위 컴포넌트 테스트에서 간접 커버되지만 `renderOption` 경로는 어디에서도 검증되지 않는다.
- 제안: `codebase/frontend/src/components/llm-config/__tests__/model-select-field.test.tsx` 추가. 핵심 케이스:
  - `renderOption` 미지정 시 `name (id)` 포맷 표시
  - `renderOption` 주입 시 커스텀 렌더링
  - `hasAttemptedLoad=true && models=[] && !errorMessage` → isEmpty 메시지 표시
  - `disabled=true` → select + load 버튼 모두 비활성

### [INFO] `llmConfigsApi.list()` 테스트에서 `getAll()` 내부 호출이 스파이되지 않음
- 위치: `codebase/frontend/src/lib/api/__tests__/llm-configs.test.ts` (파일 15)
- 상세: `list()` 구현은 내부적으로 `llmConfigsApi.getAll()`을 호출하며, `getAll()`은 `apiClient.get("/llm-configs")`를 경유한다. 테스트는 `apiClient.get`을 mock하여 정상 동작하지만, `list()` → `getAll()` → `apiClient.get` 의 3단 체인 때문에 `getAll()`이 호출됐는지에 대한 명시적 assertion이 없다. 현 구현상 문제는 없으나 `getAll()`의 내부 시그니처가 변경될 경우 `list()` 테스트가 이를 감지하지 못할 수 있다.
- 제안: `expect(apiClient.get).toHaveBeenCalledWith("/llm-configs", ...)` assertion을 `list()` describe 블록에 추가해 경로를 명시적으로 검증.

### [INFO] `embedding-model-combobox.test.tsx` mock에서 `as never` 타입 단언 사용
- 위치: `codebase/frontend/src/components/knowledge-base/__tests__/embedding-model-combobox.test.tsx:42`
- 상세: `vi.mocked(llmConfigsApi.list).mockResolvedValue([DEFAULT_CONFIG] as never)`. `DEFAULT_CONFIG`가 `LlmConfigData` 필드 중 `id`와 `isDefault`만 포함해 타입이 불완전하므로 `as never`로 강제 캐스팅. 테스트가 실행은 되나 타입 시스템의 도움을 받지 못한다.
- 제안: `DEFAULT_CONFIG`를 `LlmConfigData` 타입에 맞게 완성하거나 `Partial<LlmConfigData>`를 `as LlmConfigData[]`로 캐스팅.

### [INFO] `workflow-canvas.tsx` 및 `knowledge-base/[id]/page.tsx` 변경에 대한 컴포넌트 레벨 테스트 없음
- 위치: 파일 1(`knowledge-bases/[id]/page.tsx`), 파일 3(`workflow-canvas.tsx`)
- 상세: 두 파일 모두 `getAll()` → `list()` 로의 queryFn 교체와 응답 정규화 로직 제거가 핵심 변경이다. `llm-configs.test.ts`에서 `list()`의 정규화를 검증하지만, 이 컴포넌트들이 `list()`의 반환 배열을 올바르게 소비하는지(예: `defaultLlmConfigId` 계산, `llmConfigs` 배열 전달)를 직접 검증하는 컴포넌트 테스트가 없다. `workflow-canvas.tsx`는 ReactFlow 의존성으로 테스트 어렵지만 `create-kb-form-dialog.tsx`는 상대적으로 단순하다.
- 제안: 최소한 `CreateKbFormDialog`에 대해 `llmConfigsApi.list`를 mock하고 llmConfigs 드롭다운이 올바르게 렌더링되는지 검증하는 smoke 테스트 추가.

### [INFO] `use-model-loader.test.tsx` 의 API 타입 변경(`isSuccess` → `hasAttemptedLoad`) 외 불필요한 변경 없음
- 위치: `codebase/frontend/src/components/llm-config/__tests__/use-model-loader.test.tsx` (파일 8)
- 상세: `isSuccess → hasAttemptedLoad` assertion 변경은 의도대로 정확히 적용됐으며 기존 테스트 의도를 유지한다. 회귀 위험 없음.

## 요약

이번 변경은 `llmConfigsApi.getAll()` 호출과 수동 응답 정규화 코드를 `list()`로 일원화하고, 로더 로직을 `useEmbeddingModelLoader`와 `sanitizeLoaderError`로 추출하며, UI를 `ModelSelectField`로 공통화한 리팩토링이다. 테스트 측면에서는 기존 테스트들이 `getAll` → `list` mock 교체를 정확히 반영했고, `llm-configs.test.ts`에 `list()`의 응답 정규화 3-케이스(envelope / flat / null)가 추가되어 핵심 계약이 검증된다. 다만 신규 추출된 세 모듈(`sanitize-loader-error.ts`, `use-embedding-model-loader.ts`, `model-select-field.tsx`)에 대한 직접 단위 테스트가 없어 커버리지 갭이 존재한다. 특히 `useEmbeddingModelLoader`의 retry-clears-error, keeps-models-on-retry-fail, stale-closure-guard 케이스는 컴포넌트 테스트에서도 커버되지 않아 버그 재현 시 원인 추적이 어렵다. `renderOption` prop도 현재 테스트 범위 밖이다.

## 위험도

LOW
