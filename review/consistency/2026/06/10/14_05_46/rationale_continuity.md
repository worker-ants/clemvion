# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-unified-model-management.md`
검토 기준 spec Rationale: `spec/1-data-model.md`, `spec/2-navigation/6-config.md`, `spec/5-system/7-llm-client.md`, `spec/5-system/9-rag-search.md`, `spec/5-system/8-embedding-pipeline.md`

---

## 발견사항

### [WARNING] R-3 번복 — 4개 spec Rationale 에 갱신이 필요하나 target 이 갱신 대상 목록을 일부만 명시

- target 위치: `변경 2 — spec/2-navigation/6-config.md` 하위 `### Rationale 개정 (R-3 번복)` 절
- 과거 결정 출처:
  1. `spec/2-navigation/6-config.md ## Rationale / R-3` — "RerankConfig 는 LLMConfig 와 동일 패턴의 sibling 리소스로 분리했다 (chat/embedding 과 API shape 가 다른 전용 `/rerank` 엔드포인트)"
  2. `spec/1-data-model.md §2.16.1` 본문 — "chat/embedding 과 API shape(전용 `/rerank` 엔드포인트)가 달라 §2.16 LLMConfig 와 분리한 sibling 리소스"
  3. `spec/5-system/9-rag-search.md ## Rationale` — "왜 RerankConfig 를 LLMConfig 와 분리했나: 리랭커는 chat/embedding 과 API shape 가 다른 별도 model class. capability flag 로 LLMConfig 에 욱여넣기보다 sibling 리소스가 명확."
  4. `spec/5-system/7-llm-client.md ## Rationale` — "왜 RerankClient 를 LLMClient 와 분리된 별도 인터페이스로 둔 것인가: 리랭커 API shape 는 chat/embed 와 근본적으로 다르다" / "왜 LLMClientFactory 에 통합하지 않았나: LLMConfig 와 RerankConfig 는 별개 DB 테이블·별개 워크스페이스 리소스다."
- 상세: target 의 `R-3 (번복)` 절은 번복 의도와 이유("관리 포인트·UX 통합 이득 > shape 분리 이득")를 명시하고 있어 형식상 근거 있는 번복이다. 그러나 `변경 3 — 연관 spec 참조 갱신` 목록에는 `spec/5-system/7-llm-client.md` 가 "엔티티명만 ModelConfig로" 수준으로만 명시되어 있고, `spec/5-system/9-rag-search.md` 의 Rationale 항("왜 RerankConfig 를 LLMConfig 와 분리했나")과 `spec/1-data-model.md §2.16.1` 본문 내 "sibling 리소스" 근거 설명, `spec/5-system/7-llm-client.md Rationale` 의 "왜 LLMClientFactory 에 통합하지 않았나" 항은 **번복된 이유를 담은 구형 논거 그대로** 남는다. target 은 이 항목들을 명시적으로 갱신 대상으로 선언하지 않는다. consistency-check 통과 후 spec 에 반영되더라도 네 곳의 Rationale 에 "shape 분리가 근거"라는 구형 논리가 잔류하면 후속 개발자가 혼란을 겪는다.
- 제안: target 의 `변경 3` 절에 아래 항목을 추가 또는 각 spec 의 Rationale 갱신 지시를 명시한다.
  - `spec/1-data-model.md §2.16.1` 기존 sibling 분리 근거 설명 → ModelConfig 통합 근거로 교체
  - `spec/5-system/9-rag-search.md ## Rationale "왜 RerankConfig 를 LLMConfig 와 분리했나"` → "왜 ModelConfig(kind=rerank)로 통합했나"로 교체
  - `spec/5-system/7-llm-client.md ## Rationale "왜 LLMClientFactory 에 통합하지 않았나"` → ModelConfig 통합 후에도 RerankClient 인터페이스·팩토리가 분리 유지되는 이유 명시

---

### [WARNING] 임베딩 1급화 — 기존 Rationale 와 충돌하는 암묵적 가정 (embedding piggyback 이 기존 의도인지 불분명)

