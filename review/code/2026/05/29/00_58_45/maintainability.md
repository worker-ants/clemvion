# 유지보수성(Maintainability) 리뷰

## 발견사항

### 1. 아키텍처 개선 — useBaseModelLoader 추출

- **[INFO]** `useModelLoader` 와 `useEmbeddingModelLoader` 에서 중복되던 상태 관리(resetKey 패턴, stale closure 가드, 에러 sanitize, `useMutation` 설정)가 `useBaseModelLoader<TSnapshot>` 제네릭 훅으로 통합됨
  - 위치: `codebase/frontend/src/components/llm-config/use-base-model-loader.ts`
  - 상세: 두 소비자 훅이 각각 70+ 줄의 거의 동일한 로직을 직접 포함하고 있었으나, 이번 변경으로 `useBaseModelLoader` 위임 후 소비자 훅은 각각 ~20 줄로 줄어 단일 책임 원칙 준수가 크게 향상됨
  - 제안: 현 상태 유지. 추가로 `useBaseModelLoader` 내 `prevResetKey` 패턴은 React 공식 권장 방식이나, 향후 React 19+ 에서는 별도 API 로 대체될 수 있어 주석 유지 권장

---

### 2. 에러 처리 일관성 — sanitizeLoaderError 의미 변경

- **[WARNING]** `sanitizeLoaderError` 함수의 시그니처가 `(err, fallback)` → `(err, fallback, messagesByCode?)` 로 바뀌며 `messagesByCode` 없이 호출하면 항상 fallback 을 반환함 (기존 동작과 다름)
  - 위치: `codebase/frontend/src/components/llm-config/sanitize-loader-error.ts`
  - 상세: 기존 구현은 서버 `message` 필드를 truncate 후 그대로 반환했으나, 새 구현은 코드 미매핑 시 fallback 반환. `messagesByCode` 미전달 기본 호출은 모든 Axios 에러에서 fallback 을 반환하므로 `use-embedding-model-loader` 의 하위 호환 테스트(`"falls back otherwise"`)는 통과하지만, 직접 `sanitizeLoaderError(err, msg)` 형태로 호출하는 다른 코드가 있다면 에러 메시지가 소실될 수 있음
  - 제안: `messagesByCode` 없이 호출하는 사용 사례가 현재 없음을 확인했으나, 공개 API 임을 고려해 JSDoc 에 "인자 없이 호출하면 fallback 만 반환된다" 를 명시적으로 추가하는 것을 권장

---

### 3. 네이밍 — buildLoaderErrorMessages 위치와 역할

- **[INFO]** `loader-error-messages.ts` 는 순수 팩토리 함수 파일이며 이름이 내용을 잘 나타냄. `buildLoaderErrorMessages(t)` 를 `useMemo` 로 감싸는 패턴이 `ModelCombobox` 와 `EmbeddingModelCombobox` 두 곳에서 동일하게 반복됨
  - 위치: `codebase/frontend/src/components/llm-config/model-combobox.tsx` (L36), `codebase/frontend/src/components/knowledge-base/embedding-model-combobox.tsx` (L15)
  - 상세: `t` 의존성이 바뀌지 않는 한 재계산이 없으므로 성능 문제는 없으나, 두 소비자가 동일한 `useMemo(() => buildLoaderErrorMessages(t), [t])` 패턴을 복제하고 있음
  - 제안: `useMemo` 래핑을 `useLoaderErrorMessages()` 훅으로 분리하거나, 혹은 `buildLoaderErrorMessages` 가 i18n 없이도 static 결정 가능한 구조라면 훅 내부로 이동하는 방향 검토

---

### 4. 인라인 타입 캐스팅 가독성

- **[INFO]** `use-model-loader.ts` 에서 `configId as string` 형태의 타입 단언이 남아 있음
  - 위치: `codebase/frontend/src/components/llm-config/use-model-loader.ts`의 `fetchModels` 내 `llmConfigsApi.listModels(configId as string)`
  - 상세: `useSavedConfig = Boolean(configId) && !trimmedKey` 가드로 분기하므로 논리적으로 안전하나, TypeScript 는 `configId` 가 `string | undefined` 임을 좁혀주지 못해 `as string` 단언이 필요함. 이 단언은 의도적이나, 추후 `configId` 조건 변경 시 컴파일러가 검출하지 못하는 잠재적 버그 포인트임
  - 제안: 좁혀진 타입이 보장되도록 블록 구조를 `if (!configId) throw ...` 형태로 바꾸는 것을 권장 (`useEmbeddingModelLoader` 에서도 동일 패턴으로 처리함)

---

### 5. HasDefaultLlmConfigContext — Provider 인덴트 불일치

