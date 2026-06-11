# 신규 식별자 충돌 검토 — spec-draft-unified-model-management.md

## 발견사항

### 1. DB 테이블/엔티티명 충돌 없음 (확인)

- **target 신규 식별자**: DB 테이블 `model_config`, TypeScript 엔티티 `ModelConfig`
- **기존 사용처**: `spec/1-data-model.md §2.16`에 `llm_config` 테이블(엔티티 `LlmConfig`), `spec/1-data-model.md §2.16.1`에 `rerank_config` 테이블(엔티티 `RerankConfig`), 코드베이스 `codebase/backend/src/modules/llm-config/entities/llm-config.entity.ts`, `codebase/backend/src/modules/rerank-config/entities/rerank-config.entity.ts`
- **판정**: 충돌 없음. `model_config` / `ModelConfig` 는 현재 레포 어디에도 사용되지 않는 신규 식별자다. `llm_config`→`model_config` rename 이므로 기존 테이블이 사라지는 것이 전제이며, 동일 이름이 다른 의미로 공존하는 상황이 아니다.

---

### 2. TypeScript 타입 `ModelInfo` 와 혼동 가능

- **[WARNING]** `ModelInfo` 와 `ModelConfig` 근접 혼동 위험
- **target 신규 식별자**: `ModelConfig` (TypeScript 엔티티/DTO)
- **기존 사용처**: `spec/5-system/7-llm-client.md §3.5` 에 `ModelInfo` 인터페이스 정의; `codebase/frontend/src/lib/api/llm-configs.ts:24` 에서 `ModelInfo` 타입 export, `codebase/backend/src/modules/llm/llm-preview.service.ts:7,29` 등에서 광범위하게 사용 중
- **상세**: `ModelConfig` (공급자 설정 리소스) 와 `ModelInfo` (공급자가 노출하는 모델 목록 항목) 는 의미가 다르다. 기존에 이미 `ModelInfo` 가 "모델"이라는 단어를 선점하고 있어서, 신규 `ModelConfig` 를 코드 레벨에서 처음 접하는 개발자가 "모델의 정보(config)"와 "모델 공급자 설정" 을 혼동할 소지가 있다.
- **제안**: 코드 내 JSDoc/코멘트에 "provider-level configuration" 과 "model list item" 의 구분을 명시하는 것을 권장한다. 혼동을 줄이려면 엔티티명을 `ProviderConfig` 로 고려해볼 수 있으나 기존 spec 문맥상 `ModelConfig` 가 더 직관적이므로 주석 보완이 현실적 대안이다.

---

### 3. KB 신규 FK 컬럼명 `embedding_model_config_id` — 기존 `embedding_llm_config_id` 와 병존

- **[WARNING]** 동일 역할의 컬럼이 기존 이름과 다른 신규 이름으로 도입됨, 기존 참조 파일 갱신 목록 누락
- **target 신규 식별자**: `knowledge_base.embedding_model_config_id` (신규 컬럼, FK → `model_config`)
- **기존 사용처**: `codebase/backend/migrations/V029__kb_embedding_llm_config.sql` (컬럼 `embedding_llm_config_id` 추가), `codebase/backend/src/modules/knowledge-base/entities/knowledge-base.entity.ts:66` (`embedding_llm_config_id`), `spec/data-flow/6-knowledge-base.md:37,73,117,163` 에 `embedding_llm_config_id` 다수 참조
- **상세**: target 변경 3의 갱신 대상 파일 목록(`spec/5-system/8-embedding-pipeline.md`, `spec/5-system/9-rag-search.md`, `spec/2-navigation/5-knowledge-base.md`, `spec/5-system/7-llm-client.md`)에 `spec/data-flow/6-knowledge-base.md` 가 포함되지 않았다. 이 파일은 `embedding_llm_config_id` 를 4곳에서 참조하므로 갱신하지 않으면 spec 드리프트가 발생한다.
- **제안**: 변경 3 대상 파일 목록에 `spec/data-flow/6-knowledge-base.md` 를 추가하고, V091/V092 전환 기간 중 두 컬럼이 공존함을 draft 에 명시한다.

