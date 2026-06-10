---
worktree: unified-model-mgmt-5af7ee
started: 2026-06-10
owner: project-planner
related_spec:
  - spec/1-data-model.md
  - spec/2-navigation/6-config.md
  - spec/5-system/7-llm-client.md
  - spec/5-system/8-embedding-pipeline.md
  - spec/5-system/9-rag-search.md
  - spec/2-navigation/5-knowledge-base.md
related_plan:
  - plan/in-progress/spec-sync-config-gaps.md
  - plan/in-progress/kb-model-change-reembed-followup.md
  - plan/in-progress/knowledge-base-quality-improvements.md
  - plan/in-progress/migration-tooling-evaluation.md
---

# Unified Model Management — 통합 모델 관리

> 작성일: 2026-06-10
> 결정: **B안 (통합 `model_config` 테이블 + 단일 `/models` 페이지) + 임베딩 1급화**
> 배경: LLM·임베딩·리랭킹 3종 모델이 서로 다른 3가지 패턴으로 분산 관리되어
> 불필요한 관리 포인트와 UX 분산 발생.

## 0. 목표와 비목표

**목표**

- 설정 화면 **3곳(`/llm-configs`, `/rerank-configs`, KB 상세 내 임베딩) → 1곳(`/models` 탭)**.
- 설정 테이블 **2개(`llm_config`, `rerank_config`) + piggyback 1개(KB가 빌려쓰는 임베딩) → 1개(`model_config`, `kind` 판별자)**.
- 임베딩을 **chat용 llm_config 종속에서 분리**, 자체 자격증명·모델·차원을 가진 1급 모델로 상향.

**비목표**

- 실행 레이어 provider 클라이언트(`modules/llm/`, `modules/llm/rerank/`,
  `knowledge-base/embedding/`)의 호출 추상화 재작성 — 그대로 둔다. 통합 대상은 **설정/CRUD 레이어**뿐.
- 신규 임베딩 provider 클라이언트 추가 — 불필요(조사 결과 §1.2). 기존 embed 지원 provider 재사용.
- 마이그레이션 도구 전환 — Flyway 유지(조사 결과 §1.3). Sqitch PoC 결정과 무관하게 raw SQL V088~.

## 1. 조사 결과 (착수 전 확정 사실)

### 1.1 UUID 보존 → AI 노드·FK 참조 무변경 = YES (확정)

- AI 노드(`ai_agent`/`text_classifier`/`information_extractor`)의 `llmConfigId`는
  workflow snapshot/`node.config` JSONB 내 **문자열** (FK 제약 없음).
  `ai-agent.schema.ts:198`, `text-classifier.schema.ts:41`, `information-extractor.schema.ts:38`.
- `llm_config.id`를 참조하는 DB FK는 **5개 컬럼**, 전부 `ON DELETE SET NULL`:
  | 테이블 | 컬럼 | 마이그레이션 | kind 의미 |
  | --- | --- | --- | --- |
  | `workflow_assistant_session` | `llm_config_id` | V019 | chat |
  | `llm_usage_log` | `llm_config_id` | V014 | chat |
  | `knowledge_base` | `extraction_llm_config_id` | V025 | chat |
  | `knowledge_base` | `embedding_llm_config_id` | V029 | **embedding(→1급 전환 대상)** |
  | `knowledge_base` | `rerank_llm_config_id` | V082 | chat (cross_encoder_llm용) |
- **결론**: `llm_config`를 in-place로 `model_config`로 진화시키고 UUID를 보존하면,
  chat-kind 참조(노드 config·assistant·usage_log·extraction·rerank_llm)는 **재배선 0건**.
  repoint 가 필요한 건 **embedding_llm_config_id 1개**(piggyback → 1급 embedding row)와
  `rerank_config_id`(별도 테이블 → model_config 흡수) 둘뿐.

### 1.2 임베딩 1급화 — 신규 provider 클라이언트 불필요

- `embed()`는 이미 OpenAI / Azure / Google / **Local(OpenAI 호환: Ollama·vLLM·TEI)** 지원.
  Anthropic만 미지원(거부). 자가호스팅 임베딩은 Local provider 경로로 이미 커버됨.
- 즉 1급화는 "새 provider"가 아니라 **"embedding을 chat용 row에서 떼어내 자체 config row로"** 만 하면 됨.
- 차원 상수는 `embedding/embedding-dimensions.const.ts`에 6종 하드코딩: 384/512/768/1024/1536/3072.
  3072만 halfvec, 나머지 vector HNSW. → embedding config의 `dimension`이 KB pgvector 차원과 결합.

