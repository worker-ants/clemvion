# 부작용(Side Effect) 코드 리뷰

## 발견사항

### [WARNING] `llmConfigsApi.list()` 가 `getAll()` 을 내부에서 재호출하여 React Query 캐시 공유 계약을 깨뜨릴 위험
- 위치: `codebase/frontend/src/lib/api/llm-configs.ts` line 43-49
- 상세: `list()` 는 `llmConfigsApi.getAll()` 을 직접 호출한다. 컴포넌트들은 동일 `["llm-configs"]` queryKey 로 `queryFn: () => llmConfigsApi.list()` 를 등록한다. 그러나 캐시 히트 시 `queryFn` 자체를 건너뛰므로 실제 네트워크 이중 호출은 발생하지 않는다. 문제는 `getAll()` 이 `params` 를 받는 반면 `list()` 는 파라미터 없이 호출하므로, 만약 다른 컴포넌트가 같은 `["llm-configs"]` 키로 `getAll({ page: 2 })` 등 파라미터 버전을 캐싱해 둔 경우 `list()` 가 그 stale 캐시를 반환받을 수 있다. 현재 코드베이스에서 파라미터 버전을 같은 키로 등록하는 컴포넌트는 확인되지 않으나, `getAll` 의 페이지네이션 주석이 명시적으로 "Paginated views should keep calling `getAll(params)`" 라고 권고하므로 미래에 실수가 발생할 수 있다.
- 제안: `list()` 전용 queryKey (`["llm-configs", "list"]`) 를 도입하거나, 또는 `list()` 가 `getAll()` 을 경유하지 않고 `apiClient.get` 을 직접 호출하도록 독립시켜 캐시 키 충돌 가능성을 제거한다.

### [WARNING] `useModelLoader.UseModelLoaderResult` 인터페이스에서 `isSuccess` 제거 — 기존 소비자 파괴적 변경
- 위치: `codebase/frontend/src/components/llm-config/use-model-loader.ts` line 39-52 (diff line -347, +354)
- 상세: 반환 타입에서 `isSuccess: boolean` 이 제거되고 `hasAttemptedLoad: boolean` 으로 교체되었다. 이 훅을 직접 소비하는 파일이 `model-combobox.tsx` 만이라면 이미 `hasAttemptedLoad` 로 교체 완료되었다. 그러나 외부 소비자 중 `isSuccess` 를 구조 분해하거나 타입으로 참조하는 코드가 남아 있다면 런타임 `undefined` 혹은 TypeScript 컴파일 오류가 발생한다.
- 제안: 레포지토리 전체에서 `useModelLoader` 결과의 `isSuccess` 를 참조하는 코드가 없는지 `grep -r "isSuccess"` 로 최종 확인한다.

### [INFO] `useEmbeddingModelLoader` 의 render-phase 상태 변경 패턴 — 동시 렌더러와의 잠재적 부작용
- 위치: `codebase/frontend/src/components/llm-config/use-embedding-model-loader.ts` line 179-186 (prevResetKey 비교 블록)
- 상세: `if (prevResetKey !== resetKey) { setPrevResetKey(...); setModels([]); ... }` 패턴은 React 공식 문서의 "reset state on prop change" 관용구다. 단, 이 패턴은 렌더 함수 내부에서 `setState` 를 직접 호출하므로 React 가 즉시 재렌더를 예약한다. Concurrent Mode / React 18 에서 렌더가 중단·재시작될 경우 이 블록이 여러 번 실행되어 `setModels([])` 등이 중복 호출될 수 있다. React 공식 문서는 이 패턴이 Concurrent Mode 에서 허용됨을 명시하고 있으나, `useModelLoader` 에도 동일 패턴이 있어 두 훅 모두 동일 위험을 공유한다는 점을 주목해야 한다. 현재는 큰 문제가 없지만 미래 React 버전에서 동작이 달라질 수 있다.
- 제안: 현재 동작은 허용 범위 내이므로 즉각 변경 불필요. 단, 두 훅 모두 동일 패턴이므로 추후 `useReducer` 나 `key` prop 리셋 방식으로 통합 검토.

