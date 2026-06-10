# Cross-Spec 일관성 검토 결과

**대상 draft**: `plan/in-progress/spec-draft-unified-model-management.md`
**검토 범위**: `spec/1-data-model.md`, `spec/2-navigation/6-config.md`, `spec/5-system/7-llm-client.md`, `spec/5-system/8-embedding-pipeline.md`, `spec/5-system/9-rag-search.md`, `spec/2-navigation/5-knowledge-base.md`, `spec/data-flow/6-knowledge-base.md`, `spec/data-flow/7-llm-usage.md`, `spec/5-system/10-graph-rag.md`

---

## 발견사항

### [CRITICAL] KnowledgeBase 임베딩 FK 컬럼명 충돌

- **target 위치**: 변경 1 §2.16 ModelConfig "참조 관계(kind 의미)" — `knowledge_base.embedding_model_config_id`(신규)
- **충돌 대상**: `spec/data-flow/6-knowledge-base.md` §1.1 KB 생성 API body, §1.2 임베딩 처리 주석, §2 테이블 컬럼 목록 — 모두 `embedding_llm_config_id` 라는 이름 사용
- **상세**: draft 는 임베딩 FK 컬럼을 `embedding_model_config_id` 로 명명하지만, `spec/data-flow/6-knowledge-base.md` 는 동일 컬럼을 `embedding_llm_config_id` 로 사용한다. 또한 `spec/1-data-model.md §2.11 KnowledgeBase` 표에 해당 FK 컬럼이 아예 없다(draft 가 신설 선언). 두 이름이 충돌하여 구현 시 어느 컬럼명을 사용해야 할지 불명확하다.
- **제안**: draft 채택 시 컬럼명을 `embedding_llm_config_id`(data-flow 기존 명칭)로 통일하거나, `spec/data-flow/6-knowledge-base.md` 전체를 `embedding_model_config_id` 로 일괄 갱신해야 한다.

---

### [CRITICAL] `spec/1-data-model.md §2.11 KnowledgeBase.rerank_config_id` FK 타깃 모순

- **target 위치**: 변경 1 §2.16 ModelConfig "참조 관계(kind 의미)" — "rerank: `knowledge_base.rerank_config_id`(FK 타깃이 rerank_config → model_config로 전환)"
- **충돌 대상**: `spec/1-data-model.md §2.11` — `rerank_config_id | UUID? | FK → RerankConfig`; `§2.16.1 RerankConfig` 엔티티 정의가 현존
- **상세**: draft 는 `rerank_config_id` FK 타깃을 `RerankConfig` 에서 `model_config(kind=rerank)` 로 전환한다고 선언하지만 `spec/1-data-model.md` 는 여전히 `FK → RerankConfig` 로 명시하고 §2.16.1 RerankConfig 엔티티를 정규 정의로 유지하고 있다. 동일 FK 가 두 문서에서 서로 다른 타깃을 가리킨다.
- **제안**: draft 채택 전 `spec/1-data-model.md §2.11 rerank_config_id` 행의 FK 타깃 갱신 및 §2.16.1 RerankConfig 삭제를 draft 와 동일 PR 에 포함해야 한다.

---

### [CRITICAL] `LLMClientFactory`/`RerankClientFactory` 팩토리 분리 정책과 단일 테이블 통합의 계층 책임 불명확

- **target 위치**: 변경 2 §3 API — `POST /api/model-configs`(body 에 kind) 단일 생성 엔드포인트; 변경 1 §2.16 단일 `model_config` 테이블
- **충돌 대상**: `spec/5-system/7-llm-client.md §4 LLMClientFactory` — `LLMClientCreateOptions: { provider, apiKey, defaultModel, baseUrl? }` 로 chat/embedding 전용; `§4.1 RerankClientFactory` — 별도 팩토리로 분리
- **상세**: `spec/5-system/7-llm-client.md §4` 는 chat/embedding 팩토리와 rerank 팩토리를 의도적으로 분리하고, 팩토리가 `LLMClientCreateOptions` 를 인자로 받는다. draft 가 `model_config` 단일 테이블을 도입하면 서비스 레이어가 `kind` 에 따라 어느 팩토리를 호출할지 결정해야 하는데, 이 결정이 `spec/5-system/7-llm-client.md` 에 반영되지 않았다. 팩토리를 통합하는지, 아니면 서비스 레이어에서 `kind` 분기 후 기존 팩토리를 각각 호출하는지 불명확하다.
- **제안**: `spec/5-system/7-llm-client.md §4` 에 "ModelConfig.kind 로 팩토리 선택 로직"(또는 팩토리 통합 결정)을 명시해야 한다.

---

### [WARNING] `spec/2-navigation/6-config.md §3` API 엔드포인트와 draft 신규 API 이중 정의

