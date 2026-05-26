# 아키텍처(Architecture) 리뷰

## 발견사항

### [INFO] `llmConfigsApi.list()` 가 `getAll()` 을 내부 래핑하는 레이어 구조 — API 클라이언트 경계 내 정규화는 올바르나 체이닝 호출이 두 번의 타입 단언을 유발
- 위치: `codebase/frontend/src/lib/api/llm-configs.ts` L43–49
- 상세: `list()` 가 `getAll()` 의 반환값(`any`)을 받아 두 단계 타입 단언(`as { data?: ... }`, `as LlmConfigData[]`)으로 정규화한다. 이중 단언은 타입 시스템을 사실상 우회하며, 서버 응답 shape 이 달라져도 컴파일 오류가 발생하지 않는다. 근본적으로 `getAll()` 의 반환 타입이 `any` 이기 때문에 발생하는 문제다. 정규화 위치는 적절(데이터 레이어 내부)하지만, `getAll()` 에 명시 반환 타입 (`Promise<{ data: LlmConfigData[] } | LlmConfigData[]>`) 을 부여하면 단언 없이 처리 가능하다.
- 제안: `getAll()` 반환 타입을 명시해 `list()` 내 타입 단언을 제거하거나, `list()` 가 `apiClient.get` 을 직접 호출해 정규화를 self-contained 하게 유지할 것.

---

### [INFO] `useEmbeddingModelLoader` 와 `useModelLoader` 의 코어 상태 기계가 거의 동일 — 코드 중복 (DRY 위반)
- 위치: `codebase/frontend/src/components/llm-config/use-embedding-model-loader.ts` L170–222, `use-model-loader.ts` L479–561
- 상세: 두 훅 모두 `[models, setModels]`, `[errorMessage, setErrorMessage]`, `[hasAttemptedLoad, setHasAttemptedLoad]`, `prevResetKey` 기반 render-phase reset, `useMutation` + stale-closure snapshot 가드, `sanitizeLoaderError` 위임 패턴을 공유한다. 차이는 `mutationFn` 의 경로 선택 로직(`previewModels` vs. `listModels`)과 `canLoad` 계산뿐이다. `plan/complete/llm-model-select-only.md` 결과 항목에도 SUMMARY #8(`useEmbeddingModelLoader` 훅 추출)이 보류 항목으로 명시되어 있어 팀이 이미 인지하고 있음을 확인함.
- 제안(보류 항목과 일치): 두 훅이 공유하는 상태 기계를 `useMutationLoader` 같은 내부 훅으로 추출하고, `mutationFn` + `canLoad` 계산만 파라미터로 주입. 단, 현재 코드가 동작하고 있고 리팩터링 plan이 별도 존재(`llm-model-select-followup-refactor.md`)하므로 즉시 차단은 불필요.

---

### [INFO] `EmbeddingModelCombobox` 가 API 응답 정규화(`defaultConfigId` 도출)와 UI 렌더링 로직을 동시에 담당 — 단일 책임 원칙 약한 위반
- 위치: `codebase/frontend/src/components/knowledge-base/embedding-model-combobox.tsx` L1759–1768
- 상세: `EmbeddingModelCombobox` 는 Knowledge Base 도메인의 프레젠테이션 컴포넌트임에도 `useQuery({ queryKey: ["llm-configs"], queryFn: llmConfigsApi.list })` 를 직접 실행하고 `defaultConfigId` 도출까지 수행한다. LLM Config 목록 조회 및 기본값 결정 책임이 llm-config 도메인(`/components/llm-config/`)에 속하지 않고 knowledge-base 컴포넌트 내부에 인라인되어 있다. `plan/complete` 의 보류 항목("architecture INFO — `EmbeddingModelCombobox` API 응답 정규화 레이어 이동")과 동일한 항목.
- 제안: `useDefaultLlmConfigId()` 같은 작은 훅을 `llm-config/` 디렉터리에 추가하고 `EmbeddingModelCombobox` 가 이를 주입받도록 분리. 또는 `effectiveConfigId` 산출 책임을 `useEmbeddingModelLoader` 의 옵션으로 흡수. 단, 현행 구조가 기능적으로 올바르므로 보류 plan 에 위임한다.

---

