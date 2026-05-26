# 성능(Performance) 리뷰 결과

## 발견사항

### [INFO] `llmConfigsApi.list()` 가 `getAll()` 을 내부 호출하는 이중 호출 구조
- 위치: `codebase/frontend/src/lib/api/llm-configs.ts` — `list()` 구현
- 상세: `list()`는 `getAll()`을 먼저 호출하고, 그 결과로 envelope 정규화를 한다. 즉 하나의 API 호출이 `getAll() → list()` 두 함수를 거친다. 현재는 별도 네트워크 요청이 추가되지 않고 래퍼 호출만 발생하므로 오버헤드는 미미하다. 그러나 `getAll()`이 이미 axios intercept 를 통해 `{ data }` 를 unwrap한 결과를 반환한다면, `list()` 에서의 envelope 재판별 로직은 불필요한 분기 실행이다.
- 제안: 장기적으로 `list()`가 `getAll()`을 통하지 않고 직접 `apiClient.get("/llm-configs")`를 호출하여 envelope를 한 번만 처리하도록 단순화하는 것이 바람직하다. 현재 규모에서는 무시 가능한 수준이다.

---

### [INFO] `CustomNode` 컴포넌트에서 캔버스의 모든 AI 노드가 각각 독립된 `useQuery` 를 호출하지만 캐시 공유로 실제 네트워크 비용은 없음 — 그러나 캐시 미스 타이밍에 다수 노드가 동시에 호출 가능
- 위치: `codebase/frontend/src/components/editor/canvas/custom-node.tsx` — `useQuery({ queryKey: ["llm-configs"], enabled: isAiNode })`
- 상세: 캔버스에 AI 노드가 N개 있을 때 각 `CustomNode` 인스턴스가 같은 `queryKey`로 `useQuery`를 호출한다. React Query의 캐시 공유 메커니즘으로 실제 네트워크 요청은 1회만 발생하나, 초기 마운트 시 모든 N개 인스턴스가 query 구독자로 등록된다. 이는 쿼리 상태 변경 시 N개 컴포넌트가 일제히 리렌더링될 수 있음을 의미한다. `staleTime: 30_000` 설정이 있어 실제 리렌더 빈도는 낮으나, 캔버스에 수십 개 AI 노드가 있을 경우 부담이 생길 수 있다.
- 제안: `LLM_CONFIGS_QUERY_KEY`로 조회한 결과를 상위 컴포넌트(`WorkflowCanvas`)에서 한 번 조회하고, `CustomNode`에는 `hasDefaultLlmConfig` boolean만 prop으로 내려주는 방식이 구독자 수를 1개로 줄여 리렌더 영향 범위를 최소화한다. 다만 이는 컴포넌트 인터페이스 변경을 수반하므로 팀의 아키텍처 결정에 맡긴다.

---

### [INFO] `ModelSelectField` 내 `savedValueMissingFromLoaded` 계산이 매 렌더마다 `models.some()` 을 실행
- 위치: `codebase/frontend/src/components/llm-config/model-select-field.tsx` — L26
- 상세: `savedValueMissingFromLoaded = value !== "" && !models.some((m) => m.id === value)` 가 `useMemo` 없이 렌더 함수 본체에서 계산된다. `models` 배열이 크지 않을 때(통상 수십 개 이하)는 문제없으나, 일관성 차원에서 아래 `isEmpty`와 동일하게 파생 계산으로 처리하는 것이 바람직하다. `isEmpty`도 같은 방식으로 처리되어 있다.
- 제안: 성능 영향은 미미하므로 현재는 INFO 수준. 모델 목록이 수백 개로 커질 가능성이 있다면 `useMemo` 로 감싸는 것을 고려한다.

---