### 1.3 마이그레이션 = Flyway, 현재 최신 V087

- 도구: Flyway(raw SQL), 네이밍 `V<int>__<snake>.sql`, 현재 max **V087**.
- Sqitch는 조건부·미착수(`sqitch-poc.md`), Flyway가 SoT(`spec/conventions/migrations.md`).
- → 신규 마이그레이션은 **V088~** raw SQL. append-only, NOT VALID 2-step, `-- DOWN:` 주석,
  `scripts/check-migration-versions.py --base origin/main` 가드 통과 필수.

## 2. 목표 데이터 모델 — `model_config`

`llm_config`를 **in-place 진화**(테이블 rename + 컬럼 추가). chat row의 UUID·FK 보존이 핵심.

| 컬럼 | 변경 | 비고 |
| --- | --- | --- |
| `id` | 유지 | chat row는 기존 llm_config UUID 보존 |
| `workspace_id` | 유지 | |
| **`kind`** | **신규** enum `chat`\|`embedding`\|`rerank` | 기존 행 default `'chat'` |
| `provider` | 유지 | chat: openai/anthropic/google/azure/local · rerank: tei/cohere · embedding: openai/azure/google/local |
| `name`, `api_key`(enc), `base_url` | 유지 | 마스킹·SSRF·secret-store transformer 그대로 |
| `default_model` | 유지 | |
| `default_params` (JSONB) | 유지 | chat 전용 의미(temperature 등). embedding/rerank는 무시 |
| **`dimension`** (int?) | **신규** | **embedding 전용**. pgvector 차원 고정 SoT |
| `is_default` | 의미 변경 | partial unique를 `(workspace_id, kind)` 당 1개로 |

- `rerank_config` 테이블의 모든 행을 `model_config`에 `kind='rerank'`로 **UUID 보존 복사** 후 테이블 drop(PR4).
- embedding은 KB의 distinct `(embedding_llm_config_id, embedding_model, embedding_dimension)`에서
  `kind='embedding'` 행 파생, KB는 신규 `embedding_model_config_id`로 repoint.

## 3. 마이그레이션 계획 (V088~V092, Flyway raw SQL)

| 버전 | 내용 | 안전장치 |
| --- | --- | --- |
| **V088** | `llm_config` → `model_config` rename. `kind` 컬럼 추가(NOT NULL default `'chat'`), `dimension` int NULL 추가 | rename은 메타데이터 연산. 기존 FK는 테이블 rename에 자동 추종 |
| **V089** | `is_default` partial unique index를 `(workspace_id)` → `(workspace_id, kind)` WHERE is_default 로 재정의 | DROP + CREATE INDEX (CONCURRENTLY + `.conf`) |
| **V090** | `rerank_config` 행을 `model_config`에 `kind='rerank'` UUID 보존 INSERT…SELECT. KB `rerank_config_id` FK 타깃을 `model_config(id)`로 전환 | 행수 일치 검증 쿼리 주석. `rerank_config` 테이블은 V092까지 유지(롤백 여지) |
| **V091** | KB에 `embedding_model_config_id` UUID 컬럼 추가(FK→model_config, ON DELETE SET NULL). distinct embedding 사용 조합에서 `kind='embedding'` 행 INSERT, KB repoint. `dimension`은 KB의 `embedding_dimension`에서 채움 | NOT VALID 2-step. 파생 매핑 검증 쿼리. 구 `embedding_llm_config_id`/`embedding_model`은 V092까지 유지 |
| **V092** (cleanup, PR4) | `rerank_config` DROP, KB 구 컬럼(`embedding_llm_config_id`, 필요 시 `embedding_model`) 정리 | 데이터 일치 검증 PASS 후에만 |

> **차원 가드**: KB가 이미 벡터를 가진 상태에서 embedding config 교체를 막는 로직은 기존
> `kb-model-change-reembed-followup.md` / `kb-unsearchable-warning.md`와 정합 — 본 작업은 차원 SoT를
> KB 컬럼에서 embedding model_config로 옮기되, 재임베딩/경고 규칙은 그 plan들을 따른다(중복 정의 금지).

## 4. PR 구성 (단계별 상세 = (c))

### PR0 — spec 개정 (project-planner, 본 worktree)

- **선행**: `/consistency-check --spec <draft>` (BLOCK:YES 시 차단).
- `1-data-model.md`: §2.16 LLMConfig + §2.16.1 RerankConfig → 통합 **§2.16 ModelConfig(kind 판별)**.
  embedding을 1급 엔티티로 명문화(provider/credential/model/dimension 소유). `is_default` 유니크 `(workspace, kind)`.
