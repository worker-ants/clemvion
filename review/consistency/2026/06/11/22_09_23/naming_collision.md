# 신규 식별자 충돌 검토 결과

대상 문서: `plan/in-progress/spec-update-embedding-testconnection.md`

---

## 발견사항

### 1. **[CRITICAL]** "probe 는 read-only" 정책과 "dimension 자동 저장" 간 의미 충돌

- **target 신규 식별자**: `spec/2-navigation/6-config.md §B.3` 에 도입하는 "embedding 연결 테스트 성공 시 감지된 `dimension` 을 `PATCH /api/model-configs/:id { dimension }` 로 즉시 자동 저장한다"
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/.claude/worktrees/fix-embedding-test-dimension-a3d42a/spec/2-navigation/5-knowledge-base.md` L64: "probe 는 read-only 검증 — 측정한 차원을 `embedding_dimension` 에 미리 저장하지 않는다"
  - `/Volumes/project/private/clemvion/.claude/worktrees/fix-embedding-test-dimension-a3d42a/spec/5-system/9-rag-search.md` L353, L406: "`embedding_dimension`은 현재 저장된 청크 벡터의 실제 차원. … probe(임베딩 테스트) 차원을 미리 저장하지 않는다."
- **상세**: 기존 spec 의 "probe read-only" 정책은 `KnowledgeBase.embedding_dimension`(KB의 파생 캐시)에 대한 것이고, target이 자동 저장하는 대상은 `ModelConfig.dimension`(SoT)이다 — 서로 다른 엔티티 필드다. 그러나 spec 독자가 두 문서를 함께 읽으면 "probe 결과는 저장하지 않는다"는 기존 원칙과 "testConnection probe로 ModelConfig.dimension을 자동 저장한다"는 신규 기술이 직접 충돌처럼 보인다. `5-knowledge-base.md` L64의 probe read-only 근거(§RAG검색 §5 Rationale)는 `embedding_dimension`(KB) 보호를 위한 것이지 `ModelConfig.dimension` 저장을 금지하는 것이 아님을 명확히 하지 않으면 spec 독자에게 혼선이 발생한다.
- **제안**: target의 §B.3 변경안에 "여기서 자동 저장하는 대상은 `ModelConfig.dimension`(SoT)이며, `KnowledgeBase.embedding_dimension`(파생 캐시)은 임베딩 적재 경로가 race-free 하게 채운다 — KB spec §2.2의 probe read-only 정책과 상보 관계"라는 명시적 구분 문장을 추가한다. 또는 `spec/5-system/9-rag-search.md` Rationale의 "probe 차원을 미리 저장하지 않는다" 문장을 "KB의 `embedding_dimension`에" 라는 수식어를 추가해 범위를 한정한다.

---

### 2. **[WARNING]** `LLMClient.testConnection()` 반환 타입 변경 — 인터페이스 계약과 충돌

- **target 신규 식별자**: `spec/5-system/7-llm-client.md §3.1` LLMClient 인터페이스의 `testConnection`에 새로운 서비스-레이어 반환 형식 `{ success: true, dimension?: number }` 도입
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/.claude/worktrees/fix-embedding-test-dimension-a3d42a/spec/5-system/7-llm-client.md` L87: `testConnection(): Promise<boolean>`
  - `/Volumes/project/private/clemvion/.claude/worktrees/fix-embedding-test-dimension-a3d42a/spec/5-system/7-llm-client.md` L362(§7.1): `StubLlmClient` stub 응답 계약은 `testConnection`에 대해 명시적 반환 계약을 두지 않으나, `Promise<boolean>` 인터페이스를 암묵적으로 따른다.
  - `/Volumes/project/private/clemvion/.claude/worktrees/fix-embedding-test-dimension-a3d42a/spec/data-flow/7-llm-usage.md` L52: `POST /api/model-configs/:id/test — LlmService.testConnection`
- **상세**: target의 "After" 명세는 `LlmService.testConnection(configId, workspaceId)` 서비스 메서드의 반환 형식을 `{ success: true, dimension?: number }`로 정의한다. 그런데 현재 `spec/5-system/7-llm-client.md §3.1`의 `LLMClient` 인터페이스(클라이언트 레이어)는 `testConnection(): Promise<boolean>`로 선언돼 있다. 두 레이어(클라이언트 인터페이스 vs 서비스 메서드)의 반환 타입이 다름을 spec에서 명확히 구분하지 않으면 독자가 인터페이스 변경이 필요한 것으로 오해할 수 있다.
- **제안**: target spec 변경안이 대상으로 삼는 계층을 명확히 구분해야 한다. `LLMClient.testConnection()`(클라이언트 인터페이스, L87)은 `Promise<boolean>` 유지 — embedding 차원 감지는 `LlmService` 서비스 레이어에서 `embed()` 호출 결과로 차원을 추출하는 것이므로 클라이언트 인터페이스 변경이 불필요함을 명시한다. 서비스 레이어 `LlmService.testConnection(configId, workspaceId)`의 반환 타입이 `{ success: boolean, dimension?: number }`임을 `§8.3 서비스 레이어` 또는 신설 섹션에 분리 기술한다.