---

### 4. API endpoint — `/api/model-configs` 는 신규이며 기존 엔드포인트와 직접 충돌 없음 (확인)

- **target 신규 식별자**: `/api/model-configs` (전체 9개 엔드포인트)
- **기존 사용처**: `spec/2-navigation/6-config.md §3` 에 `/api/llm-configs` (7개), `/api/rerank-configs` (6개). `spec/5-system/7-llm-client.md:307,311` 에 `/api/llm-configs/preview-models`, `/api/llm-configs/:id/models`
- **판정**: 새 경로 `/api/model-configs` 와 기존 경로 `/api/llm-configs`, `/api/rerank-configs` 는 다른 경로이므로 엔드포인트 충돌은 없다. 구 엔드포인트를 "deprecation alias로 한시 유지"한다고 명시했으므로 이중 정의 구간이 발생하나 의도된 전환 설계다.

---

### 5. `preview-models` 엔드포인트 — 기존 spec 참조 갱신 불완전

- **[CRITICAL]** 기존 `spec/5-system/7-llm-client.md §5.5` 의 경로(`/api/llm-configs/preview-models`)가 신규 경로(`/api/model-configs/preview-models`)로 명시 갱신되지 않음
- **target 신규 식별자**: `POST /api/model-configs/preview-models` (컬렉션 수준 미리보기)
- **기존 사용처**: `spec/2-navigation/6-config.md:250` — `POST /api/llm-configs/preview-models` ("저장 전 폼 자격증명으로 모델 목록 미리보기"). `spec/5-system/7-llm-client.md:307` — `POST /api/llm-configs/preview-models` (preview-models 엔드포인트 계약 정의). `codebase/frontend/src/lib/api/llm-configs.ts:114` 에서 실제 fetch 호출
- **상세**: target 변경 3 에서 `spec/5-system/7-llm-client.md` 를 "rerank 호출 계약(§3.6)·preview(§5.5)는 동작 불변, 엔티티명만 ModelConfig로" 라고만 기술했으나, `§5.5` 의 경로 자체(`/api/llm-configs/preview-models`)가 명시적으로 신규 경로로 갱신되는지 불분명하다. frontend API 클라이언트(`codebase/frontend/src/lib/api/llm-configs.ts:114`)의 fetch URL 갱신도 구현 대상에서 누락될 수 있다. spec 드리프트 및 런타임 404가 발생할 수 있다.
- **제안**: 변경 3 의 `spec/5-system/7-llm-client.md` 갱신 내용에 "§5.5 경로 `/api/llm-configs/preview-models` → `/api/model-configs/preview-models` 명시 갱신" 을 포함하고, 구현 단계에서 frontend API 클라이언트 URL도 갱신 대상임을 plan 에 기술한다.

---

### 6. 마이그레이션 버전 번호 V088–V092 — 사용 가능 (확인)

- **target 신규 식별자**: V088, V089, V090, V091, V092
- **기존 사용처**: 현재 최신 마이그레이션은 `V087__execution_resume_call_stack.sql`. V088–V092 는 미사용
- **판정**: 충돌 없음.

---

### 7. `ModelConfig.kind` — 기존 `ModelInfo.type` 과 값 집합 중복

- **[INFO]** `ModelConfig.kind` 의 값 집합(`chat`/`embedding`/`rerank`) 이 기존 `ModelInfo.type` 의 일부 값과 중복
- **target 신규 식별자**: `model_config.kind` Enum (`chat` | `embedding` | `rerank`)
- **기존 사용처**: `spec/5-system/7-llm-client.md §3.5` — `ModelInfo` 인터페이스의 `type` 필드가 `chat` / `embedding` 값을 사용. `codebase/frontend/src/lib/api/llm-configs.ts:24` 의 `ModelInfo.type` 도 동일
- **상세**: 두 식별자가 같은 문자열 값을 공유하므로 TypeScript 타입 정의 시 `ModelInfo.type` 의 union 을 `ModelConfig.kind` 에 재사용하거나 혼용하는 실수가 발생할 수 있다.
- **제안**: TypeScript 레이어에서 `ModelConfig.kind` 전용 `ModelKind` enum 을 정의하고, 기존 `ModelInfo.type` 의 타입과 분리 선언한다.