### [INFO] `sanitizeLoaderError` 의 `axios.isAxiosError` 모듈 수준 의존 — 전역 axios 인스턴스 부작용 없음 확인
- 위치: `codebase/frontend/src/components/llm-config/sanitize-loader-error.ts`
- 상세: `axios.isAxiosError` 는 순수 타입 가드 함수이며 전역 상태를 변경하지 않는다. `axios` 를 import 했으나 인스턴스 생성 없이 `isAxiosError` 유틸리티만 사용하므로 전역 axios 설정(interceptor, default headers 등)에 영향을 주지 않는다.
- 제안: 없음. 현재 구현 적절.

### [INFO] `ModelSelectField` 의 `renderOption` prop — ReactNode 반환값이 `<option>` 내부에 삽입됨
- 위치: `codebase/frontend/src/components/llm-config/model-select-field.tsx` line 3006-3008
- 상세: `<option>` 태그는 텍스트 컨텐츠만 허용하는 HTML 원소이므로 `renderOption` 이 복잡한 JSX 를 반환할 경우 브라우저가 예기치 않게 렌더링할 수 있다. 현재 호출자는 `renderOption` 을 전달하지 않아 기본 `defaultOptionLabel` 을 사용하므로 실제 부작용은 없으나, 인터페이스로 열려 있어 미래 오용 여지가 있다.
- 제안: `renderOption` 의 반환 타입을 `string` 으로 좁히거나, JSDoc 에 "텍스트 컨텐츠만 허용" 명시.

### [INFO] `list()` 가 `getAll()` 을 내부 호출 시 `params` 없이 네트워크 이중 요청 발생 가능성
- 위치: `codebase/frontend/src/lib/api/llm-configs.ts` line 44
- 상세: React Query 캐시가 cold 상태일 때 `llmConfigsApi.list()` → `llmConfigsApi.getAll()` 순으로 두 번의 API 레이어 함수가 호출된다. `getAll()` 은 `apiClient.get` 을 직접 호출하므로 실제 HTTP 요청은 1회이다. 부작용 없음. 다만 `getAll()` 의 반환형이 `any` (TypeScript 추론 `unknown`) 이어서 `list()` 내의 타입 단언(`as { data?: ... }`)이 런타임 검증 없이 수행된다. 단, 테스트(파일 15)가 3가지 케이스(`enveloped`, `flat`, `null`)를 모두 커버하므로 허용 범위 내.
- 제안: 없음.

### [INFO] 테스트 파일 주석에 `getAll` 잔류 — 기능 영향 없음
- 위치: `codebase/frontend/src/components/llm-config/__tests__/llm-config-selector.test.tsx` line 1907-1909
- 상세: mock 블록 주석에 "내부적으로 `getAll()` 을 한 번 더 호출하는 정규화 헬퍼이므로 둘 다 mock 해도 되나 단순성 위해 분리" 라는 설명이 있다. 이는 `list()` 가 `getAll()` 을 호출한다는 사실을 인지하고 의도적으로 `list` 만 mock 했음을 나타낸다. 테스트가 `getAll` 을 mock 하지 않아도 `list` 가 mock 되면 `getAll` 은 호출되지 않는다. 동작에 영향 없음.
- 제안: 없음.

---

## 요약

이번 변경은 `llmConfigsApi.getAll()` 의 이중 응답 형태(`{ data: [...] }` 또는 `LlmConfigData[]`)를 중앙에서 정규화하는 `list()` 메서드를 도입하고, 여러 컴포넌트에서 분산·중복 작성되던 정규화 로직과 에러 처리 로직을 `sanitizeLoaderError`, `useEmbeddingModelLoader`, `ModelSelectField` 로 추출하는 리팩터링이다. 전역 변수 도입, 파일시스템 부작용, 환경 변수 접근, 외부 네트워크 추가 호출, 이벤트/콜백 계약 변경은 전혀 없다. 공개 API 면에서는 `UseModelLoaderResult.isSuccess` 가 `hasAttemptedLoad` 로 교체되는 인터페이스 변경이 존재하나, 현재 유일한 직접 소비자인 `model-combobox.tsx` 가 이미 `hasAttemptedLoad` 로 업데이트되어 있다. `llmConfigsApi.list()` 가 `getAll()` 을 경유하는 구조는 같은 `["llm-configs"]` React Query 캐시 키를 공유하는 컴포넌트들과의 캐시 충돌 가능성이 이론적으로 존재하나, 현재 코드베이스에서는 파라미터 버전을 동일 키로 등록하는 사례가 없어 실질적 위험은 낮다.

## 위험도

LOW