---

### 3. **[WARNING]** `LLMClient §3.1` 내부 anchor 불일치 — "§B.5 / LLM Client §3.1" 참조

- **target 신규 식별자**: `spec/2-navigation/6-config.md §B.3` 변경안에서 "kind 에 따라 다른 probe 전략을 쓴다(§B.5 / LLM Client §3.1)"라는 cross-reference 도입
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/fix-embedding-test-dimension-a3d42a/spec/5-system/7-llm-client.md` §3.1은 `LLMClient` 인터페이스 선언 섹션이며, 현재 `testConnection`은 단 한 줄(`testConnection(): Promise<boolean>`) 과 간단한 주석만 포함한다. probe 전략에 대한 상세 기술이 없다.
- **상세**: target이 "LLM Client §3.1을 참조하라"고 크로스 레퍼런스를 추가하지만, 현재 §3.1에는 testConnection의 kind별 probe 전략이 없다. target의 변경안 1번이 `spec/5-system/7-llm-client.md`에 새로운 testConnection 명세를 추가하는데, 그 명세가 §3.1 기존 testConnection 선언 근처에 inline으로 들어갈지 별도 섹션(예: §3.1.1 또는 §5.x)으로 들어갈지 명시되어 있지 않다. §B.3의 "(§B.5 / LLM Client §3.1)" 참조가 현재 존재하지 않는 상세 내용을 가리키게 된다.
- **제안**: 변경안 1번(llm-client.md 수정)에서 추가될 testConnection 명세의 앵커(섹션 번호)를 먼저 확정하고, §B.3의 크로스 레퍼런스를 그 앵커로 일치시킨다. 예: 서비스 계층 설명은 §8.3에 추가하고 §B.3는 "§B.5 / LLM Client §8.3"으로 수정.

---

### 4. **[INFO]** `rerank` probe 표기 불일치 — "chat, rerank" vs 기존 "연결 테스트 미제공"

- **target 신규 식별자**: target 변경안 1번의 kind 표에서 `chat`, `rerank` 양쪽 모두 `client.testConnection()` 호출 → `{ success: true }` 반환으로 기술
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/fix-embedding-test-dimension-a3d42a/spec/2-navigation/6-config.md` L249: "리랭커는 표준 model-list/test API 가 없어 … 연결 테스트를 제공하지 않는다", `POST /api/model-configs/:id/test`: "연결 테스트 (chat/embedding 만 — rerank 미제공)"
- **상세**: 기존 spec 은 rerank에 대해 연결 테스트 미제공(§B.6.2, API 표 주석)을 명시하는데, target 변경안의 kind 표에 `rerank` 가 `chat`과 함께 `testConnection()` 경로로 포함되어 있다. 두 명세가 충돌한다. target이 rerank의 testConnection을 실제로 지원하는 것으로 변경하는 의도라면 §B.6.2와 API 표 주석도 함께 갱신해야 하고, 단순히 서비스 내부 분기 설명이라면 "rerank"를 표에서 제외하거나 별도 주석으로 처리해야 한다.
- **제안**: target 변경안의 kind 표에서 rerank 행을 삭제하거나, "rerank: POST /api/model-configs/:id/test 미제공(§B.6.2) — 서비스 내부적으로는 client.testConnection() 호출 가능하나 API 미노출"로 명확히 구분한다.

---

## 요약

target 문서가 도입하는 신규 식별자 중 가장 위험한 충돌은 "probe 결과 dimension 자동 저장" 의미론과 기존 spec의 "probe read-only" 원칙이 서로 다른 엔티티(`ModelConfig.dimension` vs `KnowledgeBase.embedding_dimension`)를 대상으로 하면서도 같은 단어("probe", "차원 저장")를 사용해 독자 혼선을 유발하는 것이다. 추가로 `LLMClient` 인터페이스 반환 타입(`Promise<boolean>`)과 서비스 레이어 반환 형식(`{ success, dimension? }`)을 spec 상에서 구분하지 않아 인터페이스 변경 필요 여부가 모호해지며, rerank의 testConnection 지원 여부가 기존 "미제공" 명세와 직접 충돌한다. 파일 경로·요구사항 ID·API endpoint 신설(PATCH /api/model-configs/:id {dimension})은 기존과 중복되지 않는다.

## 위험도

MEDIUM
