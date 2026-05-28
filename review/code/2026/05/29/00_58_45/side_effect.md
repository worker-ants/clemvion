# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] `useBaseModelLoader` 내 렌더 단계 setState — 의도된 React 패턴이지만 주의 필요
- 위치: `/codebase/frontend/src/components/llm-config/use-base-model-loader.ts` 라인 172–177
- 상세: `prevResetKey !== resetKey` 조건 블록에서 렌더 단계에 `setModels([])`, `setErrorMessage(null)`, `setHasAttemptedLoad(false)` 를 3회 호출한다. React 공식 권장 "reset state on prop change" 패턴이며 의도적이지만, 각 `setState` 는 독립 배치가 아니라 동일 렌더 사이클 내 처리된다. React 18 의 automatic batching 으로 3번의 re-render 는 발생하지 않으므로 실제 문제는 없다. 다만 `useModelLoader` 와 `useEmbeddingModelLoader` 두 caller 모두 동일 추상으로 위임했으므로 이 패턴이 공유 경로로 집중되어 있음을 인지해야 한다.
- 제안: 현 구현 그대로 유지해도 무방하나, 추후 state 항목 추가 시 이 블록에 함께 추가하는 것을 잊지 않도록 JSDoc 주석에 체크리스트를 남기는 것을 고려.

### [INFO] `useEmbeddingModelLoader.fetchModels` 클로저 — configId 캡처 시점 이중성
- 위치: `/codebase/frontend/src/components/llm-config/use-embedding-model-loader.ts` 라인 483–488
- 상세: `fetchModels` 는 렌더마다 재생성되는 클로저로 `configId` 를 직접 참조한다. `captureSnapshot: () => configId` 역시 동일 참조를 캡처한다. `useMutation.mutationFn` 은 호출 시점의 최신 클로저를 사용하므로 snapshot 과 실제 호출에 쓰이는 `configId` 가 동일 렌더 사이클 값임이 보장된다. 부작용 없음.
- 제안: 해당 없음.

### [INFO] `useDefaultLlmConfigId` — 새로운 `LLM_CONFIGS_QUERY_KEY` 상수 도입에 따른 캐시 공유 효과
- 위치: `/codebase/frontend/src/components/llm-config/use-default-llm-config-id.ts` 라인 3347
- 상세: `LLM_CONFIGS_QUERY_KEY` 가 `llm-configs` API 모듈에서 내보내지고 이 hook 이 그것을 사용한다. 기존에 `workflow-canvas.tsx` 가 동일 쿼리 키 `["llm-configs"]` 를 직접 문자열 배열로 사용하고 있었다면 캐시를 공유하는지 확인이 필요하다. 프롬프트에 포함된 변경사항 범위 내에서는 `workflow-canvas.tsx` 에서 `llmConfigs` 쿼리를 어떻게 구독하는지 코드가 노출되지 않았으나, `use-default-llm-config-id.ts` 의 docstring 에서 "Shares the `LLM_CONFIGS_QUERY_KEY` cache with the canvas pre-fill and selector dropdown" 이라고 명시하고 있어 의도된 설계임을 확인.
- 제안: 의도된 캐시 공유이므로 부작용 없음. 다만 `workflow-canvas.tsx` 가 `LLM_CONFIGS_QUERY_KEY` 를 import 하여 사용하는지 확인하여 문자열 리터럴 `["llm-configs"]` 가 코드베이스 어딘가에 남아있지 않은지 점검 권장.

### [INFO] `HasDefaultLlmConfigProvider` — Provider 없이 렌더되는 `CustomNode` 의 기본값 동작 변경
- 위치: `/codebase/frontend/src/components/editor/canvas/has-default-llm-config-context.ts` 라인 520, `/codebase/frontend/src/components/editor/canvas/custom-node.tsx` 라인 200
- 상세: 이전에는 `CustomNode` 가 `useQuery(["llm-configs"])` 를 직접 호출하여 실제 API 데이터를 사용했다. 이제는 Context 에서 `false` (기본값) 를 읽는다. Provider 외부에서 렌더되는 `CustomNode` — 예: Storybook, 고립 테스트, 또는 미래의 다른 캔버스 컨텍스트 — 는 항상 "no default config" 상태로 렌더된다. 이는 의도된 graceful degradation 이며 docstring 에 명시되어 있다.
- 제안: `WorkflowCanvas` 외부에서 `CustomNode` 를 렌더하는 사례가 있다면 해당 caller 에 `HasDefaultLlmConfigProvider` 를 wrapping 해야 함을 주의.

