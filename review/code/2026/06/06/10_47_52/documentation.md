# 문서화(Documentation) 리뷰 결과

## 발견사항

### [INFO] `LlmService.embed` 파라미터 순서가 spec 기술과 불일치
- **위치**: `/codebase/backend/src/modules/llm/llm.service.ts` 195~200행 / `spec/5-system/8-embedding-pipeline.md §5.4`
- **상세**: `spec/5-system/8-embedding-pipeline.md §5.4` 본문은 `LlmService.embed(texts, model, opts, inputType)` 라고 기술한다. 그러나 실제 구현은 `embed(config, texts, model?, opts?, inputType)` 순서이고, 더 중요하게는 `inputType` 이 `opts` **뒤** 4번째 위치 인자다. spec 의 "texts, model, opts, inputType" 순서 기술이 실제 공개 시그니처와 다르다. 독자가 해당 spec 구절을 보고 호출 코드를 작성하면 인자 순서 오류가 발생할 수 있다.
- **제안**: `spec/5-system/8-embedding-pipeline.md §5.4` 의 `LlmService.embed(...)` 인자 순서 기술을 `embed(config, texts, model?, opts?, inputType)` 실제 시그니처로 정정하거나, `LLMClient.embed(texts, model?, inputType?)` 와 구분하도록 명시 보완.

---

### [INFO] `embedding-input-type.ts` 모듈 수준 주석의 SoT 참조가 §5 전체를 가리킴
- **위치**: `/codebase/backend/src/modules/llm/embedding-input-type.ts` 최상단 블록 주석 마지막 줄
- **상세**: 파일 최상단 주석의 `SoT: spec/5-system/8-embedding-pipeline.md §5·§Rationale.` 가 이번 변경으로 신설된 `§5.4` 가 아닌 `§5` 전체를 가리킨다. 탐색 비용이 증가하지는 않으나, `§5.4`로 구체화하면 유지보수 시 해당 절을 바로 찾을 수 있다.
- **제안**: `SoT: spec/5-system/8-embedding-pipeline.md §5.4·§Rationale.` 로 세분화.

---

### [INFO] `LlmService.embed` JSDoc 독스트링 누락
- **위치**: `/codebase/backend/src/modules/llm/llm.service.ts` `embed` 메서드 (195행~)
- **상세**: `LLMClient.embed` 인터페이스에는 `inputType` 설명을 포함한 JSDoc 이 추가됐으나, 서비스 계층 `LlmService.embed` 공개 메서드에는 독스트링이 없다. 이 메서드는 서비스 계층의 공개 API 진입점으로, `inputType` 기본값·`opts` 파라미터 전달 규약(timeoutMs / disableInnerRetry 조합)을 이해하려면 구현 코드를 직접 읽어야 한다.
- **제안**: `embed` 메서드에 JSDoc 추가 — `@param inputType` 기본값 `'document'`, 검색 query 경로에서만 `'query'` 를 명시한다는 내용 포함.

---

### [INFO] `applyEmbeddingInputPrefix` 등 순수함수에 JSDoc 파라미터 설명 없음
- **위치**: `/codebase/backend/src/modules/llm/embedding-input-type.ts` `applyEmbeddingInputPrefix`, `resolveEmbeddingInputStrategy`, `resolveGeminiTaskType`
- **상세**: 각 함수 앞에 한 줄 인라인 주석이 있지만 JSDoc 형식이 아니라 파라미터별 설명이 없다. `applyEmbeddingInputPrefix` 의 `model: string | undefined` 허용 이유(undefined 시 no-op 보장), `inputType` 에 기본값이 없는 이유(호출부가 명시 필수)가 명시돼 있지 않아 함수 시그니처만 보고는 의도 파악이 어렵다.
- **제안**: 세 함수에 최소 `@param` / `@returns` JSDoc 추가. 특히 `applyEmbeddingInputPrefix` 의 `model?: undefined` 허용 이유와 no-op 보장 명시.

---

