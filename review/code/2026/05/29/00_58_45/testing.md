# Testing Review — llm-model-select-followup-refactor

## 발견사항

### [INFO] useBaseModelLoader 직접 단위 테스트 없음
- 위치: `codebase/frontend/src/components/llm-config/use-base-model-loader.ts` (신규 파일 전체)
- 상세: `useBaseModelLoader`는 `useModelLoader`와 `useEmbeddingModelLoader` 양쪽이 위임하는 핵심 상태 머신임에도 직접 테스트 파일이 없다. `resetKey`를 통한 render-phase reset, `captureSnapshot`/`isSnapshotCurrent` 제네릭 stale-closure 가드, `canLoad=false`일 때 `load()` 호출 무시 여부 등 핵심 로직이 두 소비자 테스트(`use-model-loader.test.tsx`, `use-embedding-model-loader.test.tsx`)를 통해 간접 커버된다. 간접 커버가 완전히 부재한 것은 아니지만, 소비자가 늘어나거나 리팩터링 시 회귀를 조기에 잡기 어렵다.
- 제안: `use-base-model-loader.test.tsx`를 추가하고, 제네릭 `captureSnapshot`/`isSnapshotCurrent` 파라미터를 dummy 구현으로 직접 주입하는 단위 테스트(최소: reset 동작, stale 가드, canLoad=false 시 no-op)를 작성한다. 기존 소비자 테스트는 통합 레벨로 유지.

### [INFO] buildLoaderErrorMessages 직접 단위 테스트 없음
- 위치: `codebase/frontend/src/components/llm-config/loader-error-messages.ts` (신규 파일 전체)
- 상세: `buildLoaderErrorMessages(t)`는 단순 객체 빌더이지만, 반환 키(`LLM_CREDENTIALS_REQUIRED`, `LLM_CONFIG_INVALID`)는 백엔드 에러 코드와 직결되므로 문자열 오타가 기능 버그로 이어진다. 현재는 `model-combobox.test.tsx`, `embedding-model-combobox.test.tsx`, `sanitize-loader-error.test.ts`에서 코드 문자열 상수를 직접 하드코딩해 검증하는 방식으로 간접 커버되나, 해당 함수 자체의 키 정확성은 검증하지 않는다.
- 제안: `loader-error-messages.test.ts`를 추가하거나, `sanitize-loader-error.test.ts`에 `buildLoaderErrorMessages`를 통합해 실제 i18n 키 — `LLM_CREDENTIALS_REQUIRED`, `LLM_CONFIG_INVALID` — 가 반환 맵에 존재하는지 assertion을 추가한다.

### [INFO] custom-node.test.tsx — hasDefaultLlmConfig=true 경로 미검증
- 위치: `codebase/frontend/src/components/editor/canvas/__tests__/custom-node.test.tsx`, `renderNode()` 호출 전체
- 상세: `renderNode` 헬퍼에 `hasDefaultLlmConfig?: boolean` 옵션이 추가되었고 기본값이 `false`이다. 그런데 실제로 `hasDefaultLlmConfig: true`를 넘기는 테스트는 해당 파일 내에 존재하지 않는다(grep 결과 `true`를 전달하는 호출 없음). AI 노드(`ai_agent`, `text_classifier`, `information_extractor`)에서 `hasDefaultLlmConfig=true`일 때 `summaryContext`가 달라지고 이에 따라 summary/warning 렌더링이 달라지는 경로가 통합 레벨로 검증되지 않는다. `node-config-summary.test.ts`에서 `getConfigSummary` 순수 함수 레벨로는 커버되지만, 컴포넌트 렌더 레벨은 공백이다.
- 제안: AI 노드 타입에 `hasDefaultLlmConfig: true`를 전달했을 때 경고 아이콘이 사라지거나(또는 summary text가 달라지는) 케이스를 1개 이상 추가한다.

### [INFO] use-default-llm-config-id 테스트 — loading 상태 중 반환값 미검증
- 위치: `codebase/frontend/src/components/llm-config/__tests__/use-default-llm-config-id.test.tsx:61-68`
- 상세: 빈 배열 케이스의 검증이 `await waitFor(() => expect(llmConfigsApi.list).toHaveBeenCalled())` 후 `result.current`를 확인하는 패턴을 쓴다. 이 방식은 쿼리가 아직 in-flight인 상태(초기 로딩)와 "응답이 빈 배열"인 상태를 구분하지 않는다. 훅의 명세가 "loading 중 → `undefined`를 반환해야 한다"이므로, 이 케이스는 이미 settle된 이후에만 검사된다. 실제 로직상 두 상태 모두 `undefined`를 반환하므로 기능 버그는 없지만, 의도된 동작임이 명시적이지 않다.
- 제안: 주석으로 "loading 중에도 undefined를 반환함(configs 기본값 [])" 의도를 명시하거나, `isLoading` 중 반환값 체크를 별도 케이스로 분리한다.

