# 신규 식별자 충돌 검토 결과

검토 대상: `plan/in-progress/spec-draft-unified-model-management.md`

---

## 발견사항

### 1. **[WARNING]** DB 테이블명/API prefix `model_config`/`model-configs` — `_layout.md` 내비게이션 URL `/llm-configs` 갱신 누락

- **target 신규 식별자**: DB 테이블 `model_config` (V088 rename), API prefix `/api/model-configs`
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/2-navigation/_layout.md` line 66 — 내비게이션 항목 7 의 URL 경로 `/llm-configs`; `/Volumes/project/private/clemvion/spec/2-navigation/6-config.md` line 8 — `codebase/frontend/src/app/(main)/llm-configs/page.tsx` 코드 경로
- **상세**: target draft 는 API prefix 를 `/api/llm-configs` → `/api/model-configs` 로 변경하면서, 변경 3 갱신 목록에 `spec/2-navigation/_layout.md` 를 포함하지 않는다. 내비게이션 URL 을 `/model-configs` 로 함께 변경할 것인지, 아니면 URL 은 `/llm-configs` 로 유지하고 API prefix 만 변경할 것인지가 spec 에 명시되지 않아 불일치 상태로 남는다.
- **제안**: 변경 3 갱신 목록에 `spec/2-navigation/_layout.md` 항목 7 갱신(URL 변경 또는 "URL 불변, API prefix 만 전환" 명시)을 추가한다.

---

### 2. **[WARNING]** API endpoint 충돌 — `POST /api/model-configs/preview-models` vs 기존 `spec/2-navigation/6-config.md` 의 `POST /api/llm-configs/preview-models`

- **target 신규 식별자**: `POST /api/model-configs/preview-models`
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/2-navigation/6-config.md` line 250 — `POST /api/llm-configs/preview-models` (저장 전 모델 목록 미리보기); `/Volumes/project/private/clemvion/spec/5-system/7-llm-client.md` line 307 — 동일 endpoint
- **상세**: target draft 변경 3 은 `spec/5-system/7-llm-client.md §5.5` 의 경로 갱신을 명시하나, `spec/2-navigation/6-config.md §3 API` 표의 동일 행 갱신이 누락되어 있다. 두 spec 파일에서 동일 기능에 다른 endpoint 경로가 명시되는 충돌이 발생한다.
- **제안**: 변경 3 갱신 목록에 `spec/2-navigation/6-config.md §3 API 표 — preview-models 행` 갱신을 명시적으로 추가한다.

---

### 3. **[WARNING]** 감사 로그 액션명 충돌 — 기존 `llm_config.*`/`rerank_config.*` vs 새 `model_config.*` 네임스페이스

- **target 신규 식별자**: 암묵적 `model_config.create/update/delete/set-default` (감사 로그 액션)
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/5-system/1-auth.md` line 348 — `llm_config.*(create/update/delete/set-default)`, `rerank_config.*(create/update/delete/set-default)`
- **상세**: target draft 변경 3 의 `spec/5-system/1-auth.md §3.2` 갱신은 "RBAC 매트릭스 `rerank_config` 행 → `model_config(kind=rerank)` 갱신"만 언급하고, 감사 로그 액션 네임스페이스(`llm_config.*`, `rerank_config.*`)를 `model_config.*` 로 대체 또는 병행 유지할지 명시하지 않는다. 구현 단계에서 액션명 불일치로 감사 로그 쿼리가 깨질 수 있다.
- **제안**: target draft 변경 3 의 `spec/5-system/1-auth.md` 갱신 범위에 "감사 로그 액션명 `llm_config.*`/`rerank_config.*` → `model_config.*` 변경; 기존 로그 행은 구 네임스페이스 그대로 보존(append-only)" 명시를 추가한다.

---

### 4. **[WARNING]** 엔티티명 `ModelConfig` vs 기존 `ModelInfo` DTO — 근접 혼동 (인식됨, 강도 상향 필요)

- **target 신규 식별자**: 엔티티명 `ModelConfig` (provider 설정 테이블)
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/5-system/7-llm-client.md` lines 171–178 — `interface ModelInfo { id, name, type: 'chat'|'embedding' }` (provider listModels 응답 DTO); line 177 의 `type` 필드가 `ModelConfig.kind` 와 같은 `chat`/`embedding` 값 집합을 가짐
- **상세**: target draft 는 변경 4(Naming INFO-7)에서 이 충돌을 인식하고 Rationale 주석 추가를 제안하나, 등급을 INFO 로 분류하고 있다. 두 이름이 동일 코드 레이어(LLM 모듈)에서 공존하고 `type`/`kind` 필드 값 집합도 겹치므로 실수 가능성이 충분히 높아 WARNING 급 처리가 적절하다.
- **제안**: 변경 4 를 WARNING 급으로 격상하고, `spec/5-system/7-llm-client.md §3.5 ModelInfo` 정의 상단에도 구분 주석을 추가한다.