- `2-navigation/6-config.md`: Part B(LLM) + Part C(Rerank) → 단일 **"Models" 화면(탭 Chat/Embedding/Rerank)**.
  Embedding 탭 신설(차원 표시·교체 가드 UX). API 표를 `/api/model-configs?kind=`로 개정.
- `5-system/8-embedding-pipeline.md`·`9-rag-search.md §3.3`·`2-navigation/5-knowledge-base.md §2.2`:
  embedding/rerank 참조를 model_config로 갱신. KB의 embedding select 소스 = `kind=embedding` 목록.
- **Rationale 필수**: 기존 `6-config.md R-3`("rerank를 LLMConfig sibling으로 분리")·
  `1-data-model.md §2.16.1`(sibling 분리)을 **번복**. 근거: "API shape 차이보다 관리포인트·UX 통합 이득이 크고,
  마스킹·SSRF·secret-store 인프라는 이미 공유 중이라 분리 실익 소멸. kind 판별자로 shape 차이 흡수."
  (rationale-continuity-checker가 '기각된 대안 재도입'으로 차단할 수 있으므로 명시적 합의 근거 기록.)
- **조정**: `spec-sync-config-gaps.md`(6-config의 기존 pending gap plan)와 충돌 점검 —
  IP Whitelist·Header 미구현 등 Auth(Part A) gap은 본 작업 범위 밖이므로 보존, Part B/C만 개정.

### PR1 — backend 통합 모듈 (developer)

- 마이그레이션 V088·V089·V090.
- `modules/llm-config/` + `modules/rerank-config/` → **`modules/model-config/`** 통합.
  엔티티 `ModelConfig`(kind 판별), 단일 service/controller. DTO에 `kind` 추가.
- 컨트롤러 `/api/model-configs` (목록·생성에 `kind` 파라미터). `set-default`/`test`/`models`(preview)는 kind 분기.
- **API 호환**: 구 `/api/llm-configs`·`/api/rerank-configs`는 deprecation alias로 한시 유지(PR4까지).
- `LlmService.resolveConfig` 등 실행 경로는 ModelConfig 조회로 치환(UUID 동일이라 동작 동형).

### PR2 — embedding 1급화 (developer)

- 마이그레이션 V091.
- `kind='embedding'` CRUD 지원(provider 범위 openai/azure/google/local), `dimension` 필드·검증.
- KB embedding 경로를 `embedding_model_config_id` 기반으로 전환(`embedding.service.ts:211` resolve 치환).
- 차원 교체 가드는 `kb-model-change-reembed-followup.md` 규칙 준수.

### PR3 — frontend 통합 (developer)

- `/llm-configs` + `/rerank-configs` → **`/models`** 단일 페이지, 탭 `[Chat][Embedding][Rerank]`.
  기존 라우트는 `/models?tab=`로 redirect. 사이드바 항목 2→1.
- KB 상세 embedding select 소스를 `kind=embedding` 목록으로 전환.
- i18n `llmConfigs`/`rerankConfigs` → `models` 통합(또는 kind 서브키). KO/EN parity.
- 유저 가이드 동반 갱신(PROJECT.md 매트릭스 trigger 해당 시).

### PR4 — cleanup (developer)

- 마이그레이션 V092(`rerank_config` drop, KB 구 컬럼 정리).
- deprecation alias 엔드포인트·구 프론트 라우트 제거. 데이터 일치 검증 PASS 후에만.

## 5. 열린 결정 (PR0 spec 확정 시 함께 결론)

- **D-1**: embedding `default_params`에 임베딩 전용 옵션(예: dimensions 축소, taskType)을 둘지 vs `dimension` 단일 컬럼만.
  → 1차는 `dimension` 컬럼 + provider 자동 taskType(기존 `embedding-input-type.ts` 로직 유지). 추가 옵션은 후속.
- **D-2**: `/api/model-configs` 단일 엔드포인트 vs kind별 서브경로. → 단일 + `kind` 쿼리(목록)/바디(생성) 권장.
- **D-3**: alias 엔드포인트 유지 기간(PR4 동시 제거 vs 1 릴리스 유예). → API 계약 관점 리뷰에서 확정.

## 6. 진행 상태

- [x] (a) 조사 — UUID 보존/embedding provider/마이그레이션 도구 확정.
- [ ] (b) PR0 spec draft + `/consistency-check --spec`.
- [ ] (c) PR 범위 상세 — 본 §4에 반영 완료, spec 확정 후 developer 위임.