- **target 위치**: 변경 2 §3 API 표 — `/api/model-configs` 통합 엔드포인트 집합; "구 엔드포인트 deprecation alias 한시 유지"
- **충돌 대상**: `spec/2-navigation/6-config.md §3` — `GET/POST/PATCH/DELETE /api/llm-configs` 및 `GET/POST/PATCH/DELETE /api/rerank-configs` 를 정식 canonical 로 명세
- **상세**: draft 의 deprecation alias 선언이 `spec/2-navigation/6-config.md` 에 반영되지 않으면 두 spec 이 서로 다른 엔드포인트 집합을 canonical SoT 로 가리킨다. 구현자가 어느 spec 을 따라야 하는지 혼동된다.
- **제안**: `spec/2-navigation/6-config.md §3` 의 LLM Config API / Rerank Config API 표를 `/api/model-configs` 표로 교체하고, 구 엔드포인트에 deprecation 주석을 추가해야 한다.

---

### [WARNING] `spec/2-navigation/6-config.md §Rationale §R-3` 과 draft 의 R-3 번복 직접 모순

- **target 위치**: 변경 2 §Rationale 개정(R-3 번복) — "기존 R-3 'RerankConfig sibling 분리' 결정 번복, ModelConfig 통합"
- **충돌 대상**: `spec/2-navigation/6-config.md` 끝 `## Rationale §R-3` — "RerankConfig — LLMConfig sibling 리소스로 분리한다"
- **상세**: draft 는 R-3 을 명시적으로 번복한다고 선언하지만 `spec/2-navigation/6-config.md §R-3` 본문은 "분리" 결정을 SoT 로 유지하고 있다. 동일 라벨 R-3 이 두 spec 에서 반대 결론을 가진다.
- **제안**: draft 채택 시 `spec/2-navigation/6-config.md §R-3` 을 번복 내용으로 교체해야 한다.

---

### [WARNING] `spec/5-system/8-embedding-pipeline.md §5.2` 임베딩 모델 소스 불일치

- **target 위치**: 변경 3 — "`spec/5-system/8-embedding-pipeline.md`: 임베딩 config 소스를 '`kind=embedding` ModelConfig'로, 차원 SoT 를 `embedding ModelConfig.dimension` 으로 명시"
- **충돌 대상**: `spec/5-system/8-embedding-pipeline.md §5.2` — "`KnowledgeBase` 엔티티의 `embedding_model` 필드에 지정. 기본 모델: 프로바이더별 상이"
- **상세**: 8-embedding-pipeline.md §5.2 는 임베딩 모델 소스를 `KB.embedding_model` 문자열 + 워크스페이스 default LLMConfig 폴백으로 정의한다. draft 는 이를 `kind=embedding` ModelConfig FK 로 전환하므로 두 문서의 임베딩 소스 정의가 다르다.
- **제안**: `spec/5-system/8-embedding-pipeline.md §5.2`/§5.3(벡터 차원 SoT) 을 ModelConfig.dimension 기반으로 갱신하고, `spec/data-flow/6-knowledge-base.md §1.2` 의 `embedding_llm_config_id` 참조도 함께 갱신해야 한다.

---

### [WARNING] V089 마이그레이션에서 기존 `is_default=true` 중복 행 처리 미명시

- **target 위치**: 변경 1 §2.16 ModelConfig `is_default` — "`(workspace_id, kind)` 당 최대 1개(partial unique)", 마이그레이션 V089
- **충돌 대상**: `spec/1-data-model.md §2.16 LLMConfig` — `is_default | Boolean | 기본 프로바이더 여부` (단순 boolean, partial unique 제약 미명시); `§2.16.1 RerankConfig` — `is_default | Boolean`
- **상세**: 기존 LLMConfig 에는 `(workspace_id)` 기준 partial unique 제약이 없으므로 실제 운영 데이터에 `is_default=true` 가 여러 행인 workspace 가 존재할 수 있다. V089 에서 `(workspace_id, kind)` partial unique 제약을 추가하면 중복 행이 있는 경우 마이그레이션이 실패한다.
- **제안**: V089 마이그레이션에 "기존 `is_default=true` 중복 행 정리(예: `created_at` 최신 1개 보존, 나머지 `false`)" 단계를 명시해야 한다.

---

### [WARNING] `KB.embedding_model` 문자열 컬럼 존속 여부 미명시

- **target 위치**: 변경 1 §2.16 ModelConfig "참조 관계(kind 의미)" — embedding: `knowledge_base.embedding_model_config_id`(신규); 마이그레이션 V091 "embedding 1급 파생 + KB repoint"
- **충돌 대상**: `spec/1-data-model.md §2.11 KnowledgeBase` — `embedding_model | String | 임베딩 모델 식별자 (default: text-embedding-3-small)` 컬럼 현존
- **상세**: draft 는 임베딩 config 를 `embedding_model_config_id` FK 로 1급화하지만, `KB.embedding_model` 문자열 컬럼의 삭제 여부·대체 방식이 draft 에 언급되지 않았다. 두 컬럼이 공존하면 임베딩 모델의 SoT 가 어느 쪽인지 불명확해진다.
- **제안**: V091 또는 V092 마이그레이션에 "`KB.embedding_model` 컬럼 DROP" 또는 "ModelConfig.default_model 로 resolve 하는 view/computed" 방식을 명시해야 한다.

