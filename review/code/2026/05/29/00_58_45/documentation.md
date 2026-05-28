# Documentation Review

## 발견사항

### [INFO] has-default-llm-config-context.ts — JSDoc 우수, 단 "provided once by WorkflowCanvas" 문구 검증 필요
- 위치: `/codebase/frontend/src/components/editor/canvas/has-default-llm-config-context.ts` 전체
- 상세: 모듈 수준 JSDoc이 (1) 성능 배경(N개 구독 → 단일 context), (2) 기본값 false의 graceful-degrade 이유, (3) provider 위치(WorkflowCanvas)를 명확히 설명한다. 신규 파일치고 문서화 품질이 높다. 다만 주석에 "Provided once by `WorkflowCanvas`"라고 명시하고 있어, WorkflowCanvas 외에 다른 곳에서 Provider를 추가할 경우 주석이 outdated 될 수 있다.
- 제안: 현 시점에서는 수정 불필요. Provider 사용처가 늘어날 때 "Provided by the canvas root" 정도로 일반화 권장.

### [INFO] use-base-model-loader.ts — 인터페이스 필드 JSDoc 충실
- 위치: `/codebase/frontend/src/components/llm-config/use-base-model-loader.ts`, `UseBaseModelLoaderArgs` 인터페이스
- 상세: `resetKey`, `captureSnapshot`, `isSnapshotCurrent`, `hasAttemptedLoad` 등 비직관적인 필드마다 의도와 제약이 설명되어 있다. 함수 수준 JSDoc도 공통 관심사(reset, stale-closure guard, error sanitization)를 나열한다.
- 제안: 해당 없음.

### [INFO] loader-error-messages.ts — 보안 배경을 주석에 포함
- 위치: `/codebase/frontend/src/components/llm-config/loader-error-messages.ts` 전체
- 상세: JSDoc에 "Raw server text is never surfaced"와 리뷰 참조(`review/code/2026/05/26/12_10_38 SUMMARY #10`)가 포함되어 있어 설계 의도를 추적할 수 있다. 신규 error code 추가 시 이 파일과 i18n 딕셔너리를 함께 업데이트해야 한다는 안내가 없다.
- 제안: "새 코드 추가 시 `en/llmConfigs.ts`와 `ko/llmConfigs.ts`에 대응 키를 추가해야 한다"는 한 줄 주석 추가를 고려.

### [INFO] sanitize-loader-error.ts — JSDoc이 변경된 로직과 일치
- 위치: `/codebase/frontend/src/components/llm-config/sanitize-loader-error.ts`
- 상세: 이전 JSDoc(truncation, array-join 설명)이 삭제되고 code-based lookup 방식으로 완전히 교체됐다. 새 JSDoc은 envelope 구조(`{ error: { code, message } }`)와 raw message를 surface하지 않는 이유까지 설명한다. 주석과 코드가 완전히 일치한다.
- 제안: 해당 없음.

### [INFO] use-embedding-model-loader.ts — 인라인 주석 일부 삭제됨
- 위치: `/codebase/frontend/src/components/llm-config/use-embedding-model-loader.ts` diff
- 상세: 이전 구현에서 "stale closure 가드", "setModels([]) 를 호출하지 않으므로 기존 목록이 그대로 남는다" 등의 인라인 주석이 useBaseModelLoader 위임으로 인해 사라졌다. 해당 설명은 이제 `use-base-model-loader.ts`의 주석으로 이관됐으므로 중복 제거가 맞다. 단, `canLoad 가드가 있어 정상 흐름에서는 도달하지 않음. 방어용.` 주석은 그대로 유지되어 있어 방어 코드의 존재 이유가 설명된다.
- 제안: 해당 없음.

### [INFO] use-model-loader.ts — 삭제된 주석 중 apiKey 미초기화 이유가 base로 이관됨
- 위치: `/codebase/frontend/src/components/llm-config/use-model-loader.ts` diff
- 상세: 이전에 `use-model-loader.ts` 내부에 있던 "apiKey 변경은 사용자가 타이핑하는 중간 단계라 의도적으로 초기화하지 않는다" 설명이 `useBaseModelLoader` 호출부의 인라인 주석(`// apiKey 변경은 사용자가 타이핑하는 중간 단계라 의도적으로 reset 하지 않는다.`)으로 유지되고 있다. 위치가 변경됐지만 정보는 보존됐다.
- 제안: 해당 없음.

