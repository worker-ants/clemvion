# Requirement Review

## 발견사항

---

### 1. HasDefaultLlmConfigProvider — 제공 위치와 spec 요구사항 일치 여부

- **[INFO]** spec `spec/3-workflow-editor/0-canvas.md §5.3.2` 는 "Default provider" 선택(`llmConfigId=""`) 시 LLM Config에서 **실제 default 존재 여부를 확인**하여 없으면 `"⚠ Default provider not configured"` 를 표시하도록 요구한다. 이 요구사항은 이번 변경으로 충족된다 — `WorkflowCanvas` 가 `llmConfigs.find((c) => c.isDefault)?.id ?? null` 로 default 존재 여부를 판별하고, `hasDefaultLlmConfig = defaultLlmConfigId !== null` 을 Context 로 하향 전파한다. `CustomNode` 는 이를 `summaryContext.hasDefaultLlmConfig` 로 `getConfigSummary` 에 전달한다. 기능 완전성 관점에서 충족.
  - 위치: `/codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` L124–126, `/codebase/frontend/src/components/editor/canvas/custom-node.tsx` L291–294

---

### 2. `useBaseModelLoader` — 렌더 중 setState 복수 호출 패턴

- **[WARNING]** `use-base-model-loader.ts` 의 render-phase reset 블록(L70–75)에서 `setPrevResetKey`, `setModels`, `setErrorMessage`, `setHasAttemptedLoad` 를 한 렌더 안에서 연속 호출한다. React 18 automatic batching 이 적용된 환경에서는 이 네 번의 setState 가 단일 re-render 로 일괄 처리되므로 실제로는 문제가 없다. 그러나 이 패턴은 React 공식 문서가 권장하는 "render 중 단일 state setter 만 호출"과 미묘하게 다르다 — React 는 render-phase setter 를 한 번 더 렌더 트리거로 간주할 수 있으며, 배칭 여부가 React 버전·renderer·StrictMode 설정에 따라 달라진다. 기존 `useModelLoader`·`useEmbeddingModelLoader` 에도 동일 패턴이 있었으므로 이번 리팩토링이 새로 도입한 문제는 아니지만, 통합된 기반 코드로 이동하면서 영향 범위가 넓어졌다.
  - 위치: `/codebase/frontend/src/components/llm-config/use-base-model-loader.ts` L69–75
  - 상세: 네 개의 독립 state 를 단일 객체 state 로 묶거나, `useReducer` 로 원자적 reset action 을 처리하면 완전히 안전해진다. 기능적으로 현재 동작에 문제가 있다는 증거는 없으나 패턴 개선 권고.
  - 제안: `{ models, errorMessage, hasAttemptedLoad }` 를 단일 `useReducer` state 로 합치고 `RESET` action 으로 일괄 초기화.

---

### 3. `LLM_AUTH_ERROR` 코드 누락

- **[WARNING]** spec `spec/5-system/7-llm-client.md §6` 에 `LLM_AUTH_ERROR (401, 인증 실패)` 코드가 에러 처리 표에 등재되어 있다. 그러나 `buildLoaderErrorMessages` (`loader-error-messages.ts`) 는 `LLM_CREDENTIALS_REQUIRED` 와 `LLM_CONFIG_INVALID` 만 매핑하고, `LLM_AUTH_ERROR` 는 다루지 않는다. `LLM_AUTH_ERROR` 는 런타임 LLM 호출 실패(§6 표, 401 인증 실패)에 해당하고, `LLM_CREDENTIALS_REQUIRED` 는 preview 요청의 non-local provider apiKey 누락(§5.5)에 해당하므로 별개의 코드다. 저장된 config 의 모델 목록 조회(`GET /llm-configs/:id/models`) 에서 401 이 반환될 경우 `LLM_AUTH_ERROR` 로 올 수 있으나, 현재 코드는 이를 fallback 메시지로만 처리한다.
  - 위치: `/codebase/frontend/src/components/llm-config/loader-error-messages.ts` L11–14
  - spec SoT: `spec/5-system/7-llm-client.md §6` 에러 처리 표
  - 상세: spec 에서 `LLM_AUTH_ERROR` 가 모델 목록 조회 context 에서도 발생하는지 명시되어 있지 않다 — §6 는 chat 호출 맥락이고 §5.5 는 preview 전용 코드(`LLM_CREDENTIALS_REQUIRED`)를 사용한다. spec 자체의 경계가 다소 모호하여 `LLM_AUTH_ERROR` 가 목록 조회에도 내려올 수 있는지 불명확하다. spec 이 이 코드를 목록 조회 path 에서 명시적으로 제외하거나 포함한다면 `buildLoaderErrorMessages` 에 반영이 필요하다.
  - 제안: `project-planner` 에 spec `spec/5-system/7-llm-client.md §5.5` 및 §6 의 `LLM_AUTH_ERROR` 발생 scope 를 명확히 할 것을 위임. 그때까지 현행 코드는 fallback 처리로 기능 저하 없이 동작하므로 차단 수준은 아님.

---

### 4. `sanitize-loader-error` — 에러 envelope 형식 변경 완전성

