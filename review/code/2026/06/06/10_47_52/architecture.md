# Architecture Review

## 발견사항

### [INFO] embedding-input-type.ts 모듈 배치: llm 모듈 내 순수함수 분리 — 올바른 설계
- 위치: `/codebase/backend/src/modules/llm/embedding-input-type.ts`
- 상세: `embedding-input-type.ts` 를 `llm` 모듈 내에 배치하고 `clients/`, `llm.service.ts`, `interfaces/llm-client.interface.ts` 가 이를 단방향으로 참조하는 구조다. 의존 방향이 `knowledge-base → llm → embedding-input-type` 으로 단방향 유지되어 순환 의존성이 없다. 모델 패턴 해석 로직을 순수함수로 격리하고 단위테스트를 게이트화한 것은 OCP/SRP 관점에서 적절하다.
- 제안: 유지.

### [INFO] LLMClient 인터페이스의 inputType 파라미터 위치(3번째 위치 인자)
- 위치: `/codebase/backend/src/modules/llm/interfaces/llm-client.interface.ts:136`
- 상세: `embed(texts, model?, inputType?)` 는 세 번째 선택 인자다. `model?` 이 선택 인자이므로 `model` 을 생략하고 `inputType` 을 지정하려면 `undefined` 를 명시적으로 전달해야 한다. 실제 호출부(agent-memory, rag-search, embedding.service, knowledge-base.service)를 보면 모두 `model` 을 전달하거나 `undefined` 를 명시하고 있어 현재 코드에서는 오용이 없다. 그러나 미래 호출부에서 `embed(texts, 'query')` 처럼 오기입할 경우 TypeScript 컴파일러가 두 번째 인자를 `model` 로 해석해 조용히 잘못된 동작을 유발할 수 있다. 계획 문서(D-P6-3)에 "파라미터 객체화는 EmbedResponse 도입 시까지 보류"라는 근거가 있으므로 현재 설계는 명시적 결정 사항이다.
- 제안: 현재 설계는 plan Rationale 에 명시된 의도적 선택이므로 BLOCK 사유가 아니다. 향후 `EmbedOptions` 파라미터 객체 도입 시 일괄 리팩토링을 권장하며, 그 전까지 호출부 인라인 주석(`// model, inputType`) 또는 `undefined` 명시 관행을 유지한다.

### [WARNING] AnthropicClient.embed 시그니처가 LLMClient 인터페이스와 불일치
- 위치: `/codebase/backend/src/modules/llm/clients/anthropic.client.ts:148`
- 상세: 인터페이스는 `embed(texts: string[], model?: string, inputType?: EmbedInputType): Promise<number[][]>` 를 요구하는데 AnthropicClient 의 구현은 `embed(): Promise<number[][]>` 로 매개변수 선언이 없다. TypeScript 는 구현이 슈퍼타입이기만 하면 허용하므로 컴파일 에러는 발생하지 않는다. 그러나 리스코프 치환 원칙(LSP) 관점에서 인터페이스와 구현 시그니처가 달라 IDE 타입 힌트와 자동완성 혼란, 향후 리플렉션 기반 코드의 오동작 가능성이 있다. 이번 변경에서 다른 client 시그니처를 맞추면서 Anthropic 만 누락된 상태다.
- 제안: `embed(_texts?: string[], _model?: string, _inputType?: EmbedInputType): Promise<number[][]>` 로 인터페이스와 일치하는 시그니처를 명시하고 `Promise.reject(...)` 를 유지한다.

