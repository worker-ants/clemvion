# 신규 식별자 충돌 검토 결과

검토 대상: `plan/in-progress/spec-update-embedding-testconnection.md`
검토 모드: spec draft (--spec)

---

## 발견사항

- **[INFO]** `dimension` 필드명 — ModelConfig vs EmbedResponse 트랙 간 용어 중첩 가능성
  - target 신규 식별자: target §1 · §2 에서 `{ success, dimension? }` 응답 shape 의 `dimension` 키를 서비스 반환값으로 명명
  - 기존 사용처: `/Volumes/project/private/clemvion/spec/5-system/7-llm-client.md` §3.3 · §Rationale (L147, L155, L459) 에서 `EmbedResponse`(Planned)의 `dimensions` 메타데이터 필드를 별도로 언급. 현재 인터페이스는 벡터 배열만 반환하며 차원 메타데이터를 포함하지 않음
  - 상세: target 이 도입하는 `dimension?` 는 서비스 레이어(`LlmService.testConnection`) 반환값에만 존재하는 임시 스칼라다. Planned `EmbedResponse.dimensions` 가 LLMClient 인터페이스에 추가될 때 이름(`dimensions` 복수 vs `dimension` 단수)이 달라 혼동 가능성이 있으나, target 명시적으로 "두 트랙이 독립"임을 Rationale 에 기술했다. 필드가 다른 레이어(서비스 반환 vs 클라이언트 인터페이스)에 위치하므로 런타임 충돌은 없음
  - 제안: 현재 명명으로 수용 가능하나, 향후 `EmbedResponse` 도입 시 spec 에서 `dimension`(단수, 서비스 계층 testConnection 전용) vs `dimensions`(복수, EmbedResponse 인터페이스)의 의도적 차이를 한 줄 명시하면 혼동을 사전 차단할 수 있음

- **[INFO]** `POST /api/knowledge-bases/embedding-probe` vs `POST /api/model-configs/{id}/test` — 두 probe endpoint 의 역할 구분 명확성
  - target 신규 식별자: target §핵심 구분 표에서 `POST /api/model-configs/{id}/test` 가 `ModelConfig.dimension` 을 자동 저장한다고 명시
  - 기존 사용처: `/Volumes/project/private/clemvion/spec/2-navigation/5-knowledge-base.md` L64, L207 에 `POST /api/knowledge-bases/embedding-probe` 가 KB 폼 전용 read-only probe 로 명시됨. `/Volumes/project/private/clemvion/spec/2-navigation/6-config.md` L283 에 `POST /api/model-configs/:id/test` 가 "연결 테스트 (chat/embedding 만 — rerank 미제공)" 으로 이미 정의됨
  - 상세: 두 endpoint 는 이미 spec 에 존재하며 충돌이 없다. target 이 `model-configs/:id/test` 의 응답 shape 를 기존 `{ success }` 에서 `{ success, dimension? }` 로 확장하는 것이므로 endpoint 이름 충돌이 아닌 응답 shape 변경이다. `6-config.md` L283 의 기존 설명 "연결 테스트 (chat/embedding 만 — rerank 미제공)" 은 target §5 의 보강 내용("응답: chat `{ success }`, embedding `{ success, dimension? }`")을 담지 않으므로 target 이 이를 갱신하는 것은 적절
  - 제안: 충돌 없음. 단, target §5 에서 L283 행 설명 교체 시 기존 "chat/embedding 만 — rerank 미제공" 조건이 유지되는지 편집 시 확인 필요(현재 target 은 이를 포함하고 있어 문제 없음)

- **[INFO]** `dimension` — `spec/1-data-model.md §2.16` vs `spec/2-navigation/5-knowledge-base.md` 의 `embedding_dimension` 필드명 구분
  - target 신규 식별자: target §6 에서 `spec/1-data-model.md §2.16 ModelConfig.dimension` 에 주석 1줄 추가
  - 기존 사용처: `/Volumes/project/private/clemvion/spec/1-data-model.md` L552 에 `dimension Integer?` 필드가 이미 정의됨. L339 에 `embedding_dimension` (KnowledgeBase 의 파생 캐시 필드) 이 별도로 정의됨
  - 상세: `ModelConfig.dimension` (SoT) 과 `KnowledgeBase.embedding_dimension` (파생 캐시) 은 이름이 다르고 의미도 다르다. target 의 §6 변경은 기존 `dimension` 행의 설명에 자동감지 경로 주석을 추가하는 것으로, 기존 필드 정의와 충돌하지 않는다. target 이 이 구분을 §핵심 구분 표에서 명시하고 있어 독자 혼동 위험도 낮다
  - 제안: 충돌 없음. 현행 명명 유지

- **[INFO]** `LlmService.testConnection` 시그니처 — 기존 §8.3 코드 블록과의 정합
  - target 신규 식별자: target §1 에서 `LlmService.testConnection(configId, workspaceId)` 의 kind 별 probe 전략을 §8.3 에 추가하는 것을 제안
  - 기존 사용처: `/Volumes/project/private/clemvion/spec/5-system/7-llm-client.md` L412 에 §8.3 `LlmService` 코드 블록이 있으며 `// 기존 chat / testConnection / resolveConfig 유지` 주석만 있고 `testConnection` 의 시그니처는 기술되지 않음. L87 에 `LLMClient.testConnection(): Promise<boolean>` 인터페이스가 있음
  - 상세: target 은 `LLMClient.testConnection()` 인터페이스(L87)를 변경하지 않는다고 명시하며, `LlmService.testConnection(configId, workspaceId)` 는 서비스 레이어 메서드로 인터페이스 계약과 다른 레이어다. 현재 §8.3 의 `LlmService` 코드 블록에는 `embed` / `chatStream` 만 signature 로 기술하고 `testConnection` 은 주석 처리돼 있다. target 이 이 블록에 testConnection probe 전략을 추가하는 것은 기존 명칭 재사용이므로 충돌이 아닌 보강
  - 제안: 충돌 없음. target §1 의 서술 방식("기존 chat / testConnection / resolveConfig 유지" 주석 연장)이 §8.3 코드 블록 스타일과 일치하도록 편집 시 주의

---

## 요약

target(`spec-update-embedding-testconnection.md`)이 도입하는 신규 식별자 — `{ success, dimension? }` 응답 shape, `LlmService.testConnection` probe 전략 표, `§B.3` embedding 분기 설명, `§B.5` dimension 행 교체, `§3 API 표` 행 보강, `§2.16` 주석 추가 — 는 모두 기존 spec 에서 이미 사용 중인 명칭의 **의미 확장 또는 보강**이며 새로운 이름을 창출하지 않는다. `ModelConfig.dimension` (SoT) vs `KnowledgeBase.embedding_dimension` (파생 캐시) 의 구분은 기존 spec 에서 이미 확립되어 있고 target 도 이를 명시적으로 유지한다. `POST /api/model-configs/{id}/test` endpoint 는 기존에 정의된 경로이며 target 은 응답 shape 만 확장한다. `EmbedResponse.dimensions` (Planned, 복수) 와 `testConnection` 반환 `dimension` (단수) 의 명명 차이는 의도적이며 레이어가 달라 충돌이 없다. CRITICAL 및 WARNING 급 식별자 충돌은 발견되지 않았다.

## 위험도

NONE

STATUS: OK