---

### 5. **[WARNING]** 마이그레이션 버전 V088~V092 — 동시 진행 plan 과의 선점 충돌 가능성

- **target 신규 식별자**: 마이그레이션 버전 `V088`, `V089`, `V090`, `V091`, `V092`
- **기존 사용처**: `codebase/backend/migrations/` 최신 파일 = `V087__execution_resume_call_stack.sql`. V088 이상은 현재 없음.
- **상세**: 현시점 V088 이상은 파일시스템에 존재하지 않으므로 직접 충돌은 없다. 그러나 `spec/1-data-model.md` frontmatter `pending_plans` 에 등재된 `exec-park-durable-resume.md` 등 다른 활성 plan 이 동시에 V088을 사용하는 마이그레이션을 포함할 경우 PR merge 시 renumber 충돌이 발생한다.
- **제안**: PR 착수 직전 `ls codebase/backend/migrations/ | sort | tail -5` 로 실제 최신 버전 재확인 후 V088 선점 여부를 점검한다.

---

### 6. **[INFO]** `model_config.dimension` vs `knowledge_base.embedding_dimension` — SoT vs 파생 캐시 관계 명시 필요

- **target 신규 식별자**: `model_config.dimension` (Integer?, embedding 전용 pgvector 차원 SoT)
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/1-data-model.md` §2.11 — `KnowledgeBase.embedding_dimension` (저장 청크 차원 캐시); `/Volumes/project/private/clemvion/spec/5-system/8-embedding-pipeline.md` — `embedding_dimension` 다수 참조
- **상세**: 두 필드는 이름이 다르고 스코프도 달라 충돌은 없다. 그러나 target draft 는 `ModelConfig.dimension` 이 `KB.embedding_dimension` 의 SoT 가 됨을 암묵적으로 전제하므로, 두 필드의 관계(SoT vs 파생 캐시)를 spec 에 명확히 기술해야 한다.
- **제안**: 변경 3 `spec/5-system/8-embedding-pipeline.md §5.2/§5.3` 갱신 시 "ModelConfig.dimension = 모델 고유 출력 차원(SoT), KB.embedding_dimension = 실제 저장 청크 차원 파생 캐시(재임베딩 완료 후 ModelConfig.dimension 수렴)" 관계를 1줄 명시한다.

---

### 7. **[INFO]** `kind` 컬럼 — 기존 JSONB 필드 동명, 스코프 분리로 충돌 없음

- **target 신규 식별자**: `model_config.kind` (DB 컬럼, `chat|embedding|rerank` enum)
- **기존 사용처**: `spec/1-data-model.md` — WebAuthnCredential challenge JWT 의 JSONB 필드 `kind: 'webauthn_register'|'webauthn_auth'`; AssistantMessage.tool_calls JSONB 의 `kind: 'explore'|'plan'|'edit'`; AgentMemory.metadata JSONB 의 `kind ∈ fact/preference/entity`
- **상세**: 기존 사용처는 모두 JSONB 내 동적 key 이고, target 신규 `kind` 는 실제 DB 컬럼이다. 스코프가 다르므로 실제 충돌 없음.
- **제안**: 별도 조치 불요.

---

## 요약

target draft 가 도입하는 핵심 신규 식별자(`model_config` 테이블, `ModelConfig` 엔티티, `/api/model-configs` endpoint 군)는 기존 코퍼스에 동명 충돌이 없다. 주요 위험은 세 곳에 집중된다: (1) `spec/2-navigation/_layout.md` 의 내비게이션 URL `/llm-configs` 가 갱신 목록에서 누락되어 URL↔API prefix 불일치 가능성, (2) `spec/2-navigation/6-config.md §3 API` 표의 `preview-models` endpoint 갱신 누락으로 두 spec 파일 간 endpoint 명 충돌, (3) `spec/5-system/1-auth.md` 감사 로그 액션명 `llm_config.*`/`rerank_config.*` 의 `model_config.*` 로의 대체 명시 누락. 이 세 가지를 target draft 의 변경 3 갱신 목록에 추가하면 충돌이 해소된다.

## 위험도

MEDIUM

---

*검토 기준: 신규 식별자 충돌 checker (spec draft 검토 모드)*
*검토 대상 코퍼스: `spec/`, `plan/in-progress/`, `spec/conventions/` (prompt_file 제공 corpus)*