### [INFO] 레이어 책임 분리: agent-memory 가 LlmService.embed 를 직접 호출하는 구조
- 위치: `/codebase/backend/src/modules/agent-memory/agent-memory.service.ts:422`, `:896`
- 상세: `EmbeddingService` 를 거치지 않고 `LlmService.embed` 를 직접 호출한다. consistency-check W-2 에서 이미 지적된 내용이며, 현재 변경에서는 `inputType` 만 추가 전달할 뿐 중복 구현 구조는 그대로다. spec `17-agent-memory.md §3` 에 "임베딩 생성 로직 중복 구현 금지"가 명시되어 있으나, `EmbeddingService` 는 Knowledge Base 전용 청킹/배치 파이프라인이므로 AgentMemory 가 이를 직접 사용하기 어렵다는 실용적 이유도 있다. 현재 변경의 `inputType` 배선 자체는 올바르다.
- 제안: 이 이슈는 본 변경 범위 외의 구조적 과제다. `LlmService.embed` 를 공유 레이어로 보는 현재 구조가 실제 사용 패턴에 더 적합하다면, spec `§3` 의 표현을 "EmbeddingService 의 청킹/배치 파이프라인을 중복 구현하지 않는다"로 구체화할 것을 권장한다.

### [INFO] 프론트엔드 embedding-model-recommendation.ts: 단일 책임, 모듈 경계 명확
- 위치: `/codebase/frontend/src/components/knowledge-base/embedding-model-recommendation.ts`
- 상세: 한국어 추천 모델 판단 로직을 별도 순수함수 모듈로 분리하고 `embedding-model-combobox.tsx` 에서 임포트하는 구조다. SRP, 낮은 결합도, 높은 응집도 관점에서 적절하다. `isKoreanRecommendedEmbeddingModel` 는 프레젠테이션 레이어가 아닌 유틸리티 레이어에 위치하므로 레이어 책임 분리도 명확하다.
- 제안: 유지.

### [INFO] 백엔드/프론트엔드 간 모델 패턴 정의 중복
- 위치: 백엔드 `/codebase/backend/src/modules/llm/embedding-input-type.ts`, 프론트엔드 `/codebase/frontend/src/components/knowledge-base/embedding-model-recommendation.ts`
- 상세: 비대칭 입력 처리 대상 모델(e5, Gemini 등)을 파악하는 패턴과 한국어 추천 모델 패턴이 각각 백엔드·프론트엔드에 독립적으로 정의되어 있다. 두 목록의 목적이 서로 다르므로(입력 전처리 vs UI 힌트) 의도적 분리다. 그러나 중장기적으로 모델 카탈로그가 확장될 경우 두 목록을 동기화하는 비용이 발생할 수 있다.
- 제안: 현재 범위에서는 허용 가능한 수준이며 BLOCK 사유가 아니다. 모델 카탈로그가 커지면 shared 패키지(`packages/`) 로 이동을 검토한다.

### [INFO] EmbeddingInputStrategy 타입이 외부에 불필요하게 export 됨
- 위치: `/codebase/backend/src/modules/llm/embedding-input-type.ts:27` (`export type EmbeddingInputStrategy`)
- 상세: `EmbeddingInputStrategy` 는 `resolveEmbeddingInputStrategy` 내부 구현 세부사항이며, 외부 호출부에서는 `EmbedInputType` 과 `applyEmbeddingInputPrefix` / `resolveGeminiTaskType` 만 사용한다. 불필요한 타입 노출은 향후 전략 타입 변경 시 외부 호환성 제약이 될 수 있다. 단, 현재 테스트에서 직접 검증(`resolveEmbeddingInputStrategy` 반환값을 `'e5-prefix'` 리터럴로 비교)하므로 export 가 필요한 측면도 있다.
- 제안: 테스트 목적의 export 는 허용하되, 외부 서비스 코드에서 이 타입을 직접 참조하지 않도록 관행을 유지한다.

## 요약

이번 변경은 임베딩 비대칭 입력(query vs document)을 `llm` 모듈 내 `embedding-input-type.ts` 순수함수 모듈로 집중 관리하고, `LLMClient` 인터페이스를 확장하여 모든 provider 구현체와 서비스 호출부에 일관되게 배선하는 작업이다. 의존 방향이 단방향으로 유지되고 순환 참조가 없으며, 프론트엔드의 한국어 추천 배지 로직도 별도 순수함수 모듈로 분리하여 SRP를 준수한다. 전반적으로 SOLID 원칙과 레이어 책임 분리가 잘 지켜졌으나, AnthropicClient 의 `embed` 시그니처가 이번 인터페이스 확장에서 누락되어 LSP 경미 위반이 발생한 점이 개선 대상이다.

## 위험도

LOW