---

### [INFO] `spec/0-overview.md §6.1` 구현 완료 목록 용어 갱신 필요

- **target 위치**: 변경 전반 — LLMConfig → ModelConfig, RerankConfig → ModelConfig(kind=rerank)
- **충돌 대상**: `spec/0-overview.md §6.1` — "RerankConfig 프로바이더 tei/cohere", "LLM Config(프로바이더·모델·API Key)"
- **상세**: draft 채택 후 `RerankConfig`, `LLMConfig` 엔티티명이 사라지므로 §6.1 서술이 낡아진다.
- **제안**: draft 채택 시 `spec/0-overview.md §6.1` 관련 행을 "ModelConfig(chat/embedding/rerank 통합)" 으로 동기화 권장.

---

### [INFO] `spec/5-system/9-rag-search.md §3.3` "RerankConfig endpoint" 명칭 갱신 필요

- **target 위치**: 변경 3 — "`spec/5-system/9-rag-search.md §3.3`: rerank config 참조를 ModelConfig(kind=rerank)로 갱신(동작 동일)"
- **충돌 대상**: `spec/5-system/9-rag-search.md §3.3` — "RerankConfig endpoint 로 점수화 (RerankClient.rerank() — Spec LLM Client §3.6/§4.1)"
- **상세**: 동작은 불변이지만 엔티티명 `RerankConfig` 가 `ModelConfig(kind=rerank)` 로 바뀌어야 한다.
- **제안**: draft 채택 후 §3.3 및 §3.3.2 의 "RerankConfig" → "ModelConfig(kind=rerank)" 일괄 갱신 필요.

---

### [INFO] `spec/2-navigation/5-knowledge-base.md §2.2` 리랭커 select 소스 설명 갱신 필요

- **target 위치**: 변경 3 — KB spec §2.2 임베딩/리랭커 select 소스를 ModelConfig 목록으로 갱신
- **충돌 대상**: `spec/2-navigation/5-knowledge-base.md §2.2` — "KB 폼의 'Reranker' select 는 워크스페이스 RerankConfig 목록에서 선택한다. 엔티티: Spec 데이터 모델 §2.16.1"
- **상세**: draft 채택 시 select 소스가 `ModelConfig?kind=rerank` 목록으로 바뀌므로 §2.2 설명과 링크가 구 엔티티를 가리킨다.
- **제안**: draft 채택 시 동시 갱신 필요.

---

### [INFO] `spec/5-system/7-llm-client.md §2.1` 섹션 타이틀 부정확

- **target 위치**: 변경 전반
- **충돌 대상**: `spec/5-system/7-llm-client.md §2.1` 헤딩 — "리랭크 프로바이더 (Planned)" — tei/cohere 가 이미 구현 완료
- **상세**: draft 와 직접 충돌하지는 않지만 현재 "Planned" 타이틀이 구현 완료 상태와 맞지 않는다.
- **제안**: draft 채택과 함께 §2.1 헤딩을 "리랭크 프로바이더 (1차: tei/cohere 구현 완료)" 로 갱신 권장.

---

## 요약

draft 는 LLMConfig·RerankConfig·임베딩 config 를 단일 `model_config` 테이블(kind 판별자)로 통합하는 대규모 데이터 모델 변경이다. 세 가지 CRITICAL 충돌이 확인됐다: (1) 임베딩 FK 컬럼명이 `embedding_model_config_id`(draft)와 `embedding_llm_config_id`(spec/data-flow/6-knowledge-base.md)로 갈려 동일 컬럼이 서로 다른 이름으로 호출된다. (2) `spec/1-data-model.md §2.11 rerank_config_id` 가 아직 `FK → RerankConfig` 를 가리키는 반면 draft 는 `FK → model_config` 로의 전환을 선언해 직접 모순된다. (3) `LLMClientFactory`/`RerankClientFactory` 의 팩토리 분리 정책이 단일 테이블 통합 후 어떻게 바뀌는지 `spec/5-system/7-llm-client.md` 에 반영되지 않아 계층 책임이 불명확하다. WARNING 5건(API 엔드포인트 이중 정의, R-3 번복 미반영, embedding-pipeline 소스 불일치, is_default partial unique 마이그레이션 중복 처리 누락, KB.embedding_model 컬럼 존속 미명시)은 draft 채택 PR 에 함께 해소하지 않으면 구현 시점에 동일 충돌이 재현된다.

---

## 위험도

**HIGH**
