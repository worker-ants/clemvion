# Documentation Review — LLM Model Select-Only 전환

## 발견사항

### [INFO] `getAll()` 독스트링 부재 — 사용 구분 가이드 필요
- 위치: `codebase/frontend/src/lib/api/llm-configs.ts` — `getAll()` 함수
- 상세: `list()`에는 상세한 JSDoc이 추가되어 언제 쓰는지 명확히 설명하고 있다. 반면 `getAll()`은 어떤 맥락(페이지네이션, raw 응답이 필요한 경우)에 써야 하는지 독스트링이 없다. `list()` 주석에서 "Paginated views should keep calling `getAll(params)`" 라고 언급하고 있어, 두 메서드의 적절한 용도 경계를 `getAll()` 쪽에도 기술해야 혼동을 방지할 수 있다.
- 제안: `getAll()`에 "Raw response (may be `{data: [...]}` envelope or direct array). Prefer `list()` for simple array use-cases; use `getAll()` when pagination params are needed or the raw envelope shape must be handled by the caller." 형태의 JSDoc 추가.

### [INFO] `LLM_CONFIGS_QUERY_KEY` 독스트링이 `getAll()` 만 언급 — `list()` 누락
- 위치: `codebase/frontend/src/lib/api/llm-configs.ts` L816–820
- 상세: `LLM_CONFIGS_QUERY_KEY` JSDoc이 "React Query key for `llmConfigsApi.getAll()`" 라고 적혀 있지만, 이 변경 이후 모든 컴포넌트는 `list()`를 `queryFn`으로 사용하여 동일 키를 공유한다. 독스트링이 실제 사용 패턴과 불일치한다.
- 제안: "React Query key shared by `llmConfigsApi.list()` (and `getAll()` for paginated views)." 로 수정.

### [INFO] `useEmbeddingModelLoader` — 파라미터 인터페이스 문서 언어 불일치
- 위치: `codebase/frontend/src/components/llm-config/use-embedding-model-loader.ts` — `UseEmbeddingModelLoaderArgs.fallbackErrorMessage`
- 상세: `configId` 파라미터 설명은 한국어로 작성되어 있으나 `fallbackErrorMessage`는 영어로 작성되어 있다. 동일 인터페이스 내 혼용이다. `use-model-loader.ts`의 같은 파라미터도 영어로 작성되어 있어 일관성 면에서 언어를 통일하는 편이 낫다.
- 제안: 두 훅 모두 인터페이스 주석 언어를 통일(한국어 또는 영어). 현재 `use-model-loader.ts`가 영어 기반이므로 `use-embedding-model-loader.ts`도 영어로 맞추거나 프로젝트 주석 언어 정책을 명시.

### [INFO] `sanitize-loader-error.ts` — 리뷰 경로 하드코딩 참조
- 위치: `codebase/frontend/src/components/llm-config/sanitize-loader-error.ts` JSDoc
- 상세: "(see `review/code/2026/05/26/11_30_56` SUMMARY #10)"가 함수 독스트링에 포함되어 있다. 리뷰 경로는 내부 프로세스 기록으로, 코드를 처음 읽는 개발자에게 맥락 없이 노출된다. 코드베이스 밖 경로 참조는 독스트링에 적합하지 않다.
- 제안: 해당 참조를 제거하거나 "Truncated to limit stack-trace / sensitive info leakage." 처럼 동기를 설명하는 문장으로 대체. 리뷰 트레이스는 plan/complete 문서에만 기록.

### [INFO] `ModelSelectField` — `renderOption` prop이 실제 렌더링에서 `option` 내부 컨텐츠만 제어 가능하지만 JSDoc에 제한 미언급
- 위치: `codebase/frontend/src/components/llm-config/model-select-field.tsx` — `ModelSelectFieldProps.renderOption`
- 상세: JSDoc에 "Option 렌더링을 호출자가 커스터마이즈" 라고 설명하지만, `<option>` 태그 내에서만 허용되므로 `ReactNode` 중에서도 텍스트 노드만 실질적으로 렌더링된다는 사실이 누락되어 있다. `<option>` 안에 복잡한 JSX를 넣어도 브라우저가 텍스트만 표시하므로 오용 가능성이 있다.
- 제안: JSDoc에 "Note: `<option>` renders text content only; complex JSX will be stringified by the browser." 추가.

