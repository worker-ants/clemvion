# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### [WARNING] `LlmService.embed` 시그니처의 파라미터 순서 불일치
- **위치**: `codebase/backend/src/modules/llm/llm.service.ts` (라인 195–201)
- **상세**: `LlmService.embed(config, texts, model?, opts?, inputType?)` 에서 `inputType` 이 `opts` 뒤에 위치한다. 반면 `LLMClient.embed(texts, model?, inputType?)` 와 테스트 코드에서는 `inputType` 이 `model` 직후에 온다. 서비스 레이어 시그니처에서만 `opts` 가 `inputType` 사이에 끼어들어 있어 호출부가 `undefined` 를 명시적으로 삽입해야 한다. 실제로 `embedding.service.ts`, `agent-memory.service.ts`, `knowledge-base.service.ts`, `rag-search.service.ts` 전체에서 `undefined` 를 4번째 인자로 넘겨 `inputType` 을 5번째에 전달하는 패턴이 반복된다. 이는 "왜 `undefined` 가 필요한가"를 독자가 매번 시그니처까지 거슬러 가서 확인해야 하는 부담이다.
- **제안**: `opts` 를 마지막으로 이동하거나(`embed(config, texts, model?, inputType?, opts?)`), 또는 `opts` 와 `inputType` 을 단일 옵션 객체로 병합(`embed(config, texts, model?, options?: { inputType?; timeoutMs?; disableInnerRetry? })`)하면 `undefined` 삽입 없이 호출이 가능하고 미래 파라미터 추가에도 유연하다.

---

### [WARNING] 호출부 전체에 `undefined` 위치 인자가 노출되어 가독성 저하
- **위치**: `agent-memory.service.ts` (라인 ~422, ~897), `knowledge-base.service.ts` (라인 ~151), `rag-search.service.ts` (라인 ~210, ~219), `embedding.service.ts` (라인 ~100)
- **상세**: 위 WARNING 의 직접적 결과로, 리뷰 대상 파일 5곳 모두 다음 패턴이 반복된다.
  ```ts
  await this.llmService.embed(llmConfig, [...], model, undefined, 'document');
  await this.llmService.embed(llmConfig, [...], model, undefined, 'query');
  ```
  `undefined` 의 의미가 코드 맥락에서 전혀 자명하지 않다. 처음 보는 독자는 `undefined` 가 무엇을 생략하는지 즉시 알 수 없다.
- **제안**: 시그니처 개선이 이루어지기 전이라면 호출부에 인라인 주석(`/* opts */`)이라도 추가하는 것이 최소 완화책이다.

---

### [INFO] `embedding-input-type.ts` 모듈 파일 헤더 주석에 이모지(⚠️) 포함
- **위치**: `codebase/backend/src/modules/llm/embedding-input-type.ts` (라인 26)
- **상세**: 파일 헤더 주석에 `⚠️` 이모지가 포함되어 있다. 일부 터미널·로그 도구에서 렌더링 문제가 발생할 수 있고, 코드베이스 전반 검색 시 노이즈가 된다.
- **제안**: 이모지를 제거하고 `NOTE:` 또는 `IMPORTANT:` 같은 텍스트 마커로 대체한다.

---

### [INFO] `resolveGeminiTaskType` 함수가 `'document'` 이외 값을 묵시적 else 로 처리
- **위치**: `codebase/backend/src/modules/llm/embedding-input-type.ts` (라인 `return inputType === 'query' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT'`)
- **상세**: `EmbedInputType` 이 현재 `'query' | 'document'` 리터럴 유니온이라 TypeScript 수준에서 안전하지만, 코드만 읽으면 "query 가 아닌 모든 것은 DOCUMENT" 로 읽힌다. `EmbedInputType` 에 값이 추가될 경우 묵시적 기본값이 되어 런타임 버그로 연결될 수 있다.
- **제안**: 향후 확장 가능성을 고려한다면 `switch` 구문 또는 `Record<EmbedInputType, ...>` 매핑 테이블로 변경하면 exhaustive-check 를 TypeScript 레벨에서 강제할 수 있다.

---

### [INFO] `embedding-model-recommendation.ts` 와 `embedding-input-type.ts` 가 유사한 모델 정규식 패턴을 중복 관리
- **위치**: `codebase/frontend/src/components/knowledge-base/embedding-model-recommendation.ts` (`KOREAN_RECOMMENDED_PATTERNS`) vs `codebase/backend/src/modules/llm/embedding-input-type.ts` (`E5_PREFIX_PATTERN`)
- **상세**: 두 파일 모두 e5 계열 / bge-m3 등 동일한 임베딩 모델 군에 대한 정규식을 각자 관리한다. 현재는 목적이 달라(UX 배지 vs 입력 처리 전략) 분리가 합리적이지만, 향후 모델 추가 시 두 곳을 동시에 수정해야 하는 유지보수 부담이 생긴다.
- **제안**: 필수 수정은 아니지만, 각 파일의 헤더 주석에 "관련 목록: embedding-input-type.ts / embedding-model-recommendation.ts 를 함께 갱신" 을 상호 참조로 추가한다.

---

## 요약

이번 변경은 임베딩 비대칭 입력 처리(`EmbedInputType`) 추가와 한국어 추천 배지 UI 보강이라는 두 축으로 구성되어 있다. 핵심 로직인 `embedding-input-type.ts` 는 순수함수 분리, 경계 정규식, 상세한 모듈 헤더 주석으로 가독성과 테스트 가능성이 우수하다. 다만 `LlmService.embed` 의 파라미터 순서에서 `opts` 와 `inputType` 이 뒤바뀐 탓에 5개 호출부 전체에 의미 없는 `undefined` 가 삽입되어 있는 점이 가장 큰 유지보수성 저하 요인이다. 이 문제를 해소하면 코드베이스 전반의 가독성이 유의미하게 개선될 것이다. 나머지 항목들은 INFO 수준으로 기능적 정확성에는 영향이 없다.

## 위험도

LOW