### [INFO] use-embedding-model-loader 테스트 — missing-config-id 방어 경로 미검증
- 위치: `codebase/frontend/src/components/llm-config/use-embedding-model-loader.ts:36-38` (방어 throw)
- 상세: `fetchModels` 내부에서 `configId`가 `undefined`일 때 `throw new Error("missing-config-id")`로 방어하는 경로가 존재한다. `canLoad=false` 가드가 정상 흐름에서 이를 막지만, 해당 throw 경로 자체는 어떤 테스트에서도 직접 트리거되지 않는다. 테스트에서 `canLoad=false` 케이스는 검증되지만 `canLoad`를 우회해 `load()`를 강제 호출하는 케이스는 없다.
- 제안: 낮은 우선순위. `canLoad=false` 가드가 충분하므로 지금 당장 필수는 아니나, 방어 코드 경로임을 코드 주석으로 강조하거나 간단한 unit-test를 추가해 "canLoad=false 시 load()는 no-op"임을 명시한다.

### [WARNING] sanitize-loader-error.test.ts — 이전 `data.message` 형태 응답 처리 테스트 삭제
- 위치: `codebase/frontend/src/components/llm-config/__tests__/sanitize-loader-error.test.ts` (삭제된 테스트 전체)
- 상세: 리팩터 전 코드는 `{ message: string | string[] }` 형태 응답을 처리했고, 그에 대한 테스트(문자열 반환, 배열 join, 200자 트런케이션, 빈 문자열 fallback)가 있었다. 이 모든 케이스가 삭제됐다. 새 구현은 `{ error: { code, message } }` 형태만 처리하므로, 만약 일부 백엔드 엔드포인트가 구 형태 응답을 여전히 반환한다면 무음 fallback으로 처리되어 사용자에게 불필요하게 일반적인 오류 메시지만 표시된다. 백엔드가 `http-exception.filter`를 통해 모든 응답을 새 형태로 보장한다면 문제 없지만, 그 보장이 테스트 레벨에서 검증되지 않는다.
- 제안: 구 형태(`data.message` 직접 포함)의 응답이 실제로 발생 가능한지 백엔드 필터 적용 범위를 확인한다. 만약 전환 기간 중 구 형태가 올 수 있다면, `sanitizeLoaderError`에서 하위 호환 처리를 추가하거나 해당 케이스를 명시적으로 "fallback 반환"함을 테스트로 문서화한다.

### [INFO] EmbeddingModelCombobox 테스트 — LLM_CONFIGS_QUERY_KEY mock 추가
- 위치: `codebase/frontend/src/components/knowledge-base/__tests__/embedding-model-combobox.test.tsx:621`
- 상세: `vi.mock("@/lib/api/llm-configs")` 에 `LLM_CONFIGS_QUERY_KEY: ["llm-configs"]`가 추가됐다. 이는 `useDefaultLlmConfigId`가 해당 상수를 import하기 때문에 필수로 추가된 것이다. mock 내부에서 하드코딩된 배열 값이 실제 소스의 `LLM_CONFIGS_QUERY_KEY` 상수와 동기화되지 않을 경우 query 캐시 공유가 깨질 수 있다. 현재는 값이 일치하므로 문제 없으나, 향후 키 변경 시 mock과 실제 값이 어긋날 수 있다.
- 제안: `vi.mock` 내부에 정적 문자열 배열을 하드코딩하는 대신, `async (importOriginal)` 패턴(파일 10 `use-default-llm-config-id.test.tsx`에서 이미 사용 중)을 활용해 실제 모듈에서 `LLM_CONFIGS_QUERY_KEY`를 그대로 가져오도록 통일한다. 이를 통해 키 변경 시 mock 누락으로 인한 무음 실패를 방지한다.

---

## 요약

이번 변경은 per-node `useQuery` 중복 구독을 context 기반 단일 공급으로 교체하고, 에러 처리를 raw 서버 메시지 노출에서 에러 코드 기반 i18n 매핑으로 전환하는 두 가지 핵심 리팩터를 포함한다. 기존 테스트는 모두 새 동작에 맞게 정합성 있게 업데이트되었고, `has-default-llm-config-context`, `use-default-llm-config-id`, `sanitize-loader-error`에 대한 신규/갱신 테스트가 잘 작성되어 있다. 정보 유출 방지(raw 서버 메시지 미노출) 시나리오는 통합 및 단위 테스트 양쪽에서 명시적으로 검증된다는 점이 양호하다. 주요 갭은 두 소비자가 공통 위임하는 `useBaseModelLoader`에 직접 단위 테스트가 없다는 점과, `buildLoaderErrorMessages`의 에러 코드 키 정확성이 별도 단위 테스트로 검증되지 않는다는 점, custom-node에서 `hasDefaultLlmConfig=true` 경로가 컴포넌트 렌더 레벨로 커버되지 않는다는 점이다. 이들은 모두 INFO 또는 WARNING 수준이며 현재 커버리지로 명백한 회귀 위험은 없다.

## 위험도

LOW
