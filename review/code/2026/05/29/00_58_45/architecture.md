# Architecture Review

## 발견사항

### [INFO] useBaseModelLoader — Template Method 패턴의 훅 변형으로 중복 제거
- 위치: `codebase/frontend/src/components/llm-config/use-base-model-loader.ts`
- 상세: `useModelLoader`와 `useEmbeddingModelLoader`가 공유하던 상태 기계(render-phase reset, stale-closure guard, error sanitization, `hasAttemptedLoad` tracking)를 `useBaseModelLoader`로 추출했다. 두 소비자는 `fetchModels`, `captureSnapshot`, `isSnapshotCurrent`, `canLoad`만 주입한다. 이는 GoF Template Method 패턴의 React hooks 변형으로, OCP(개방-폐쇄)와 DRY를 동시에 충족한다. 제네릭 `<TSnapshot>` 파라미터로 스냅샷 타입 안전성도 확보되어 있다.
- 제안: 현재 설계 유지. 추후 loader 종류가 추가될 경우(예: streaming-models loader) 동일 패턴 적용 가능.

### [INFO] HasDefaultLlmConfigContext — N×useQuery 구독 제거를 위한 Context 승격 패턴
- 위치: `codebase/frontend/src/components/editor/canvas/has-default-llm-config-context.ts`, `workflow-canvas.tsx`
- 상세: AI 노드 수만큼 발생하던 `useQuery(["llm-configs"])` 구독을 `WorkflowCanvas`의 단일 `boolean` context 값으로 대체한다. `createContext(false)` 기본값이 provider 없이 렌더된 컴포넌트(테스트 격리 등)에서 graceful degradation을 제공한다. SRP 관점에서 "canvas 레벨에서 workspace 상태를 중개하는 책임"이 `WorkflowCanvas`에 명확히 집중된다.
- 제안: 현재 구조 유지. 다만 향후 `hasDefaultLlmConfig` 이외의 workspace-level LLM 정보가 필요해질 경우(예: defaultLlmConfigId 자체가 필요한 경우), context 값 타입을 `boolean`에서 `{ hasDefault: boolean; defaultId: string | null }`로 확장하는 것이 타입 안전성 측면에서 유리하다.

### [INFO] useDefaultLlmConfigId — 쿼리 키 중앙화 및 캐시 공유
- 위치: `codebase/frontend/src/components/llm-config/use-default-llm-config-id.ts`
- 상세: `LLM_CONFIGS_QUERY_KEY` 상수를 `llmConfigsApi` 모듈에서 export해 hook이 import한다. 여러 컴포넌트가 동일 쿼리 키를 쓰므로 React Query 캐시가 공유되어 네트워크 요청이 중복되지 않는다. 이는 데이터 레이어 응집도를 높이는 올바른 패턴이다.
- 제안: 없음.

### [WARNING] sanitizeLoaderError — 선택적 파라미터 `messagesByCode`의 옵셔널 설계
- 위치: `codebase/frontend/src/components/llm-config/sanitize-loader-error.ts`, lines 8-10
- 상세: `messagesByCode?: Record<string, string>`가 옵셔널이므로 호출자가 이를 생략하면 항상 `fallback`을 반환한다. `useBaseModelLoader`도 `errorMessagesByCode`를 옵셔널로 받는다. 현재 `useModelLoader`와 `useEmbeddingModelLoader`는 컴포넌트에서 `buildLoaderErrorMessages(t)`를 통해 맵을 주입하지만, 직접 테스트 코드에서 loader hook을 `errorMessagesByCode` 없이 호출하는 사례가 있다(`use-embedding-model-loader.test.tsx`의 일부 케이스). 이 경우 코드 매핑이 무음으로 비활성화되어 의도가 불명확하다.
- 제안: `useBaseModelLoader`가 내부적으로 `errorMessagesByCode`가 없을 때를 더 명시적으로 문서화하거나, loader 수준에서는 필수 파라미터로 격상하고 `sanitizeLoaderError`만 옵셔널로 유지하는 방안을 검토할 것.