### [INFO] `embedding-model-recommendation.ts` 패턴 배열 참조처가 소멸 예정인 `plan/` 경로
- **위치**: `/codebase/frontend/src/components/knowledge-base/embedding-model-recommendation.ts` 파일 상단 주석
- **상세**: `KOREAN_RECOMMENDED_PATTERNS` 배열의 근거로 `plan/in-progress/rag-quality-improvement.md §D5` 를 인용하고 있다. `plan/in-progress/` 파일은 작업 완료 후 `plan/complete/` 로 이동하므로 코드 주석이 장기적으로 끊기게 된다. 패턴 목록을 새 모델 추가 시 어떻게 확장해야 하는지(결정 기준·화이트리스트 업데이트 절차)에 대한 안내도 없다.
- **제안**: 참조처를 `spec/2-navigation/5-knowledge-base.md §2.2` (이미 동작이 명시됨)로 교체. "새 모델 추가 시 패턴 추가 방법" 한 줄 언급 추가.

---

### [INFO] `EmbeddingModelCombobox` 컴포넌트 주석에 한국어 추천 배지 동작 미기술
- **위치**: `/codebase/frontend/src/components/knowledge-base/embedding-model-combobox.tsx` 컴포넌트 레벨 주석 (`EmbeddingModelComboboxProps` 인터페이스 위 설명 주석)
- **상세**: 컴포넌트 상단 주석(137행 `// 지정된 LLMConfig...`)은 "자유 입력 fallback 은 제공하지 않는다" 는 제약만 설명하고, 이번 변경으로 추가된 한국어 추천 배지 표시 동작(`renderOption`)은 기술되지 않았다. `renderOption` prop 이 `EmbeddingModelComboboxProps` 에 노출되지 않아 컴포넌트 외부에서 동작을 추론하기 어렵다.
- **제안**: 컴포넌트 상단 주석에 "패턴 매칭 시 option 라벨에 '한국어 추천' 배지 표시 — 비강제, select-only 원칙 유지" 한 줄 추가.

---

### [INFO] 코드 주석 내 재임베딩 경고가 spec 과 이중 기술되어 장기 diverge 위험
- **위치**: `/codebase/backend/src/modules/llm/embedding-input-type.ts` `⚠️ 정합성` 주석 / `spec/5-system/8-embedding-pipeline.md §5.4` 정합성 단락
- **상세**: 코드 파일 주석의 `⚠️ 정합성` 단락과 spec §5.4 의 `- **정합성**:` 단락이 실질적으로 같은 내용을 서술한다. spec 이 SoT 임이 주석에 명시돼 있으므로 코드 주석이 중복 서술되면 향후 spec 만 갱신하고 코드 주석을 방치할 경우 독자 혼동이 발생한다. 현재 수준은 실용적이나 장기 유지보수 측면의 위험이 있다.
- **제안**: 코드 주석의 `⚠️ 정합성` 단락을 "상세: `spec/5-system/8-embedding-pipeline.md §5.4` 참조" 한 줄로 압축하고 긴 재서술 제거. 지금 수준도 허용 범위이나 단일 진실 원칙 측면에서 개선 여지.

---

## 요약

이번 변경은 비대칭 임베딩(asymmetric retrieval)을 위한 `inputType` 파라미터 배선과 한국어 추천 배지 UX 두 축으로 구성된다. 문서화 품질은 전반적으로 양호하다. `embedding-input-type.ts` 신규 모듈은 파일 상단 블록 주석에 배경·설계 결정·주의사항이 상세히 기술되어 있고, `LLMClient.embed` 인터페이스에 JSDoc 이 추가되었으며, spec 4종(`7-llm-client.md §3.3`, `8-embedding-pipeline.md §5.4`, `17-agent-memory.md §4`, `5-knowledge-base.md §2.2`)이 함께 갱신되어 spec-impl 정합성이 유지된다. 호출 지점별 인라인 주석도 query/document 구분 이유를 명시한다. 다만 `LlmService.embed` 서비스 계층 메서드에 JSDoc 독스트링이 없는 점, `embedding-input-type.ts` 세 순수함수에 파라미터 설명이 없는 점, spec §5.4 내 `LlmService.embed` 인자 순서 기술이 실제 시그니처와 미미하게 어긋나는 점, 추천 패턴 배열의 장기 참조처가 소멸 예정인 `plan/` 인 점이 낮은 수준의 개선 여지로 남는다. CRITICAL 또는 WARNING 수준 발견사항은 없다.

## 위험도

LOW
