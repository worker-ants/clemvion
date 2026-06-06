# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [WARNING] LLMClient.embed 인터페이스 시그니처 변경 — 미구현 구현체의 암묵적 호환성 가정
- 위치: `codebase/backend/src/modules/llm/interfaces/llm-client.interface.ts` — `embed` 시그니처에 `inputType?: EmbedInputType` 추가
- 상세: `LLMClient` 인터페이스의 `embed` 메서드 시그니처가 `(texts, model?)` 에서 `(texts, model?, inputType?)` 로 변경되었다. 변경된 구현체는 `openai.client.ts`, `google.client.ts` 두 곳이나, anthropic/azure/local client 등이 이 인터페이스를 구현한다면 TypeScript 는 선택적 파라미터(`?`)이므로 컴파일 에러 없이 통과한다. anthropic client 가 `inputType` 을 받아도 처리 로직이 없는 채로 throw 를 유지하는 것이 의도된 동작이지만, 향후 호출자가 anthropic 경로에서 `inputType='query'` 로 호출 시 throw 가 발생하는 것이 inputType 처리 실패인지 anthropic 원래 동작인지 구별이 어려울 수 있다.
- 제안: `anthropic.client.ts` 의 `embed` 메서드 주석 또는 에러 메시지에 "inputType 무관하게 항상 throw" 를 명시한다.

### [WARNING] LlmService.embed 파라미터 순서 — opts 와 inputType 의 위치 관계
- 위치: `codebase/backend/src/modules/llm/llm.service.ts` — `embed(config, texts, model?, opts?, inputType: EmbedInputType = 'document')`
- 상세: `opts` 가 선택적이면서 `inputType` 이 그 뒤에 오는 구조다. 현재 모든 호출부(`embedding.service.ts`, `agent-memory.service.ts`, `rag-search.service.ts`, `knowledge-base.service.ts`)가 `opts` 자리에 명시적으로 `undefined` 또는 실제 값을 전달하고 있어 현재는 올바르다. 그러나 새 호출자가 `opts` 를 생략(undefined 미전달)하고 `inputType` 만 전달하려 하면 TypeScript 가 허용하지 않아 실수를 즉시 잡아주지 못한다. `opts` 를 생략하려면 반드시 `undefined` 를 명시해야 하는 인체공학적 문제가 있다.
- 제안: 장기적으로 `{ model?, opts?, inputType? }` 파라미터 객체화를 고려하거나, JSDoc 에 호출 패턴을 명시한다.

### [INFO] Gemini embed — 기존 색인 데이터와 taskType 비대칭 (데이터 상태 부작용)
- 위치: `codebase/backend/src/modules/llm/clients/google.client.ts` — `config: { taskType: resolveGeminiTaskType(inputType) }` 신규 추가
- 상세: 변경 전에 색인된 Google Gemini 계열 KB/AgentMemory document 벡터는 taskType 없이 임베딩된 상태다. 변경 후에는 document 는 `RETRIEVAL_DOCUMENT`, recall 쿼리는 `RETRIEVAL_QUERY` taskType 을 사용하므로 벡터 공간이 달라진다. 배포 직후 기존 색인에 대한 검색 품질이 조용히 저하된다. 이는 의도된 trade-off(D-P6-4)이나, 코드 배포만으로 자동 발생하는 데이터 불일치다.
- 제안: Gemini 계열 모델 사용 KB 를 배포 직후 재임베딩 트리거하거나 운영팀에 안내한다. 배포 런북에 이 사항을 기술한다.

### [INFO] e5 계열 OpenAI-compat 호출 — 기존 색인 데이터와 prefix 비대칭 (데이터 상태 부작용)
- 위치: `codebase/backend/src/modules/llm/clients/openai.client.ts` — `applyEmbeddingInputPrefix(texts, model, inputType)` 신규 적용
- 상세: Gemini 항목과 동일한 구조의 문제. self-hosted e5 계열 모델(`multilingual-e5-large` 등)을 OpenAI-compat 엔드포인트로 사용하던 기존 KB 는 배포 후 recall 에서 `query: ` prefix 가 붙은 벡터를 사용하지만, 기존 색인된 document 는 prefix 없이 임베딩된 상태다.
- 제안: e5 계열 모델 사용 KB 재임베딩 절차를 배포 절차에 포함한다.

### [INFO] KOREAN_RECOMMENDED_PATTERNS RegExp 배열 — 모듈 전역 상수
- 위치: `codebase/frontend/src/components/knowledge-base/embedding-model-recommendation.ts` — `const KOREAN_RECOMMENDED_PATTERNS: RegExp[] = [...]`
- 상세: `g` 플래그가 없는 RegExp 들이므로 `lastIndex` 상태 문제는 없다. 모듈 로드 시 한 번 생성되는 불변 상수이며, 의도치 않은 전역 상태 변경은 없다.
- 제안: 없음. 현재 구현이 안전하다.

### [INFO] renderOption 콜백 — i18n 키 `koreanRecommendedBadge` 미구현 로케일 시 렌더링
- 위치: `codebase/frontend/src/components/knowledge-base/embedding-model-combobox.tsx` — `t("knowledgeBases.koreanRecommendedBadge")`
- 상세: `en/knowledgeBases.ts` 와 `ko/knowledgeBases.ts` 양쪽에 키가 추가되었다. 현재 운영 로케일이 2개인 경우 문제 없으나, 신규 로케일 추가 시 이 키가 누락되면 i18n 라이브러리 기본 동작(키 이름 raw 출력)이 UI 에 노출될 수 있다.
- 제안: Type-safe i18n 타입 체크 또는 누락 경고 메커니즘이 이미 적용되어 있는지 확인한다.

---

## 요약

이번 변경의 핵심 부작용 위험은 코드 로직 자체보다 **데이터 레이어의 전환 시점(migration gap)** 에 있다. `LLMClient.embed` 인터페이스 시그니처 확장은 optional 파라미터로 하위호환을 유지하며, 기본값 `'document'` 가 기존 적재 동작과 동일해 코드 레벨 부작용은 최소화되었다. 전역 변수 도입 없음, 파일시스템 부작용 없음, 의도치 않은 네트워크 호출 없음. 다만 Google Gemini taskType 신규 적용과 e5 prefix 신규 적용은 배포 즉시 기존 색인 벡터와 recall 쿼리 벡터 공간이 달라지는 데이터 불일치를 자동으로 야기한다. 이는 코드 설계상 의도된 trade-off(D-P6-4)이나 운영 영향이 크므로 배포 절차에 재임베딩 지침이 반드시 포함되어야 한다. `LlmService.embed` 의 `opts` 뒤 `inputType` 파라미터 순서는 현재 모든 호출부가 올바르게 작성되어 있으나, 향후 호출자 실수 가능성을 내포하는 인체공학적 문제가 있다.

---

## 위험도

MEDIUM