- **[INFO]** `sanitizeLoaderError` 는 이전에 `{ message }` 를 직접 읽었으나, 이번 변경으로 `{ error: { code } }` 를 읽도록 변경됐다. 이는 spec `spec/5-system/3-error-handling.md §2.1` 의 표준 에러 응답 형식 `{ error: { code, message, ... } }` 와 일치한다. 이전 구현이 spec 과 맞지 않는 `{ message }` flat 구조를 읽고 있었으므로, 이번 변경이 spec 정합성을 회복하는 수정이다. spec fidelity 관점에서 긍정적 변화.
  - 위치: `/codebase/frontend/src/components/llm-config/sanitize-loader-error.ts`

---

### 5. `useDefaultLlmConfigId` — loading 중 `undefined` 반환과 `EmbeddingModelCombobox` 연동

- **[INFO]** `useDefaultLlmConfigId` 는 list 로딩 중 또는 빈 배열일 때 `undefined` 를 반환한다. `EmbeddingModelCombobox` 는 이를 `effectiveConfigId` 로 전달하고, `useEmbeddingModelLoader` 는 `configId === undefined` 일 때 `canLoad = false` 를 반환한다. 그 결과 "모델 불러오기" 버튼이 비활성으로 유지된다. 이는 spec `spec/2-navigation/6-config.md §B.2` 의 "모델을 한 번도 불러오지 않은 상태에서는 select 가 비활성" 요구사항과 일치한다. 엣지 케이스(list 로딩 중, 빈 결과) 모두 올바르게 처리된다.
  - 위치: `/codebase/frontend/src/components/llm-config/use-default-llm-config-id.ts` L16–17

---

### 6. `LLM_CONFIGS_QUERY_KEY` — 쿼리 캐시 공유

- **[INFO]** `useDefaultLlmConfigId` 가 `LLM_CONFIGS_QUERY_KEY` 를 공유해 `WorkflowCanvas` 의 기존 `useQuery` 캐시와 같은 데이터를 재사용한다. 그러나 `EmbeddingModelCombobox` 는 Knowledge Base 페이지에서 렌더되므로 `WorkflowCanvas` 의 QueryClient 인스턴스와 다를 수 있다 — 두 컴포넌트가 같은 React QueryClient Provider 아래 있지 않으면 캐시가 공유되지 않는다. 이는 "single fetch" 의도가 완전히 달성되지 않을 수 있음을 의미하지만, 기능 정확성에는 영향이 없다(각자 독립적으로 동일 endpoint 를 호출한다). `use-default-llm-config-id.ts` 의 JSDoc 이 "cache 공유" 를 약속하는데, 실제 공유는 동일 QueryClient Provider 스코프에 의존함을 주석에 명시하면 더 명확할 것이다.
  - 위치: `/codebase/frontend/src/components/llm-config/use-default-llm-config-id.ts` L8–11

---

### 7. `HasDefaultLlmConfigProvider` — 중첩 tooltip provider 내 위치

- **[INFO]** `HasDefaultLlmConfigProvider` 가 `TooltipProvider` 안에 위치한다. Context 의 접근성·기능 측면에서 문제는 없으나, `HasDefaultLlmConfigProvider` 의 scope 가 `TooltipProvider` 안으로 한정되어 외부에서 우연히 `CustomNode` 를 렌더할 경우 default `false` 로 동작한다는 점이 코드에도 문서화되어 있어 intentional 하다.
  - 위치: `/codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` L585, L594

---

### 8. `LLM_CREDENTIALS_REQUIRED` i18n 텍스트 — spec 표현과 미세 차이

- **[INFO]** spec `spec/5-system/7-llm-client.md §6` 는 `LLM_CREDENTIALS_REQUIRED` 에 대해 "API 키 확인 안내" 라고 기술한다. 구현에서는 `ko: "API 키를 입력한 뒤 다시 시도해주세요"`, `en: "Enter an API key, then try again"` 이다. spec 본문이 정확한 사용자 메시지 문자열을 정의하지 않고 의도만 기술하므로, 구현이 그 의도(API 키 입력 안내)를 충족한다. CRITICAL 수준 불일치 없음.

---

## 요약

이번 변경은 세 가지 독립적 리팩토링을 포함한다: (1) `CustomNode` 의 per-node `useQuery` 제거 및 `HasDefaultLlmConfigContext` 도입 — spec `spec/3-workflow-editor/0-canvas.md §5.3.2` 의 AI 노드 default provider 경고 요구사항을 충족하면서 N-node 쿼리 구독을 단일 context 전파로 교체한 것으로 기능 완전성에 문제 없음. (2) `sanitizeLoaderError` 를 `{ error.code }` 기반 코드 매핑으로 전환 — spec `spec/5-system/3-error-handling.md §2.1` 표준 응답 형식 및 `spec/5-system/7-llm-client.md §6` 코드 목록과 일치하며, raw 서버 메시지 노출 차단 요구사항(spec §5.5 "키/엔드포인트 원문 노출 금지")을 올바르게 구현. (3) `useBaseModelLoader` 추출 및 `useDefaultLlmConfigId` 신규 훅 — 로직 중복 제거이며 기존 동작을 충실히 재현한다. 주요 우려 사항은 render-phase 에서 복수의 독립 setState 를 연속 호출하는 패턴(WARNING), 그리고 spec 에 등재된 `LLM_AUTH_ERROR` 코드가 loader error map 에 누락된 점(WARNING — spec 의 적용 scope 가 불명확하여 차단 수준 아님)이다.

## 위험도

LOW
