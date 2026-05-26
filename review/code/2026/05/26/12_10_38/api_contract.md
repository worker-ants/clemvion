# API 계약(API Contract) Review

## 발견사항

### [INFO] `getAll()` 의 dual-shape 응답 계약이 명시적으로 문서화되었으나 근본 해소 미완
- 위치: `/codebase/frontend/src/lib/api/llm-configs.ts` — `getAll()` + `list()`
- 상세: `getAll()` 은 백엔드 응답을 그대로 반환(`return data`) 하므로 `{ data: LlmConfigData[] }` 또는 `LlmConfigData[]` 두 가지 형태가 모두 가능한 "dual-shape" 계약이 유지된다. 이번 변경에서 `list()` 래퍼를 추가해 컴포넌트가 정규화된 배열만 소비하도록 개선한 것은 올바른 방향이다. 다만 `getAll()` 자체의 반환 타입은 `any`(암묵적)로 남아 있어, 향후 다른 소비자가 `getAll()` 을 직접 호출하면 동일한 dual-shape 문제가 재발할 수 있다. 테스트 파일 내 `TODO` 주석도 이 미완 상태를 명시하고 있다.
- 제안: `getAll()` 의 반환 타입을 `Promise<{ data: LlmConfigData[] } | LlmConfigData[]>` 로 명시적으로 선언하거나, 중장기적으로 axios 인터셉터에서 envelope 정규화를 일괄 처리하면 `list()` 의 이중 분기를 제거할 수 있다.

### [INFO] `useModelLoader.isSuccess` 제거 — 내부 인터페이스 breaking change (소비자 범위 확인 완료)
- 위치: `/codebase/frontend/src/components/llm-config/use-model-loader.ts` — `UseModelLoaderResult`
- 상세: `isSuccess: boolean` 필드가 `hasAttemptedLoad: boolean` 으로 교체되었다. 이는 훅의 공개 인터페이스 변경이므로 모든 소비자(`model-combobox.tsx`, `embedding-model-combobox.tsx`)가 함께 업데이트된 것을 확인했다. 단, 이 훅이 `@/components/llm-config/use-model-loader` 경로로 외부 패키지나 공개 API 로 노출될 경우 breaking change 가 된다. 현재 코드베이스 내부 전용 모듈이므로 직접 영향은 없으나, API surface 확장 시 주의가 필요하다.
- 제안: 내부 전용임을 JSDoc 또는 `@internal` 태그로 명시해 향후 혼동을 방지.

### [INFO] `llmConfigsApi.list()` 의 응답 계약이 `getAll()` 호출에 전적으로 의존
- 위치: `/codebase/frontend/src/lib/api/llm-configs.ts` — `list()` 구현
- 상세: `list()` 는 `getAll()` 을 내부적으로 호출한 후 응답을 정규화한다. `getAll()` 은 `{ page?, limit?, search? }` 파라미터를 받지만 `list()` 는 이를 받지 않는다. 즉 `list()` 는 항상 페이지네이션 파라미터 없이 전체 목록을 요청한다. 현재 용도(드롭다운 셀렉터)에서는 이 동작이 의도된 것이지만, 대규모 워크스페이스에서 LLM 설정이 많아질 경우 응답 크기 제한 없이 전부 로드하는 것이 성능 문제가 될 수 있다.
- 제안: 문서 주석에 "전체 목록 페이지네이션 없이 조회" 임을 명시하거나, 향후 서버가 기본 `limit` 을 적용할 경우를 대비해 `limit` 파라미터를 전달하는 방어 로직 검토.

### [INFO] `setDefault` 엔드포인트의 응답 미활용
- 위치: `/codebase/frontend/src/lib/api/llm-configs.ts` — `setDefault()`
- 상세: `await apiClient.patch(...)` 의 반환값을 버린다 (`return` 없음). 서버가 업데이트된 리소스를 반환하더라도 클라이언트가 이를 무시한다. 이는 이번 변경에서 새로 도입된 것은 아니지만, API 계약 관점에서 일관성 이슈다 — 다른 `update()`, `create()` 는 모두 `return data` 를 포함한다.
- 제안: 서버 응답이 있으면 `return data` 로 반환하거나, 의도적으로 무시하는 경우 `// intentionally void` 주석 추가.

---

## 요약

이번 변경의 핵심은 프론트엔드 컴포넌트들이 `llmConfigsApi.getAll()` 의 raw 응답(dual-shape: `{ data: [] }` 또는 `[]`)을 직접 처리하던 인라인 정규화 코드를 제거하고, 새로 추가된 `llmConfigsApi.list()` 래퍼를 통해 타입이 보장된 `LlmConfigData[]` 를 소비하도록 리팩터링한 것이다. API 계약 관점에서 이 변경은 하위 호환성을 유지하면서 클라이언트 쪽의 응답 형식 처리를 일원화했다는 점에서 긍정적이다. 기존 `getAll()` 엔드포인트 계약은 변경되지 않았고, 새 `list()` 는 동일 엔드포인트의 래퍼로서 breaking change 를 유발하지 않는다. `useModelLoader` 의 `isSuccess` → `hasAttemptedLoad` 인터페이스 교체도 내부 소비자 전체에 일괄 반영되어 불일치가 없다. 근본적인 dual-shape 계약(`getAll()` 의 비정형 반환 타입)은 미해소 상태로 남아 있으며, 이는 `TODO` 주석으로 인식되어 있어 향후 인터셉터 기반 정규화로 해결이 예정되어 있다.

## 위험도

LOW