---

### 8. `is_default` partial unique 제약 — 기존 단일 partial unique에서 복합 partial unique로 의미 확장

- **[WARNING]** `is_default` 의 기존 per-workspace 1개 의미가 per-(workspace, kind) 3개 허용으로 변경
- **target 신규 식별자**: `(workspace_id, kind)` partial unique 제약 on `model_config.is_default`
- **기존 사용처**: `codebase/backend/src/modules/llm-config/entities/llm-config.entity.ts:17` — `@Index('llm_config_workspace_default_unique', ['workspaceId'], { unique: true, where: '"is_default" = true' })`. 즉 기존에는 워크스페이스당 `is_default=true` 가 최대 1개
- **상세**: 기존 `set-default` API 의 서비스 로직이 `workspace_id` 전체 기준으로 `is_default=false` reset 을 수행한다면, `kind` 구분 없이 모든 kind 의 기본값이 초기화되는 버그가 발생한다. target 의 `PATCH /api/model-configs/:id/set-default` 설명에 `kind` 범위 제한이 명시되지 않아 구현 혼선이 우려된다.
- **제안**: target 변경 2 §3 API 의 `PATCH /api/model-configs/:id/set-default` 항목에 "동일 `(workspace_id, kind)` 내의 기존 기본값을 초기화 후 지정" 동작을 명시한다.

---

### 9. `knowledge_base.rerank_llm_config_id` — `rerank_config_id` 와 명칭 혼란 지속

- **[INFO]** 두 컬럼이 모두 `rerank_*` prefix를 공유하면서 역할이 다름
- **target 신규 식별자**: 명시적 영향 없음. `rerank_config_id` 는 FK 타깃만 `rerank_config` → `model_config(kind=rerank)` 로 변경
- **기존 사용처**: `spec/1-data-model.md §2.11` — `rerank_config_id` (FK → RerankConfig, 리랭커 공급자 설정) 와 `rerank_llm_config_id` (FK → LLMConfig, listwise grading 용 chat LLM) 두 컬럼이 공존
- **상세**: target 적용 후에는 `rerank_config_id` 가 `model_config(kind=rerank)` 를 가리키게 되고, `rerank_llm_config_id` 는 여전히 chat kind LLMConfig(→model_config의 chat 행)를 가리킨다. 이름만 보면 둘 다 "rerank + config" 인데 역할이 다르다는 혼란이 더 심화된다.
- **제안**: `spec/1-data-model.md §2.11` 갱신 시 두 컬럼의 역할 차이를 주석으로 명시한다.

---

## 요약

target 이 도입하는 핵심 식별자(`ModelConfig`, `model_config` 테이블, `/api/model-configs` 엔드포인트, V088–V092 마이그레이션 번호)는 기존 식별자와 직접 충돌하지 않는다. 가장 위험한 사항은 두 가지다: (1) `POST /api/model-configs/preview-models` 의 기존 `spec/5-system/7-llm-client.md §5.5` 경로 갱신이 변경 3 명세에 명확히 포함되지 않아 spec 드리프트·런타임 404 로 이어질 수 있는 CRITICAL 위험; (2) KB 신규 컬럼 `embedding_model_config_id` 전환 시 기존 `embedding_llm_config_id` 를 4곳에서 참조하는 `spec/data-flow/6-knowledge-base.md` 가 갱신 목록에서 누락된 WARNING. `is_default` 의 per-(workspace, kind) 부분 유니크로의 의미 변경도 기존 `set-default` 서비스 로직의 버그 가능성이 있어 명세 보완이 필요하다.

## 위험도

MEDIUM