- **[WARNING]** `workflow-canvas.tsx` 의 `HasDefaultLlmConfigProvider` 래핑 위치가 들여쓰기 컨벤션에서 벗어남
  - 위치: `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` (diff 라인 591)
  - 상세: `<HasDefaultLlmConfigProvider>` 여는 태그와 닫는 태그가 `<TooltipProvider>` 바로 안에 중첩되는 구조이나, 여는 태그가 `<div>` 와 동일한 들여쓰기 수준 대신 하나 적은 들여쓰기로 작성되어 있음. diff 상 `<HasDefaultLlmConfigProvider value={...}>` 와 닫는 `</HasDefaultLlmConfigProvider>` 가 `<div>`/`</div>` 보다 4 칸 덜 들여쓰여 있어, JSX 트리 중첩 관계를 눈으로 파악하기 어려움
  - 제안: `HasDefaultLlmConfigProvider` 를 `<div ref={reactFlowWrapper}>` 와 동일 들여쓰기 수준으로 정렬

---

### 6. has-default-llm-config-context — 컨텍스트 기본값과 파일명

- **[INFO]** `HasDefaultLlmConfigContext` 의 기본값이 `false` 임은 JSDoc 에 잘 설명되어 있고, Provider 없이 렌더되는 고립 테스트에서 graceful degrade 함. 파일명 `has-default-llm-config-context.ts` 도 내용을 잘 표현함
  - 위치: `codebase/frontend/src/components/editor/canvas/has-default-llm-config-context.ts`
  - 상세: `HasDefaultLlmConfigProvider` 를 `Context.Provider` 에 직접 재export 하는 관용 패턴은 간결하나, Provider 에 별도 래퍼가 필요해질 때 하나의 변경점이 됨. 현재 규모에서는 적절함
  - 제안: 현 상태 유지

---

### 7. 중복 코드 — 테스트 헬퍼 패턴 반복

- **[INFO]** `QueryClient` + `QueryClientProvider` 래핑 패턴(`wrap` 함수)이 `embedding-model-combobox.test.tsx`, `model-combobox.test.tsx`, `use-model-loader.test.tsx`, `use-embedding-model-loader.test.tsx` 등 다수 테스트 파일에서 독립적으로 정의됨
  - 위치: 각 `__tests__/*.test.tsx` 파일 상단
  - 상세: 이미 여러 파일에서 반복되던 기존 패턴이며, 이번 변경에서 신규 도입된 것은 아님. 이번 추가 파일들도 동일 관행을 따름
  - 제안: `test-utils.tsx` 공유 헬퍼 추출은 대규모 리팩토링에 해당하므로 이번 범위 밖이나, 테스트 인프라 정비 시 우선 후보로 기록

---

### 8. useDefaultLlmConfigId — staleTime 매직 넘버

- **[INFO]** `staleTime: 30_000` 가 `use-default-llm-config-id.ts` 에 하드코딩됨
  - 위치: `codebase/frontend/src/components/llm-config/use-default-llm-config-id.ts` (L10)
  - 상세: 동일한 `staleTime: 30_000` 이 기존 코드에도 있었으나 이번에 중앙 훅으로 추출되면서 한 곳으로 모임. `30_000` 의 의미(30초)는 언더스코어 숫자 리터럴로 충분히 가독성이 있으나, 프로젝트 내 다른 쿼리에도 동일 값이 흩어져 있다면 상수 추출이 일관성을 높임
  - 제안: 영향 범위가 작으므로 현 상태 허용 가능. 정책 통일이 필요하면 `LLM_CONFIGS_STALE_TIME` 상수로 추출

---

### 9. LLM_CONFIGS_QUERY_KEY export 일관성

- **[INFO]** `llmConfigsApi` 모듈에서 `LLM_CONFIGS_QUERY_KEY` 를 export 해 `use-default-llm-config-id.ts` 와 테스트가 공유하는 패턴은 쿼리 키 문자열 중복을 제거해 유지보수성을 향상시킴
  - 위치: `codebase/frontend/src/lib/api/llm-configs` (import 기준)
  - 상세: 이전에는 `["llm-configs"]` 리터럴이 여러 컴포넌트에 분산되어 있었으나, 이번 변경으로 단일 진실 원칙이 적용됨. `embedding-model-combobox.test.tsx` 의 mock 에 `LLM_CONFIGS_QUERY_KEY` 도 포함된 것이 올바름
  - 제안: 현 상태 유지

---

## 요약

이번 변경은 유지보수성 관점에서 전반적으로 긍정적인 방향이다. 핵심 개선은 두 가지다. 첫째, `useBaseModelLoader` 제네릭 훅 추출로 약 140 줄의 중복 상태 관리 코드가 제거됐고, 각 소비자 훅은 차이점(네트워크 라우팅, can-load 조건)만 담당하는 단일 책임 구조가 됐다. 둘째, `sanitizeLoaderError` 가 서버 원본 메시지를 그대로 잘라서 반환하던 방식에서 에러 코드 기반 로컬라이즈 메시지 매핑으로 전환됨으로써 국제화와 보안 노출 방지가 동시에 해결됐다. 주요 주의점으로는 `HasDefaultLlmConfigProvider` 의 JSX 들여쓰기 불일치, `configId as string` 타입 단언의 잠재적 위험, 그리고 `buildLoaderErrorMessages` + `useMemo` 중복 패턴이 있으나 세 항목 모두 기능 결함은 아니며 낮은 우선순위의 정리 대상이다. 전체 코드베이스 스타일 및 패턴 준수도 양호하다.

## 위험도

LOW
