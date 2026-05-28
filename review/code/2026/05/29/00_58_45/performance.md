# 성능(Performance) 리뷰

## 발견사항

### [INFO] N+1 쿼리 제거 — 핵심 개선 확인
- 위치: `codebase/frontend/src/components/editor/canvas/custom-node.tsx` (diff 70-207)
- 상세: 변경 전 `CustomNodeComponent` 마다 `useQuery(["llm-configs"])` 를 직접 구독했다. N개의 AI 노드가 캔버스에 있으면 react-query 가 동일 key 를 N개 구독자로 관리하고, 쿼리 상태 변경(fetching/stale/fresh 전이) 시 N개 컴포넌트가 모두 리렌더됐다. 변경 후 `WorkflowCanvas` 가 단일 boolean(`hasDefaultLlmConfig`)을 Context 로 공급하므로 context value 가 바뀔 때(true/false 전환 시에만) 소비자가 리렌더된다. staleTime=30s 주기 재요청 시 발생하던 N회 리렌더가 최악 1회로 줄었다.
- 제안: 현재 구현이 이미 최적 경로다. 추가 개선은 불필요.

### [INFO] `useMemo` 안에서 `buildLoaderErrorMessages(t)` 호출 — 적절함
- 위치:
  - `codebase/frontend/src/components/llm-config/model-combobox.tsx` (라인 74)
  - `codebase/frontend/src/components/knowledge-base/embedding-model-combobox.tsx` (라인 95)
- 상세: `buildLoaderErrorMessages(t)` 는 매 호출마다 `{ key: string }` 형태의 새 객체를 반환한다. `useMemo(() => buildLoaderErrorMessages(t), [t])` 로 감싸 `t` 함수 참조가 바뀌지 않는 한 객체를 재생성하지 않는다. `t` 는 locale 전환 시에만 교체되므로 실질적으로 마운트 1회만 실행된다.
- 제안: 현재 구현이 적절하다.

### [INFO] `useBaseModelLoader` 내 render-phase 상태 직접 변이 — 렌더 오버헤드 없음
- 위치: `codebase/frontend/src/components/llm-config/use-base-model-loader.ts` (라인 172-177)
- 상세: `if (prevResetKey !== resetKey)` 블록에서 `setModels([])`, `setErrorMessage(null)`, `setHasAttemptedLoad(false)` 를 동시에 호출한다. React 18 이상에서는 이벤트 핸들러 외부 setter 도 automatic batching 으로 단일 리렌더로 처리된다. 렌더 중 setter 호출이라도 React 는 해당 렌더를 즉시 버리고 새 state 로 단 1회 재렌더한다(React `getDerivedStateFromProps` 등가 패턴). 3개 setState 가 3번 렌더를 유발하지 않는다.
- 제안: 현재 구현이 React 권장 패턴을 올바르게 따른다.

### [INFO] `useDefaultLlmConfigId` — `LLM_CONFIGS_QUERY_KEY` 공유로 중복 요청 없음
- 위치: `codebase/frontend/src/components/llm-config/use-default-llm-config-id.ts`
- 상세: `LLM_CONFIGS_QUERY_KEY` 상수를 import해 react-query 캐시를 `WorkflowCanvas` 및 기타 구독자와 공유한다. 동일 queryKey 를 사용하는 한 네트워크 요청은 staleTime(30s) 내 1회만 발생한다.
- 제안: 현재 구현이 적절하다.

### [INFO] `sanitizeLoaderError` — O(1) 해시 룩업으로 개선
- 위치: `codebase/frontend/src/components/llm-config/sanitize-loader-error.ts`
- 상세: 변경 전 로직은 문자열 배열 join(`Array.isArray(raw) ? raw.join(", ") : raw`) + slice 를 수행했다. 변경 후 `code in messagesByCode` 단일 해시 조회로 대체됐다. 알고리즘 복잡도가 동일하게 O(1)이지만 불필요한 문자열 조작이 제거됐다.
- 제안: 현재 구현이 더 단순하고 빠르다.

### [INFO] `useHasDefaultLlmConfig` — context 구독 비용
- 위치: `codebase/frontend/src/components/editor/canvas/has-default-llm-config-context.ts`
- 상세: `createContext(false)` 기본값 설정으로 Provider 외부에서 호출해도 추가 연산 없이 `false` 를 반환한다. context value 가 boolean 원시값이므로 객체 동일성 비교가 아닌 값 비교로 리렌더 여부를 결정한다. 불필요한 리렌더 발생 가능성이 없다.
- 제안: 현재 구현이 적절하다.

### [INFO] `useMutation` 재사용 — `useBaseModelLoader` 추상화
- 위치: `codebase/frontend/src/components/llm-config/use-base-model-loader.ts`
- 상세: 기존 `useModelLoader` 와 `useEmbeddingModelLoader` 가 각각 `useMutation` + `useState` 3개를 독립적으로 보유했다. 추출된 `useBaseModelLoader` 가 이를 단일 구현으로 통합해 번들 크기와 런타임 hook 체인 수를 줄였다. 두 소비자 모두 내부 mutation 객체를 직접 노출하지 않아 소비자 컴포넌트의 리렌더 면적도 최소화됐다.
- 제안: 현재 구현이 적절하다.

## 요약

이번 변경의 핵심 성능 개선은 두 가지다. 첫째, `CustomNode` 마다 보유하던 `useQuery(["llm-configs"])` 구독을 `HasDefaultLlmConfigContext` 단일 boolean 공급으로 교체해 N개 AI 노드의 N회 리렌더를 최악 1회로 감소시켰다. 둘째, `useBaseModelLoader` 추상화로 중복 hook 체인을 제거했다. 나머지 변경(error code 매핑, i18n 추가)은 성능 중립적이며, 사용된 `useMemo` 래핑 및 render-phase reset 패턴은 React 18 권장 관용구를 올바르게 따른다. 지연 로딩 · 블로킹 I/O · N+1 · 메모리 누수 관점에서 새로운 문제점은 발견되지 않았다.

## 위험도

NONE