### [INFO] `use-embedding-model-loader.ts` 와 `use-model-loader.ts` 모두 render-phase state 업데이트(`setPrevResetKey`, `setModels`, `setErrorMessage`, `setHasAttemptedLoad`)를 4회 연속 호출
- 위치: `codebase/frontend/src/components/llm-config/use-embedding-model-loader.ts` L31-35 및 `use-model-loader.ts` L78-81
- 상세: `prevResetKey !== resetKey` 분기에서 `setPrevResetKey`, `setModels`, `setErrorMessage`, `setHasAttemptedLoad`를 개별 호출한다. React 18의 자동 배칭(automatic batching)은 이벤트 핸들러 및 `startTransition` 내에서는 적용되지만, render 단계의 직접 상태 업데이트에서는 여러 번의 re-render를 유발할 수 있다.
- 제안: 이 4개의 상태를 하나의 객체(`{ models, errorMessage, hasAttemptedLoad }`)로 통합해 `useState` 를 1개로 줄이면 render-phase reset 시 리렌더가 1회로 줄어든다. 단, React 문서에서 권장하는 "render 단계 state 업데이트" 패턴 자체는 이미 올바른 접근이다.

---

### [INFO] `EmbeddingModelCombobox` 에서 `configs.find((c) => c.isDefault)?.id ?? configs[0]?.id` 가 `useMemo` 없이 직접 계산
- 위치: `codebase/frontend/src/components/knowledge-base/embedding-model-combobox.tsx` — `defaultConfigId` 계산
- 상세: `configs` 배열 순회가 매 렌더마다 발생한다. `useQuery`의 `staleTime` 설정으로 `configs`가 자주 바뀌지 않으나, `useMemo` 없이 작성되어 있어 명시적 최적화가 없다. 동일 컴포넌트 트리 내 `EmbeddingModelCombobox`가 다수 존재하는 경우(예: 임베딩 설정 패널이 여러 탭에 있다면) 순회 비용이 중복된다.
- 제안: 아래 `defaultConfigId` 파생 계산을 `useMemo([configs])`로 감싼다. 현재 코드는 `useMemo` 없이 작성되어 있다 — `LlmConfigSelector`와 `WorkflowCanvas`는 이미 `useMemo`를 사용 중이므로 일관성 면에서도 맞추는 것이 좋다.

---

### [INFO] `WorkflowCanvas`의 `glowNodes` useMemo 가 호버 상태 변경마다 전체 노드 배열을 순회하며 새 객체를 생성
- 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` — `glowNodes` useMemo
- 상세: `nodes.map(...)` 으로 전체 노드를 순회하며 조건에 따라 `{ ...node, className: ... }` 스프레드를 사용한다. 마우스 호버 이벤트마다 `hoveredEdgeNodes`가 변경되면 이 계산이 재실행된다. 노드가 수백 개인 대형 캔버스에서는 호버 퍼포먼스 영향이 있을 수 있다. 다만 이 코드는 이번 변경 범위 밖이므로 참고 수준으로 기록한다.
- 제안: 이번 변경과 무관하므로 별도 이슈로 트래킹 권장.

---

## 요약

이번 변경의 핵심은 `llmConfigsApi.getAll()` 호출 후 컴포넌트마다 제각각이던 envelope 정규화 로직을 `llmConfigsApi.list()` 단일 지점으로 통합하고, 공통 JSX 패턴을 `ModelSelectField`로 추출하며, 에러 sanitization 을 `sanitizeLoaderError` 로 분리한 리팩터링이다. 성능 관점에서 이번 변경은 전반적으로 긍정적이다: 컴포넌트마다 중복 존재하던 IIFE 정규화 계산이 제거되었고, React Query `staleTime: 30_000` 으로 캐시 공유가 명확히 유지된다. 주목할 만한 문제는 `llmConfigsApi.list()`가 `getAll()`을 한 번 더 호출하는 이중 래핑 구조로 envelope 분기를 두 단계에 걸쳐 처리한다는 점이나, 추가 네트워크 비용은 없으므로 현재 규모에서는 무시 가능하다. `CustomNode`에서 AI 노드 수만큼 같은 쿼리를 구독하는 구조는 캔버스가 매우 커질 경우 잠재적 리렌더 압력이 될 수 있어 INFO로 기록한다. 전반적으로 성능을 저하시키는 변경은 없으며, 오히려 중복 계산이 줄어 소폭 개선 효과가 있다.

## 위험도

LOW