- target 위치: `변경 1 §2.16 ModelConfig / Rationale 추가 — R: 임베딩 1급화` 및 `변경 3 spec/5-system/8-embedding-pipeline.md` 갱신 지시
- 과거 결정 출처: `spec/5-system/8-embedding-pipeline.md ## Rationale` — "`LlmService.listModels` 의 `{ type?: 'chat'|'embedding' }` 옵션으로 필터링한다" 구현 결정이 LLMConfig 가 chat/embedding 겸용임을 전제로 기록됨. `spec/5-system/8-embedding-pipeline.md §5` Rationale 에서 KB 생성/수정 시 "LLMConfig 의 embedding 모델을 모델 불러오기 버튼으로 조회한 뒤 select 로 선택"이라고 명시.
- 상세: 현행 spec 에서 임베딩 설정은 `KnowledgeBase.embedding_model` (String 필드), `extraction_llm_config_id` (FK → LLMConfig, chat 전용), `rerank_llm_config_id` (FK → LLMConfig, chat grading 전용) 구조다. embedding 전용 LLMConfig FK 는 현행 spec 에 없다(embedding provider 는 LLMConfig 의 chat 경로와 공유). target 이 "embedding 이 chat용 LLMConfig 를 빌려 썼다(같은 row가 역할에 따라 chat/embedding)"는 현행 spec 어디에도 명시된 설계 결정이 아니므로, "piggyback" 상태가 의도된 선택이었는지 기술 부채인지가 기존 Rationale 에 기록되어 있지 않다. 나아가 `embedding_model_config_id` 신규 FK 도입 및 `embedding_model` 문자열 필드 대체가 어떤 마이그레이션 경로를 취하는지, `LlmService.listModels` 의 `type: 'embedding'` 필터가 어떻게 ModelConfig `kind='embedding'` 조회로 전환되는지 Rationale 에 명시가 없다.
- 제안: target 의 `변경 3 spec/5-system/8-embedding-pipeline.md` 갱신 지시에 다음을 포함한다. (a) `KnowledgeBase.embedding_model` 문자열 필드 → `embedding_model_config_id` FK 전환 근거(임베딩 차원 SoT 를 ModelConfig.dimension 으로 이동), (b) `LlmService.listModels type='embedding'` 필터가 ModelConfig `kind='embedding'` 목록 조회로 대체됨을 Rationale 에 명시.

---

### [INFO] spec/5-system/7-llm-client.md Rationale 의 "분리 근거" 항목 갱신 미명시

- target 위치: `변경 3 — spec/5-system/7-llm-client.md` — "rerank 호출 계약(§3.6)·preview(§5.5)는 동작 불변, 엔티티명만 ModelConfig로."
- 과거 결정 출처: `spec/5-system/7-llm-client.md ## Rationale` — "왜 LLMClientFactory 에 통합하지 않았나: LLMConfig 와 RerankConfig 는 별개 DB 테이블·별개 워크스페이스 리소스다."
- 상세: target 은 `RerankClient` 인터페이스·`RerankClientFactory` 가 동작 불변임을 적시하여 시스템 레이어의 분리는 유지된다. 그러나 `7-llm-client.md Rationale` 의 "LLMConfig 와 RerankConfig 는 별개 DB 테이블" 전제는 통합 후 사실과 달라진다. 클라이언트·팩토리 분리 원칙(API shape 차이)은 여전히 유효하므로 CRITICAL 수준은 아니다.
- 제안: `7-llm-client.md Rationale` 의 "왜 LLMClientFactory 에 통합하지 않았나" 항에 "ModelConfig 통합 이후에도 RerankClient 인터페이스·팩토리는 분리 유지 — DB 테이블은 통합됐으나 API shape 차이는 불변" 문장을 추가하도록 target `변경 3` 지시에 포함한다.

---

### [INFO] spec/5-system/9-rag-search.md Rationale 갱신이 변경 3 목록에 누락

- target 위치: `변경 3 — 연관 spec 참조 갱신` 목록 중 `spec/5-system/9-rag-search.md §3.3` 항목
- 과거 결정 출처: `spec/5-system/9-rag-search.md ## Rationale` — "왜 RerankConfig 를 LLMConfig 와 분리했나: sibling 리소스가 명확. 단 provider 추상화·SSRF 가드·secret-store 는 재사용."
- 상세: target 은 `9-rag-search.md §3.3` 의 "rerank config 참조를 ModelConfig(kind=rerank)로 갱신(동작 동일)"만 명시한다. 그러나 `9-rag-search.md Rationale` 항목 자체도 갱신이 필요하다.
- 제안: `변경 3` 에 "spec/5-system/9-rag-search.md Rationale `왜 RerankConfig 를 LLMConfig 와 분리했나` 항 — ModelConfig 통합 근거로 갱신 또는 폐기"를 추가.

---

## 요약

target 문서는 `spec/2-navigation/6-config.md R-3`(RerankConfig sibling 분리)의 명시적 번복을 인식하고 새 근거(관리 포인트·UX 통합 이득)를 함께 기술하고 있어 기본적인 Rationale 연속성 절차는 갖춰져 있다. 그러나 동일한 분리 근거가 `spec/1-data-model.md §2.16.1`, `spec/5-system/9-rag-search.md Rationale`, `spec/5-system/7-llm-client.md Rationale` 세 곳에 독립적으로 기록되어 있음에도 target 의 `변경 3` 갱신 지시에서 이 항목들이 누락되어 있다. 또한 임베딩 1급화 결정이 기존 `embedding_model` 문자열 + `LlmService.listModels type 필터` 설계와 어떤 관계인지 Rationale 에 명시되지 않아 추후 구현 시 기존 설계 경계 처리가 모호하다. CRITICAL 수준 충돌(명시 기각 대안의 재도입 또는 invariant 직접 위반)은 없으며, 번복은 의도적이고 근거가 동반되어 있다.

## 위험도

LOW