### [INFO] `llm-config-selector.test.tsx` mock 주석에 잘못된 설명
- 위치: `codebase/frontend/src/components/llm-config/__tests__/llm-config-selector.test.tsx` L1907–1909
- 상세: mock 블록 주석이 "내부적으로 `getAll()` 을 한 번 더 호출하는 정규화 헬퍼이므로 둘 다 mock 해도 되나" 라고 설명하는데, `list()`는 실제로 내부에서 `getAll()`을 호출하는 구조이다. 따라서 "selector 가 `list()` 를 직접 호출하고, `list()` 내부에서 `getAll()` 을 호출하므로 `list()` 만 mock 하면 `getAll()`의 실제 구현은 무시된다" 가 더 정확한 설명이다. 현재 표현은 `list()`가 별도의 "정규화 헬퍼"인 것처럼 읽힌다.
- 제안: "selector 가 `list()` 를 호출하며, `list()` 는 내부에서 `getAll()` 을 래핑하므로 `list()` mock 만으로 충분." 으로 수정.

### [INFO] `embedding-model-combobox.test.tsx` — 오래된 `getAll` 참조가 주석에 잔류
- 위치: `codebase/frontend/src/components/knowledge-base/__tests__/embedding-model-combobox.test.tsx` L989
- 상세: 전체 파일 컨텍스트 L989 줄에 `// getAll 이 default config 를 resolve 한 뒤 버튼이 활성화돼야 한다` 라는 인라인 주석이 남아 있다. `getAll`이 아니라 `list`로 mock이 교체되었으므로 주석도 `list` 로 업데이트해야 한다.
- 제안: 해당 주석을 "// list 가 default config 를 resolve 한 뒤 버튼이 활성화돼야 한다" 로 수정.

### [INFO] `plan/complete/llm-model-select-only.md` 결과 섹션 — `useEmbeddingModelLoader` 보류 상태와 실제 구현 불일치
- 위치: `plan/complete/llm-model-select-only.md` — 결과 섹션 "보류 항목"
- 상세: plan 문서의 결과 섹션은 "SUMMARY #8 — `useEmbeddingModelLoader` 훅 추출 (구조적 비대칭). 보류" 라고 기록하고 있으나, 실제 변경 파일 목록에는 `use-embedding-model-loader.ts`가 신규 파일로 포함되어 있다. 즉 보류 항목이 이 PR에서 이미 구현된 상태이며, plan 문서 결과 섹션이 현실을 반영하지 못하고 있다.
- 제안: 결과 섹션의 보류 항목에서 `useEmbeddingModelLoader` 항목을 완료로 이동하거나, followup plan 문서에서도 해당 항목을 완료 처리.

### [INFO] `llm-configs.ts` — `getAll()` 반환 타입 미지정
- 위치: `codebase/frontend/src/lib/api/llm-configs.ts` — `getAll()` 함수 시그니처
- 상세: `getAll()`의 반환 타입이 `Promise<any>` (암시적)이며, `list()`는 `Promise<LlmConfigData[]>`로 명시되어 있다. `list()`를 "prefer" 하도록 유도하는 현재 전략에서 `getAll()`의 타입 불투명성은 장기적으로 타입 안전성을 저해한다. 독스트링을 추가하더라도 반환 타입이 없으면 IDE 지원이 미흡하다.
- 제안: `Promise<LlmConfigData[] | { data: LlmConfigData[] } | unknown>` 등 실제 dual-shape 계약을 명시적으로 반환 타입에 기술. 혹은 단기적으로 `// eslint-disable-next-line @typescript-eslint/no-explicit-any` 없이 `any`를 유지한다면 TODO 주석으로 envelope 중앙화 계획 참조.

## 요약

이번 변경은 `llmConfigsApi.getAll()` 호출 산재를 `list()` 단일 경로로 통합하고, `ModelSelectField` / `useEmbeddingModelLoader` / `sanitizeLoaderError` 세 파일을 신규로 분리하는 구조 개선이다. 신규 공개 API(`list()`, `ModelSelectField`, `useEmbeddingModelLoader`, `sanitizeLoaderError`)에는 목적·제약·사용 맥락을 설명하는 JSDoc이 대체로 잘 작성되어 있으며, 인터페이스 프로퍼티 수준의 설명도 충실하다. 미흡한 부분은 (1) `LLM_CONFIGS_QUERY_KEY` 독스트링이 `getAll`만 언급해 변경 후 실제 사용 패턴과 불일치하는 점, (2) 테스트 파일 내 `getAll` 참조 인라인 주석이 한 곳 잔류하는 점, (3) `plan/complete` 결과 섹션의 보류 항목이 실제 구현 완료 상태를 반영하지 못하는 점, (4) `sanitizeLoaderError` 독스트링의 리뷰 경로 하드코딩 참조처럼 코드베이스 외부 의존 문서 링크가 포함된 점이다. README·CHANGELOG·환경변수 문서화 관점에서는 추가 업데이트가 필요한 신규 설정이나 환경변수가 없으므로 누락 사항이 없다.

## 위험도

LOW
