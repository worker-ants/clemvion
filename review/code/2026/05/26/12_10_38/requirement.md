# 요구사항(Requirement) 리뷰 결과

## 리뷰 대상 요약

`llm-model-select-4857c3` 워크트리에서 수행된 LLM 설정 / 임베딩 모델 선택 **select-only 전환** 후속 리팩터링 (SUMMARY #8/#11 + architecture INFO 처리) 에 해당하는 17개 파일 변경을 검토한다.

주요 변경 내용:
- `llmConfigsApi.getAll()` 직접 호출 → `llmConfigsApi.list()` 로 전환 (API 응답 정규화 내재화)
- `EmbeddingModelCombobox` 내 인라인 상태 관리 로직 → `useEmbeddingModelLoader` 훅으로 추출
- `ModelCombobox` / `EmbeddingModelCombobox` 공통 JSX 패턴 → `ModelSelectField` 컴포넌트로 추출
- `useModelLoader` 의 `isSuccess` → `hasAttemptedLoad` 로 교체
- 에러 sanitize 로직 → `sanitizeLoaderError` 유틸로 추출
- 관련 테스트 파일 mock/assertion 업데이트

---

## 발견사항

### [CRITICAL] spec/2-navigation/6-config.md §B.2 "Fallback" 조항 — 구현과 불일치

- 위치: `spec/2-navigation/6-config.md` 라인 114
- 상세: spec 본문의 `## 기본 모델 선택 UX` §Fallback 항목은 현재도 **"목록에 없는 모델 ID를 직접 타이핑할 수 있으며, 조회 실패 시에도 자유 입력이 가능하다"** 로 기술되어 있다. 그러나 `model-combobox.tsx` 구현은 `NativeSelect` 기반 select-only 로 이미 전환되어 자유 입력이 불가능하다. 또한 `spec/2-navigation/6-config.md` §B.2 "기본 모델" 행 표의 설명도 "프로바이더 모델 조회 API에서 받아온 목록에서 **선택하거나 직접 입력**" 이라고 서술되어 있어 구현과 모순된다. plan 문서(`plan/complete/llm-model-select-only.md`)에 "spec 변경은 본 plan 안에서 직접 처리" 라고 기록되어 있고 spec 변경이 commit `0c3f40a8` 에서 처리됐다고 명시되어 있음에도, 검토 시점의 `spec/2-navigation/6-config.md` 에는 Rationale 섹션이 추가되지 않았고 Fallback bullet 및 기본 모델 행 텍스트가 갱신되지 않은 상태다.
- 제안: `project-planner` 에게 위임하여 `spec/2-navigation/6-config.md` §B.2 표의 "기본 모델" 행을 "프로바이더 모델 조회 API에서 받아온 목록에서 선택 (select-only)" 으로 수정하고, Fallback bullet 을 삭제 또는 "자유 입력 불가, 조회 실패 시 에러 메시지만 표시" 로 교체한 뒤 `## Rationale` 섹션을 추가해야 한다.

---

### [WARNING] `renderOption` prop 이 `<option>` 내부에 ReactNode 를 삽입하나 HTML 제약 위반 가능성

- 위치: `codebase/frontend/src/components/llm-config/model-select-field.tsx` 라인 2836-2838
- 상세: `ModelSelectField` 의 `renderOption?: (m: ModelInfo) => ReactNode` prop 은 `<option>` 태그 자식으로 삽입된다. HTML 표준상 `<option>` 은 text content 만 허용하며 자식 요소(예: `<span>`, `<div>`) 를 가질 수 없다. 현재 `ModelCombobox` / `EmbeddingModelCombobox` 호출자들은 `renderOption` 을 사용하지 않아 기본 `defaultOptionLabel` (문자열 반환) 가 사용되므로 실제 버그는 없다. 그러나 미래 호출자가 JSX element 를 반환하는 `renderOption` 을 주입하면 브라우저가 `<option>` 내 마크업을 무시하거나 렌더링이 깨질 수 있다.
- 제안: `renderOption` 의 반환 타입을 `ReactNode` 에서 `string` 으로 좁히거나, JSDoc 에 "반드시 string 을 반환해야 한다" 제약을 명시해 타입 수준에서 오용을 방지한다.

---

### [WARNING] `useEmbeddingModelLoader` 에서 load 실패 후 `hasAttemptedLoad` 가 `true` 로 유지되어 isEmpty 조건이 잘못 발화할 수 있음

- 위치: `codebase/frontend/src/components/llm-config/use-embedding-model-loader.ts` 라인 3189-3201
- 상세: `onMutate` 에서 `setHasAttemptedLoad(true)` 를 세팅하고 `onError` 에서는 초기화하지 않는다. `ModelSelectField` 의 `isEmpty` 조건은 `!errorMessage && hasAttemptedLoad && !hasLoadedModels` 이다. 따라서 시나리오: ① 로드 시도 → 실패 (`errorMessage` 설정됨) → 정상적으로 error 메시지 표시. ② 이후 재시도 시작 (`onMutate` → `setErrorMessage(null)`, `setHasAttemptedLoad(true)` 이미 true) → 로드 중 (`isPending=true`) 에는 `errorMessage=null, hasAttemptedLoad=true, models=[]` 이므로 `isEmpty=true` 가 되어 "모델 없음" 메시지가 pending 중에 순간 표시될 수 있다. `useModelLoader` 도 동일 패턴이나 `ModelSelectField` 는 `isPending` 을 직접 숨김 로직에 사용하지 않는다. `isEmpty` 판정에 `!isPending` 조건을 추가하면 이 플리커를 방지할 수 있다.
- 제안: `ModelSelectField` 내 `isEmpty` 를 `!errorMessage && hasAttemptedLoad && !hasLoadedModels && !isPending` 으로 변경하거나, `useEmbeddingModelLoader.onMutate` 에서 `setHasAttemptedLoad(false)` 를 pending 중에는 리셋해 pending 완료 후 결과에 따라 재설정하는 패턴으로 변경한다.

---

### [WARNING] `llm-config-selector.test.tsx` mock 에서 `getAll` 이 제거되어 LlmConfigSelector 내부에서 `list()` 가 `getAll()` 을 실제로 호출할 때 에러 발생 위험

- 위치: `codebase/frontend/src/components/llm-config/__tests__/llm-config-selector.test.tsx` 라인 1895-1901
- 상세: 테스트 mock 은 `llmConfigsApi` 를 `{ list: vi.fn() }` 으로 교체한다. 그런데 `llmConfigsApi.list()` 의 구현은 내부적으로 `llmConfigsApi.getAll()` 을 호출한다 (`llm-configs.ts` 라인 44: `const raw = await llmConfigsApi.getAll()`). vi.mock 의 전체 대체(`...actual` spread 없이 `list` 만 선언)를 사용하면 `getAll` 은 `vi.fn()` (항상 `undefined` 반환) 이 되어 `list()` 내 `await llmConfigsApi.getAll()` 이 `undefined` 를 반환 → `enveloped` 및 `raw` 분기 모두 빠져 `[]` 반환하게 된다. 현재는 `list` 자체가 mock 으로 완전 대체되어 내부 `getAll` 이 호출되지 않으므로 실제 문제는 없지만, mock 구성이 구현의 내부 의존성과 미묘하게 엇갈린다. 주석(`// 내부적으로 getAll() 을 한 번 더 호출하는 정규화 헬퍼`) 이 이를 인지하고 있으나 잠재적 혼란 요인이다.
- 제안: 주석이 이미 상황을 설명하고 있으므로 현 상태 유지 가능. 단, `list` mock 이 실제 구현 체인을 추적하는 통합 테스트가 필요하다면 `llm-configs.test.ts` 에서 이미 커버하고 있으므로 충분하다.

---

### [INFO] `getAll()` JSDoc 에 `LLM_CONFIGS_QUERY_KEY` 참조가 여전히 `getAll()` 기준으로 작성되어 있음

- 위치: `codebase/frontend/src/lib/api/llm-configs.ts` 라인 4-9
- 상세: `LLM_CONFIGS_QUERY_KEY` 에 붙은 JSDoc 은 "React Query key for `llmConfigsApi.getAll()`" 라고 기술하고 있다. 그러나 이번 변경 이후 모든 컴포넌트가 `getAll()` 대신 `list()` 를 `queryFn` 으로 사용한다. JSDoc 이 실제 사용 방식과 어긋나 있어 향후 혼란을 유발할 수 있다.
- 제안: JSDoc 을 "React Query key for `llmConfigsApi.list()`. Shared across components..." 로 업데이트한다.

---

### [INFO] `spec/2-navigation/6-config.md` §B.2 기본 모델 행 표 — 본문에 Rationale 섹션 미첨부

- 위치: `spec/2-navigation/6-config.md` 전체 파일
- 상세: plan 문서에 "spec 변경: Rationale R-1 신규 추가" 가 commit `0c3f40a8` 결과로 기록되어 있으나, 검토 시점 `spec/2-navigation/6-config.md` 의 실제 내용에는 `## Rationale` 섹션이 존재하지 않는다. spec 파일이 commit `0c3f40a8` 에서 실제로 수정됐는지 확인이 필요하다. (위 CRITICAL 발견과 연관)
- 제안: `project-planner` 에게 위임하여 spec 에 Rationale 섹션을 추가하고 plan 에 기록된 내용과 실제 파일을 동기화한다.

---

### [INFO] `sanitizeLoaderError` — HTTP 응답 없이 `err.response` 가 `undefined` 인 경우 분기 처리는 올바르나, `message: ""` (빈 문자열) 에 대한 fallback 동작이 암묵적

- 위치: `codebase/frontend/src/components/llm-config/sanitize-loader-error.ts` 라인 3077
- 상세: `combined.length > 0` 조건으로 빈 문자열은 fallback 으로 처리된다. 이 동작은 의도에 부합하나 JSDoc 이나 주석에 "빈 문자열은 fallback 으로 처리" 를 명시하지 않아 미래 수정 시 의도가 흐려질 수 있다.
- 제안: `if (combined && combined.length > 0)` 에 짧은 설명 주석 추가 ("empty string treated as absent — use fallback").

---

### [INFO] `use-embedding-model-loader.ts` — `onError` 에서 `models` 를 유지하는 정책이 `useModelLoader` 와 대칭이나 주석 누락

- 위치: `codebase/frontend/src/components/llm-config/use-embedding-model-loader.ts` 라인 3198-3200
- 상세: `useModelLoader` 의 `onError` 에는 "재시도 실패 시 이전에 로드된 모델 목록은 유지해 사용자 선택 컨텍스트를 보존" 주석이 있으나, `useEmbeddingModelLoader` 의 동일 위치에는 해당 주석이 없다. 동작은 동일하나 독립적으로 읽을 때 의도가 명확하지 않다.
- 제안: `useEmbeddingModelLoader.onError` 에도 동일 취지의 한 줄 주석 추가.

---

### [INFO] `plan/complete/llm-model-select-only.md` 결과 섹션에 followup plan 의 실제 이행 여부가 반영되지 않을 수 있음

- 위치: `plan/complete/llm-model-select-only.md` 라인 3963-3966
- 상세: 이 PR 은 followup plan (`plan/in-progress/llm-model-select-followup-refactor.md`) 에 등록된 SUMMARY #8 / #11 / architecture INFO 를 이행하는 것으로 보인다. 그러나 plan 파일의 `followup_plans` 참조 문서에 완료 여부가 기록됐는지, 또는 in-progress → complete 이동이 이 PR 에 포함됐는지 프롬프트 payload 에서 확인되지 않는다. plan 라이프사이클 규약에 따라 followup plan 도 완료 처리가 필요하다.
- 제안: `plan/in-progress/llm-model-select-followup-refactor.md` 를 `plan/complete/` 로 이동하고 완료 결과를 기록하거나, 미완료 항목이 남아있으면 현재 상태를 명확히 기록한다.

---

## 요약

이번 변경은 `llmConfigsApi.list()` 도입을 통한 응답 정규화 내재화, `useEmbeddingModelLoader` 훅 추출, `ModelSelectField` 공통 컴포넌트 추출이라는 세 가지 리팩터링 목표를 완전히 구현하고 있다. 기능 완전성 측면에서 API 응답 정규화 로직은 `list()` 헬퍼에 집중되어 있으며 단위 테스트로 세 가지 응답 형태(envelope / flat / null)를 모두 커버한다. `hasAttemptedLoad` 도입으로 stale `isSuccess` 버그가 수정되었고, `sanitizeLoaderError` 추출로 에러 처리 중복이 제거된 점도 긍정적이다. 그러나 **spec fidelity 관점에서 `spec/2-navigation/6-config.md §B.2` 의 "Fallback: 자유 입력 가능" 항목과 "기본 모델" 행 표가 select-only 구현과 여전히 상충**하는 CRITICAL 발견이 있다. 이 spec 불일치는 plan 기록에는 처리 완료로 기재되어 있으나 실제 spec 파일에 반영되지 않아 SoT(단일 진실 원칙)를 위반한다. 그 외 `renderOption` 타입 안전성 부족, pending 중 isEmpty 플리커 가능성 두 건의 WARNING 이 존재하며, JSDoc 업데이트 및 followup plan 라이프사이클 처리 등 INFO 항목이 있다.

---

## 위험도

**MEDIUM**

spec 구현 불일치가 CRITICAL 으로 분류되나 런타임 기능 자체는 올바르게 동작한다. 다만 spec 이 여전히 "자유 입력 가능" 을 정의하고 있어 향후 신규 개발자나 spec 기반 작업 시 혼란 및 회귀 위험이 있다.
