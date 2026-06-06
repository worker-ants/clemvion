# 테스트(Testing) 리뷰 결과

## 발견사항

### [INFO] `LlmService.embed` 의 `query` inputType 경로에 대한 단위 테스트 부재
- 위치: `/codebase/backend/src/modules/llm/llm.service.spec.ts` — `describe('embed')`
- 상세: `llm.service.spec.ts` 의 embed 테스트는 inputType 생략(document 기본값) 시나리오만 커버한다. `inputType: 'query'` 로 명시 호출 시 각 배치에 `'query'` 가 그대로 전달되는 경로가 테스트되지 않는다.
- 제안: `it('inputType query 가 각 배치에 전달된다')` 케이스를 추가해 `toHaveBeenNthCalledWith(1, ..., 'query')` 를 검증한다.

### [INFO] `LlmService.embed` — timeout 옵션과 `inputType` 조합 테스트 없음
- 위치: `/codebase/backend/src/modules/llm/llm.service.spec.ts`
- 상세: `opts.timeoutMs > 0` 분기가 `withTimeout(() => client.embed(batch, model, inputType), ...)` 로 변경됐다. 기존 테스트는 timeout 옵션 케이스가 없어 이 분기의 inputType 전달이 검증되지 않는다.
- 제안: timeout 있는 embed 호출 케이스를 추가하고 `client.embed` 가 `inputType` 을 수신하는지 검증한다.

### [WARNING] `google.client.spec.ts` — inputType 생략 시 기본값 `'document'` 동작을 독립 케이스로 검증하지 않음
- 위치: `/codebase/backend/src/modules/llm/clients/google.client.spec.ts`, `describe('GoogleClient.embed')`
- 상세: diff 는 기존 2개 케이스의 기대값에 `config: { taskType: 'RETRIEVAL_DOCUMENT' }` 를 추가하는 방식으로 처리한다. "inputType 생략 시 기본값 document → RETRIEVAL_DOCUMENT" 를 명시적으로 검증하는 독립 케이스가 없어, 기본값 로직이 제거되거나 변경됐을 때 회귀를 잡기 어렵다.
- 제안: `it('inputType 생략 시 RETRIEVAL_DOCUMENT 가 config 에 포함된다', ...)` 를 독립 케이스로 추가한다.

### [WARNING] `AnthropicClient` — embed 시그니처 확장 후 throw 동작 테스트 없음
- 위치: `/codebase/backend/src/modules/llm/clients/anthropic.client.spec.ts`
- 상세: `LLMClient.embed` 인터페이스가 `inputType` 파라미터를 추가했다. Plan 에 따르면 `anthropic.client` 는 "시그니처만 맞춤(throw 유지)"이다. 그러나 `anthropic.client.spec.ts` 에는 embed 관련 테스트가 전혀 없다. 시그니처 확장 후 throw 동작이 보증되지 않는다.
- 제안: `it('embed 는 지원하지 않아 throw 한다')` 케이스를 추가해 에러 throw 경로를 검증한다.

### [INFO] `local.client.ts` (e5 self-host 케이스) 전용 embed 테스트 없음
- 위치: `codebase/backend/src/modules/llm/clients/local.client.ts`
- 상세: `LocalClient` 는 `OpenAIClient` 를 상속하므로 `applyEmbeddingInputPrefix` 로직을 자동 상속한다. e5 모델을 LocalClient 로 서빙하는 케이스(가장 실제 적용 케이스)가 단독으로 테스트되지 않는다. `azure-openai.client.ts` 도 동일하나, azure 는 대칭 모델만 사용하므로 우선순위가 낮다.
- 제안: `openai.client.spec.ts` 내에 `LocalClient` 로 e5 prefix 가 적용되는 케이스를 추가하거나 `local.client.spec.ts` 를 신규 생성한다.

### [INFO] `applyEmbeddingInputPrefix` — 이미 prefix 가 붙은 텍스트 재적용 시 이중 prefix 동작 미문서화
- 위치: `/codebase/backend/src/modules/llm/embedding-input-type.spec.ts`
- 상세: 현재 구현은 멱등성이 없다. e5 모델에 `'passage: 환불...'` 을 document 타입으로 재호출하면 `'passage: passage: 환불...'` 이 된다. 이 동작이 의도적인 계약인지, 호출자가 방지해야 하는지 테스트로 문서화되지 않았다.
- 제안: 이중 prefix 동작을 명시하는 테스트(정책 문서화 목적)를 추가하거나 구현에서 중복 방지 로직을 추가하고 해당 테스트를 작성한다.

### [INFO] `rag-search.service.spec.ts` — 두 번째 query embed 경로(line ~443) 테스트 누락
- 위치: `/codebase/backend/src/modules/knowledge-base/search/rag-search.service.spec.ts`
- 상세: `rag-search.service.ts` 에는 두 곳의 embed 호출이 있다(line 373, line 443). spec 파일은 line 373 경로만 커버한다. line 443 의 보조 query embed 에 `undefined, 'query'` 가 추가됐으나 이를 검증하는 테스트가 없다.
- 제안: 두 번째 query embed 호출 경로를 커버하는 테스트를 `rag-search.service.spec.ts` 에 추가한다.

### [INFO] `EmbeddingModelCombobox.renderOption` — 분기 로직 테스트 없음
- 위치: `/codebase/frontend/src/components/knowledge-base/embedding-model-combobox.tsx`
- 상세: `renderOption` 의 `m.name && m.name !== m.id` 조건 분기(`${m.name} (${m.id})` vs `m.id`)와 `isKoreanRecommendedEmbeddingModel` + i18n `koreanRecommendedBadge` 결합 로직이 테스트 없이 컴포넌트에만 존재한다. `embedding-model-recommendation.test.ts` 는 순수함수만 커버하고 통합 렌더링 결과를 검증하지 않는다.
- 제안: `renderOption` 로직을 별도 순수함수로 추출해 단위 테스트하거나, `EmbeddingModelCombobox` 렌더링 테스트에 추천 모델/비추천 모델 케이스를 추가한다.

## 요약

전반적으로 이번 변경은 테스트 우선 품질이 높다. 핵심 비대칭 임베딩 로직인 `embedding-input-type.ts` 에 대한 독립 유닛 테스트가 신규 생성됐고, OpenAI/Google 클라이언트 테스트도 `inputType` 시나리오를 추가했으며, 호출부 6곳의 기존 테스트가 `undefined, 'document'/'query'` 인자를 반영해 갱신됐다. 다만 `AnthropicClient.embed` throw 동작 검증 누락과 Google 기본값 독립 케이스 미존재(WARNING 2건)가 회귀 보증을 약화시킨다. `LlmService.embed` 의 `query` 경로 및 timeout-inputType 조합 미테스트, `LocalClient` e5 prefix 실사용 케이스 미검증, `rag-search.service.ts` 두 번째 query embed 경로 누락, `renderOption` 분기 로직 미테스트는 커버리지 보강이 필요한 INFO 수준이다. CRITICAL 또는 로직 오류 수준의 문제는 없다.

## 위험도
LOW