### [INFO] `ModelSelectField` 가 `useT()` 를 직접 호출 — UI 컴포넌트의 i18n 의존성이 외부 주입 없이 내부화됨
- 위치: `codebase/frontend/src/components/llm-config/model-select-field.tsx` L2977–2978
- 상세: `ModelSelectField` 는 `loadRequiredHint`, `loadedHint`, `formatSavedFallback`, `placeholder` 를 props 로 받는 방식으로 i18n 을 호출자에게 위임하는 구조이다. 그러나 `t("llmConfigs.modelPlaceholder")` 와 버튼 aria-label(`t("llmConfigs.loadingModels")`, `t("llmConfigs.loadModels")`)은 여전히 컴포넌트 내부에서 직접 호출한다. 따라서 `loadButtonLabel` / `loadingButtonLabel` / `emptyPlaceholder` props 가 없는 상태에서 일부 문자열은 `llmConfigs.*` 도메인 키에 고정된다. Knowledge Base 용 `EmbeddingModelCombobox` 가 이 컴포넌트를 재사용할 때 버튼 레이블이 항상 `llmConfigs.*` 네임스페이스 값으로 표시되는 구조적 불일치가 발생한다.
- 제안: `loadButtonLabel`, `loadingButtonLabel` props 를 선택적으로 추가하거나, `noModelsFoundMessage` prop 을 외부 주입으로 전환. 단, 현재 실제 사용 문자열이 동일하다면 런타임 문제는 없으므로 LOW 우선순위.

---

### [INFO] `useModelLoader` 의 render-phase state reset 패턴이 두 군데 반복됨
- 위치: `use-model-loader.ts` L3496–3502, `use-embedding-model-loader.ts` L3271–3277
- 상세: `prevResetKey`/`setPrevResetKey` 기반 render-phase 초기화는 React 공식 문서가 권장하는 패턴이나, 패턴 자체가 훅 간에 복사·붙여넣기로 중복되어 있다. 상태 기계 중복 문제와 동일 원인이므로 별도 항목으로 분리하지 않고 위 DRY 항목과 함께 해결 가능.
- 제안: 훅 추출 시 `useResetOnKeyChange(resetKey: string)` 형태의 내부 유틸리티로 통합.

---

### [INFO] `ModelSelectField` 의 `renderOption` prop 이 선언만 되고 현재 호출자 중 누구도 사용하지 않음 — YAGNI 주의
- 위치: `codebase/frontend/src/components/llm-config/model-select-field.tsx` L2947, L3006–3008
- 상세: `renderOption?: (m: ModelInfo) => ReactNode` 는 현재 `ModelCombobox` 와 `EmbeddingModelCombobox` 모두 전달하지 않는다. 인터페이스 설계 측면에서 확장 포인트는 적절하나 실제 구현이 없는 상태에서 불필요한 인터페이스 표면 확대(Interface Segregation 주의)다.
- 제안: 실제 필요 시점에 추가하거나, 당장 사용하지 않을 예정이라면 제거. 현재로서는 동작에 영향 없으므로 무시해도 무방.

---

## 요약

이번 변경은 전반적으로 아키텍처적으로 올바른 방향이다. API 레이어에 `list()` 메서드를 도입해 응답 정규화 로직을 컴포넌트 내부에서 데이터 계층으로 이동시켰으며(`getAll()` 래핑), `ModelSelectField` 라는 프레젠테이션 컴포넌트 추출로 `ModelCombobox` / `EmbeddingModelCombobox` 간 JSX 중복을 제거했고, `sanitizeLoaderError` 순수 함수로 에러 처리 로직을 독립된 유틸리티로 분리한 것은 모두 바람직한 추상화다. 레이어 책임 분리는 개선되었다. 단, `useModelLoader` 와 `useEmbeddingModelLoader` 의 상태 기계 중복, `EmbeddingModelCombobox` 내부의 LLM Config 조회 및 기본값 도출 책임 혼재, `getAll()` 반환 타입 미명시로 인한 이중 타입 단언은 아직 보류 plan 으로 남아 있으며 후속 리팩터링에서 처리가 예정되어 있다. 이미 팀이 인지하고 있는 항목들이므로 즉시 차단이 필요한 구조 문제는 없다.

## 위험도

LOW