### [INFO] buildLoaderErrorMessages — 에러 코드-메시지 매핑의 단일 진실 모듈
- 위치: `codebase/frontend/src/components/llm-config/loader-error-messages.ts`
- 상세: 백엔드 에러 코드 목록(`LLM_CREDENTIALS_REQUIRED`, `LLM_CONFIG_INVALID`)과 i18n 키의 매핑을 한 곳에 집중시켰다. 새 에러 코드 추가 시 이 파일과 i18n dict 두 곳만 수정하면 된다. 함수형 factory(`buildLoaderErrorMessages(t)`)로 지연 평가와 테스트 격리가 쉽다.
- 제안: 현재 구조 유지.

### [INFO] 레이어 책임 분리 준수 확인
- 위치: 전체 변경
- 상세: 변경된 코드는 프레젠테이션(컴포넌트) → 비즈니스(custom hooks) → 데이터(llmConfigsApi) 레이어 분리를 일관되게 유지한다. `EmbeddingModelCombobox`, `ModelCombobox`는 렌더링만 담당하고 데이터 fetch 로직은 hook으로 위임된다. `sanitizeLoaderError`는 비즈니스 레이어의 순수 함수로 분리되어 있다.
- 제안: 없음.

### [INFO] 순환 의존성 없음
- 위치: `use-base-model-loader.ts` ← `use-model-loader.ts` / `use-embedding-model-loader.ts`
- 상세: 의존 방향이 단방향(base ← specific)이며 역방향 참조가 없다. `has-default-llm-config-context.ts`는 canvas 모듈 내부에 격리되어 있고 llm-config 모듈에 의존하지 않는다.
- 제안: 없음.

### [INFO] 테스트 격리 구조 개선
- 위치: `custom-node.test.tsx`
- 상세: 기존에는 `@tanstack/react-query` 전체를 mock했으나(`vi.mock("@tanstack/react-query")`), 이제 `HasDefaultLlmConfigProvider`를 테스트 wrapper로 직접 주입한다. 이로 인해 테스트가 react-query 내부에 덜 결합되고, `hasDefaultLlmConfig` 값을 테스트별로 독립적으로 제어할 수 있다. 아키텍처 측면에서 테스트 가능성(testability)이 향상된 올바른 방향이다.
- 제안: 없음.

### [WARNING] WorkflowCanvas의 `HasDefaultLlmConfigProvider` 중첩 깊이
- 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx`, lines 484-599
- 상세: diff를 보면 `<TooltipProvider>` 내부에 `<HasDefaultLlmConfigProvider>`가 중첩된다. 현재는 두 레벨이므로 문제없지만, 향후 canvas 레벨 provider가 추가될 경우(예: `ExecutionStatusProvider`, `CanvasThemeProvider`) provider 중첩이 깊어져 `WorkflowCanvas` JSX가 복잡해질 수 있다. 또한 현재 들여쓰기가 `TooltipProvider`와 맞지 않는 것이 diff에서 확인된다(6칸 들여쓰기가 혼재).
- 제안: 허용 가능한 수준이나, provider 수가 3개 이상 될 경우 별도 `CanvasProviders` 컴포넌트로 합성하는 것을 고려할 것. 들여쓰기 스타일은 일관성 유지가 필요하다.

---

## 요약

이번 변경은 세 가지 아키텍처적 개선을 일관되게 수행했다. 첫째, `useBaseModelLoader`를 도입해 chat/embedding 두 loader 간 중복 상태 기계를 Template Method 패턴으로 통합했다 — 결합도와 코드 중복이 감소하고 각 loader의 단일 책임이 명확해졌다. 둘째, 캔버스 AI 노드의 N중 `useQuery` 구독을 `HasDefaultLlmConfigContext`로 대체해 불필요한 렌더링 원인을 제거하고 workspace-level 상태 관리를 `WorkflowCanvas`로 명확히 귀속시켰다. 셋째, 에러 메시지 생성 로직을 `buildLoaderErrorMessages`와 `sanitizeLoaderError`로 분리해 보안 원칙(raw server message 미노출)과 i18n 책임을 데이터 흐름에서 명확하게 분리했다. 전반적으로 SOLID 원칙 중 SRP·OCP·DIP 모두 준수되며, 레이어 경계도 적절히 유지되어 있다. 발견된 WARNING 수준 항목은 옵셔널 파라미터 의도 명확화와 provider 중첩 관리 두 가지로, 기능 정확성에는 영향을 주지 않는다.

## 위험도

LOW