### [WARNING] use-default-llm-config-id.ts — "falls back to the first available config" 동작이 JSDoc에만 있고 타입 시그니처에는 반영되지 않음
- 위치: `/codebase/frontend/src/components/llm-config/use-default-llm-config-id.ts`, 전체
- 상세: JSDoc에 "falling back to the first available config"라고 설명하지만, 이 fallback은 `isDefault` 없는 경우 첫 번째 config를 반환한다는 의미다. 이 로직은 호출자(EmbeddingModelCombobox 등)에게 중요한 계약인데, "isDefault 없을 때 임의 첫 번째 config를 쓴다"는 동작이 의도적인지 명시적으로 언급되어 있지 않다. 다만 JSDoc에 이미 서술되어 있으므로 심각한 문제는 아니다.
- 제안: 기존 JSDoc에 `// Intentional: workspaces without a default config can still load models` 수준의 한 줄을 추가해 명시성 향상.

### [INFO] custom-node.tsx — 인라인 주석이 context 전환 의도를 요약
- 위치: `/codebase/frontend/src/components/editor/canvas/custom-node.tsx`, 라인 `// Shared workspace-level flag from context — see has-default-llm-config-context.`
- 상세: 단 한 줄이지만 "왜 직접 useQuery를 쓰지 않는가"에 대한 맥락을 제공하고 파일 참조까지 포함한다. 전략적 결정을 코드 리더에게 충분히 전달한다.
- 제안: 해당 없음.

### [INFO] workflow-canvas.tsx — 제공 이유 주석 포함
- 위치: `/codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` diff, `// Provided to every CustomNode via context...`
- 상세: Provider를 감싸는 이유(AI 노드가 개별 구독하지 않도록)를 한 줄로 설명한다. 적절하다.
- 제안: 해당 없음.

### [INFO] i18n 딕셔너리 — 신규 키 양 언어 동기화 확인
- 위치: `en/llmConfigs.ts`, `ko/llmConfigs.ts`
- 상세: `errorCredentialsRequired`, `errorConfigInvalid` 두 키가 영문/한국어 딕셔너리 모두에 추가됐다. 내용도 각 언어에 적합하게 작성됐다(en: imperative action phrase, ko: polite -요 어미).
- 제안: 해당 없음.

### [INFO] 테스트 파일의 설명 주석
- 위치: `sanitize-loader-error.test.ts`, `use-model-loader.test.tsx`, `use-embedding-model-loader.test.tsx` 전반
- 상세: 테스트 헬퍼 함수 `axiosError`의 주석이 이전(`// Helper to build a minimal Axios-like error object`)에서 백엔드 envelope 구조와 출처(`http-exception.filter`)를 명시하는 형태로 개선됐다. 테스트가 자체 문서 역할을 한다.
- 제안: 해당 없음.

### [INFO] CHANGELOG / README 업데이트 — 내부 리팩터이므로 불필요
- 상세: 이 변경은 외부 API·설정 옵션·환경변수를 추가하지 않는 내부 리팩터링 + 보안 개선(raw server message 차단)이다. 사용자 대면 기능 변경이 없으므로 README 또는 CHANGELOG 업데이트는 불필요하다. 에러 메시지 텍스트 변경은 i18n 딕셔너리에 이미 반영됐다.
- 제안: 해당 없음.

### [INFO] 신규 파일의 모듈 수준 문서 부재 여부
- 위치: `has-default-llm-config-context.ts`, `loader-error-messages.ts`, `use-base-model-loader.ts`, `use-default-llm-config-id.ts`
- 상세: 4개 신규 파일 모두 export 대상(함수/인터페이스)에 JSDoc이 있다. 모듈 수준(`@module` 태그 등)의 파일 헤더 주석은 없으나, 이 프로젝트에서 관례적으로 사용하지 않는 것으로 보이므로 누락이 아니다.
- 제안: 해당 없음.

---

## 요약

전체 21개 파일 변경에 걸쳐 문서화 품질은 높다. 신규 파일 4개(`has-default-llm-config-context.ts`, `loader-error-messages.ts`, `use-base-model-loader.ts`, `use-default-llm-config-id.ts`) 모두 공개 API에 JSDoc이 작성됐으며, 핵심 설계 결정(N-구독 → context 단일화, raw server message 차단, stale-closure guard 방식)의 배경이 주석으로 명시되어 있다. 기존 파일에서 삭제된 주석은 공통 기반(`useBaseModelLoader`)으로 정리 이관됐고, 중복이 아닌 집중화 관점에서 적절하다. 이 변경은 외부 인터페이스를 추가하지 않아 README·CHANGELOG 업데이트는 해당되지 않는다. 유일한 소폭 개선 여지는 `loader-error-messages.ts`에서 신규 코드 추가 시 i18n 딕셔너리 동반 수정 의무를 주석으로 안내하는 것과, `use-default-llm-config-id.ts`에서 첫 번째 config fallback의 의도성을 명시하는 정도이나, 이는 모두 INFO 수준이다.

## 위험도

LOW