### [INFO] `sanitizeLoaderError` — 시그니처에 선택적 파라미터 추가 (하위 호환)
- 위치: `/codebase/frontend/src/components/llm-config/sanitize-loader-error.ts` 라인 3026
- 상세: `messagesByCode?: Record<string, string>` 파라미터가 추가되었다. 선택적 파라미터이므로 기존 호출자는 수정 없이 동작한다. 기존 동작(서버 메시지 일부 노출 → fallback 반환)이 완전히 교체되었으며, 기존에 서버 메시지를 그대로 의존하던 코드가 있다면 이제 `fallback` 만 받게 된다.
- 제안: 이 함수를 `use-model-loader.ts` / `use-embedding-model-loader.ts` 외에 직접 호출하는 다른 코드가 있는지 확인 권장. 프롬프트 범위 내에서는 두 loader 외 다른 호출자 없음.

### [INFO] `embedding-model-combobox.tsx` — inline `useQuery` 제거 후 `useDefaultLlmConfigId` 위임
- 위치: `/codebase/frontend/src/components/knowledge-base/embedding-model-combobox.tsx` 라인 1092
- 상세: 기존에는 컴포넌트가 `staleTime: 30_000` 로 직접 쿼리를 구독했다. `useDefaultLlmConfigId` 로 이동 후에도 동일 `staleTime: 30_000` 이 유지되어 동작 변화 없음. 쿼리 키가 동일하므로 캐시도 공유된다.
- 제안: 해당 없음.

### [WARNING] `useBaseModelLoader` — `useMutation` 객체가 `resetKey` 변경 시 재생성되지 않음
- 위치: `/codebase/frontend/src/components/llm-config/use-base-model-loader.ts` 라인 3179–3201
- 상세: `resetKey` 변경 시 `models`, `errorMessage`, `hasAttemptedLoad` 는 렌더 단계에서 즉시 초기화되지만 `useMutation` 인스턴스 자체(`loadMutation`)는 재생성되지 않는다. `loadMutation.isPending` 이 `true` 인 상태에서 `resetKey` 가 변경되면 in-flight 요청이 여전히 실행 중이며, `onSuccess` / `onError` 콜백은 응답 도착 시 실행된다. `onSuccess` 에서 `isSnapshotCurrent` 검사로 stale 응답을 폐기하므로 `setModels` 는 호출되지 않는다. 그러나 `onError` 에서는 snapshot 검사가 없으므로, `resetKey` 변경 이전 요청이 실패하면 **새 scope 의 `errorMessage` 에 이전 scope 의 에러가 표시될 수 있다**.
- 제안: `onError` 에도 stale closure 가드를 추가하거나, `mutationFn` 에서 error throw 전에 snapshot 을 캡처하여 `onError` 에서 비교하는 방식을 고려. 예:
  ```ts
  onError: (err, _, context) => {
    if (!isSnapshotCurrent(context?.snapshot)) return;
    setErrorMessage(...);
  }
  ```
  단, `onMutate` 에서 context 로 snapshot 을 반환해야 하며 `useMutation` 의 context 타입 파라미터 조정이 필요하다.

## 요약

이번 변경은 `CustomNode` 의 per-node LLM config 쿼리를 Context 기반 단일 공유 플래그로 교체하고, 두 model loader hook 의 공통 상태 머신을 `useBaseModelLoader` 로 추출하며, 에러 메시지를 서버 원문 노출에서 error code 기반 i18n 매핑으로 전환하는 내용이다. 전역 변수 도입, 파일시스템 부작용, 환경 변수 읽기/쓰기, 의도치 않은 네트워크 호출은 없다. 공개 인터페이스(`UseEmbeddingModelLoaderArgs`, `UseModelLoaderArgs`, `sanitizeLoaderError`) 에 선택적 파라미터가 추가되어 하위 호환성이 유지된다. 주목할 부작용은 `resetKey` 변경 직후 in-flight 요청이 실패하면 이전 scope 의 에러 메시지가 새 scope 에 표시될 수 있는 `onError` stale 가드 누락(WARNING)으로, 실제 UX 영향은 제한적이나 수정이 권장된다.

## 위험도

LOW
