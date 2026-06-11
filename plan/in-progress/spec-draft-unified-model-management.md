---
worktree: unified-model-mgmt-5af7ee
started: 2026-06-10
owner: project-planner
related_plan: plan/in-progress/unified-model-management.md
---

# Spec Draft — Unified Model Management (B안 + 임베딩 1급화)

> **대상 spec (전수)**: `spec/1-data-model.md`, `spec/2-navigation/6-config.md`,
> `spec/2-navigation/5-knowledge-base.md`, `spec/data-flow/6-knowledge-base.md`,
> `spec/5-system/7-llm-client.md`, `spec/5-system/8-embedding-pipeline.md`,
> `spec/5-system/9-rag-search.md`, `spec/5-system/1-auth.md`, `spec/0-overview.md`
> 본 draft는 변경 **결정**을 담는다. consistency-check 통과 후 각 spec에 반영.
>
> **이력**: 1차 consistency-check(14_05_46) BLOCK:YES — Critical 5 + Warning 11.

---

## 변경 0 — 마이그레이션 보강 (consistency 흡수, 본문 §3 plan과 정합)

> **버전 표기 주의(Conv W#6 / Naming·Plan CRITICAL — V088 선점)**: 아래 V088~V092는 **현시점(max V087)
> 기준 예시**다. **`plan/in-progress/exec-intake-queue-impl.md` PR2b(line 51)가 `execution.queued_at` 추가에
> V088을 "확정" 표기 중 — 선점 충돌**. 구현 착수 시 `scripts/check-migration-versions.py --base origin/main`
> 으로 당시 실제 max를 확인하고 **max+1부터 순차 재할당**한다. 순서·내용은 고정, 절대 번호만 동적이며
> 어느 쪽이 먼저 merge되든 나머지가 renumber(`migrations.md §5`)한다. 두 plan은 컬럼·테이블이 겹치지 않아
> 의미 충돌은 없고 **번호만 조정** 대상이다.

- **V088** `llm_config`→`model_config` rename + `kind`(NOT NULL default `'chat'`)·`dimension`(int NULL) 추가.
- **V089** `is_default` partial unique를 `(workspace_id)` → `(workspace_id, kind)`로 재정의.
  **선행 단계(Warning #4)**: 재정의 전 기존 `is_default=true` 중복 행 정리 — workspace당 `created_at` 최신 1개만 보존, 나머지 false. (chat kind는 기존 unique로 중복 없으나, 마이그레이션 안전을 위해 멱등 정리 SQL 포함.)
- **V090** `rerank_config`→`model_config` `kind='rerank'` UUID 보존 INSERT…SELECT, KB `rerank_config_id` FK 타깃 전환.
- **V091** KB `embedding_llm_config_id` → `embedding_model_config_id` rename, distinct embedding 조합에서 `kind='embedding'` 행 파생·repoint, `dimension`을 KB `embedding_dimension`에서 채움. NOT VALID 2-step.
- **V092**(cleanup, PR4) `rerank_config` DROP, `KB.embedding_model` 문자열 컬럼 DROP(ModelConfig.default_model resolve). 데이터 일치 검증 PASS 후.
> Critical #4(PR #517 spec 충돌)는 **false positive로 반증**(PR #517은 `plan/in-progress/refactor/*.md`
> 8개만 수정, spec 0건 — `gh pr view 517 --json files`). 나머지 Critical/Warning은 본 draft에
> 전부 흡수(§아래 각 변경 + §변경 0 마이그레이션 보강 + §Consistency Resolutions).

---

## 변경 1 — `spec/1-data-model.md` §2.16 통합 ModelConfig

기존 §2.16 LLMConfig + §2.16.1 RerankConfig를 **단일 §2.16 ModelConfig**로 통합.
`llm_config`/`rerank_config` 두 테이블을 `model_config` 한 테이블로 합치고, 임베딩을 1급 row로 신설한다.

### 2.16 ModelConfig

워크스페이스가 사용하는 모든 AI 모델 설정(chat / embedding / rerank)을 `kind` 판별자로 단일 관리한다.
provider 자격증명·endpoint를 가진 리소스이며, 마스킹·SSRF 가드·secret-store transformer를 공유한다.

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| id | UUID | PK |
| workspace_id | UUID | FK → Workspace |
| **kind** | Enum | `chat` \| `embedding` \| `rerank` |
| provider | String | kind별 허용: chat=openai/anthropic/google/azure/local · embedding=openai/azure/google/local(Anthropic 제외) · rerank=tei/cohere |
| name | String | 사용자 지정 이름 |
| api_key | String? (encrypted) | API Key(암호화). 자가호스팅(local/tei)은 선택 |
| base_url | String? | 커스텀 endpoint. local/tei/azure 필수(SSRF 가드 — 사설망 예외) |
| default_model | String | 기본 모델 ID |
| default_params | JSONB | chat 전용(temperature/max_tokens 등). embedding/rerank는 미사용 |
| **dimension** | Integer? | **embedding 전용**. pgvector 차원 SoT(384/512/768/1024/1536/3072). chat/rerank는 NULL |
| is_default | Boolean | **`(workspace_id, kind)` 당 최대 1개**(partial unique) |
| created_at / updated_at | Timestamp | |

**참조 관계 (kind 의미)**

- chat: AI 노드 `config.llmConfigId`(JSONB, FK 없음), `workflow_assistant_session.llm_config_id`,
  `llm_usage_log.llm_config_id`, `knowledge_base.extraction_llm_config_id`, `knowledge_base.rerank_llm_config_id`.
- embedding: `knowledge_base.embedding_model_config_id`(신규).
- rerank: `knowledge_base.rerank_config_id`(FK 타깃이 rerank_config → model_config로 전환).

> **마이그레이션**: `llm_config`→`model_config` rename + `kind`/`dimension` 추가(V088), is_default 유니크 재정의(V089),
> rerank_config 흡수(V090), embedding 1급 파생 + KB repoint(V091), 구 테이블/컬럼 정리(V092). UUID 보존으로 chat 참조 무변경.

### §2.16.1 (삭제) RerankConfig + §2.11 KnowledgeBase FK 갱신 (Critical #2)

- §2.16.1 RerankConfig 엔티티 → §2.16 ModelConfig `kind='rerank'`로 흡수, 섹션 삭제. 기존 RerankConfig 참조 링크는 §2.16으로 갱신.
- **§2.11 KnowledgeBase 표의 FK 타깃 동시 갱신**(동일 PR0):
  - `rerank_config_id`: `FK → RerankConfig` → **`FK → ModelConfig (kind=rerank)`**.
  - `embedding_llm_config_id` → **`embedding_model_config_id` (FK → ModelConfig kind=embedding)** 로 컬럼명·타깃 동시 변경.
  - `embedding_model`(문자열) 컬럼: ModelConfig.default_model로 resolve하므로 **V092에서 DROP**(SoT 이원화 방지, Warning #5).
  - `rerank_llm_config_id`·`extraction_llm_config_id`: chat kind 참조 → 타깃이 model_config로 자동 추종(테이블 rename), 컬럼명·의미 불변.

### Rationale 추가 (§2.16 끝)

- **R: 단일 model_config 테이블 (kind 판별)** — 기존 LLMConfig/RerankConfig 분리(§2.16.1 구판)와
  embedding piggyback을 통합. chat/embedding/rerank는 "provider 자격증명 + 모델"이라는 동일 골격이고,
  마스킹·SSRF·secret-store 인프라를 이미 공유했다. API shape 차이(`/rerank` 전용 호출)는 **실행 레이어**
  관심사이지 설정 테이블을 쪼갤 이유가 아니다 — `kind`로 흡수한다. 관리 포인트(테이블 2+piggyback→1,
  설정 화면 3→1)를 실제로 제거.
- **R: 임베딩 1급화** — 기존엔 embedding이 chat용 LLMConfig를 빌려 썼다(같은 row가 역할에 따라 chat/embedding).
  embedding 모델은 **차원이라는 고유 불변속성**(pgvector 컬럼 차원과 결합)을 가지므로 1급 row가
  소유하는 것이 정합적이다. provider 클라이언트는 기존 embed 경로(openai/azure/google/local) 재사용 —
  신규 provider 추가 아님.

---

## 변경 2 — `spec/2-navigation/6-config.md` Part B+C → "Models" 통합 화면

### Part B (개정) — Models (모델 설정)

워크스페이스가 사용하는 chat·embedding·rerank 모델을 **단일 화면(탭)** 에서 관리한다.

```
┌──────────────────────────────────────────────────────────────┐
│  Config > Models          [Chat] [Embedding] [Rerank]        │
│                                          [+ Add Model]       │
│  (선택된 탭의 kind 목록을 카드로 표시. ⭐=해당 kind 기본)     │
└──────────────────────────────────────────────────────────────┘
```

- **공통 필드**: provider 유형 / 이름 / API Key(마스킹) / Base URL / 기본 모델 / ⭐기본 지정(kind별 1개).
- **Chat 탭**: 기존 LLM 설정과 동일(기본 파라미터 temperature 등, "모델 불러오기" select-only — 기존 R-1 유지).
- **Embedding 탭**: provider(openai/azure/google/local) + 모델 + **차원 표시**. KB가 이미 벡터를 가진 embedding
  config는 차원 변경 차단(재임베딩 가드 — `kb-model-change-reembed-followup` 규칙 참조).
- **Rerank 탭**: 기존 Rerank 설정과 동일(tei: Base URL 필수/API Key 선택, cohere: API Key 필수. 모델 자유 입력).

### §3 API (개정)

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET | /api/model-configs?kind=chat\|embedding\|rerank | 목록(페이지네이션, kind 필터) |
| POST | /api/model-configs | 생성(body에 kind) |
| GET | /api/model-configs/:id | 상세 |
| PATCH | /api/model-configs/:id | 수정 |
| PATCH | /api/model-configs/:id/set-default | kind별 기본 지정. **동작: 동일 `(workspace_id, kind)` 내 기존 `is_default=true`를 false로 초기화 후 대상만 true** (Naming W#11 — 기존 workspace-전체 초기화 로직을 kind 범위로 한정) |
| POST | /api/model-configs/:id/test | 연결 테스트(chat/embedding) |
| POST | /api/model-configs/preview-models | 저장 전 모델 미리보기(chat/embedding) |
| GET | /api/model-configs/:id/models | 모델 목록(chat/embedding) |
| DELETE | /api/model-configs/:id | 삭제 |

- **구 엔드포인트**: `/api/llm-configs`·`/api/rerank-configs`는 deprecation alias로 한시 유지, 후속 PR에서 제거.

### Rationale 개정 (R-3 번복)

- **R-3 (번복) — RerankConfig sibling 분리 → ModelConfig 통합**: 기존 R-3은 "리랭커는 `/rerank` 전용
  호출 shape라 LLMConfig와 분리한 sibling"이라 했다. 그러나 분리의 실익이었던 인프라(마스킹·SSRF·secret-store)는
  처음부터 공유됐고, shape 차이는 실행 레이어(`modules/llm/rerank/`)에 이미 격리돼 있다. 설정 테이블을
  쪼개 둔 결과는 **CRUD·DTO·컨트롤러·프론트 페이지·i18n 사전의 통째 중복**과 **설정 화면 분산**뿐이었다.
  `kind` 판별자 단일 테이블로 통합해 이 중복을 제거한다. shape 차이는 컨트롤러의 kind 분기로 흡수.
  (이전 합의를 뒤집는 결정 — 근거: 관리 포인트·UX 통합 이득 > shape 분리 이득.)

---

## 변경 3 — 연관 spec 참조·Rationale 갱신 (전수 목록)

각 파일에서 "RerankConfig/LLMConfig 분리" 전제와 embedding 문자열-소스 전제를 ModelConfig 통합 기준으로 갱신.

| 파일 | 갱신 내용 | 출처 finding |
| --- | --- | --- |
| `spec/5-system/8-embedding-pipeline.md §5.2/§5.3` | 임베딩 모델 소스 `KB.embedding_model` 문자열 → `kind=embedding` ModelConfig.default_model + dimension SoT. **Rationale**에 (a) 문자열→FK 전환 근거, (b) `listModels type='embedding'` 필터 → `kind='embedding'` 조회 전환 근거 추가 | Cross W-3, Rationale W-7 |
| `spec/5-system/9-rag-search.md §3.3/§3.3.2` | "RerankConfig endpoint" → "ModelConfig(kind=rerank)". **Rationale** "왜 RerankConfig를 LLMConfig와 분리" 항을 통합 근거로 갱신/폐기 | Cross INFO-2, Rationale W-6/INFO-6 |
| `spec/2-navigation/5-knowledge-base.md §2.2` | 임베딩/리랭커 select 소스를 ModelConfig(kind별) 목록으로 갱신 | Cross INFO-3 |
| `spec/5-system/7-llm-client.md` | **§4**: 팩토리 선택을 `ModelConfig.kind` 기반으로 명시 — **`LLMClientFactory`(chat/embedding)와 `RerankClientFactory`(rerank)는 분리 유지**, 설정 테이블만 통합(Critical #3). **§5.5**: `POST /api/llm-configs/preview-models` → `/api/model-configs/preview-models` 경로 명시 갱신(Critical #5, frontend `lib/api/llm-configs.ts:114` URL 갱신은 구현 대상). **§2.1** 헤딩 "리랭크 프로바이더(Planned)" → "(1차 tei/cohere 구현 완료)". **Rationale** "별개 DB 테이블이라 분리" 전제 → "테이블 통합 후에도 API shape 차이로 RerankClient 분리 유지" | Critical #3/#5, INFO-4/5 |
| `spec/5-system/1-auth.md §3.2` | RBAC 매트릭스 `rerank_config` 행 → `model_config`(kind=rerank) 갱신. mutation Editor+/조회 Viewer+ 유지 | Plan W-9 |
| `spec/0-overview.md §6.1` | 구현 완료 목록 "RerankConfig·LLMConfig" → "ModelConfig(chat/embedding/rerank 통합)" 동기화 | Cross INFO-1 |
| `spec/data-flow/6-knowledge-base.md §1.1/§1.2/§2` (4곳) | `embedding_llm_config_id` 참조(line 37/73/117/163) → `embedding_model_config_id`. 임베딩 모델 소스 설명을 ModelConfig 기반으로 갱신 | Cross #1, Naming #10 |

## 변경 4 — Rationale 명명 충돌 주석 (Naming INFO-7)

`ModelConfig`(provider 설정 엔티티) vs 기존 `ModelInfo`(모델 목록 조회 DTO) 근접 혼동 방지 — 데이터 모델/llm-client Rationale에 "ModelConfig=저장된 provider 설정, ModelInfo=provider listModels 응답 항목" 1줄 구분 명시.

## Consistency Resolutions (1차 BLOCK:YES 대응 기록)

| finding | 처리 |
| --- | --- |
| **C#1** KB embedding FK 명칭 충돌 + data-flow 누락 | `embedding_model_config_id`로 통일, `spec/data-flow/6-knowledge-base.md`(4곳) 변경 목록 추가(변경 3) |
| **C#2** §2.11 rerank_config_id FK 타깃 모순 + §2.16.1 삭제 | §2.16.1 삭제 절에 §2.11 FK 갱신 동시 명시(변경 1) |
| **C#3** 팩토리 분리 vs 단일 테이블 계층 불명확 | 7-llm-client §4: 팩토리는 kind로 선택·분리 유지, 테이블만 통합(변경 3) |
| **C#4** PR #517 spec 동시수정 | **false positive 반증** — PR #517 plan-only(spec 0건). 선결 조건 아님 |
| **C#5** preview-models 경로 미반영 | 7-llm-client §5.5 경로 갱신 + frontend URL 구현 대상 명시(변경 3) |
| **W#4** V089 is_default 중복행 | 마이그레이션 V089에 중복 정리 단계 추가(변경 0) |
| **W#5** KB.embedding_model 존속 | V092에서 DROP, ModelConfig.default_model resolve(변경 1·0) |
| **W#8** 차원변경차단 범위 | `kb-model-change-reembed-followup` 정책 선택지를 따름(중복 정의 금지), 본 plan은 가드 "존재"만 선언 |
| **W#11** set-default kind 범위 | API 동작 명시: 동일 `(workspace_id, kind)` 내 기존 기본값 초기화 후 지정(변경 2 §3) |
| 그 외 W/INFO | 변경 3 전수 목록 + 변경 0/2/4에 흡수 |

## 변경 6 — 2차 consistency WARNING/INFO 흡수

> 2차 검토(14_18_37) BLOCK:YES의 유일 CRITICAL은 draft frontmatter 누락(해소 완료). 이하 WARNING/INFO 전수 흡수.

### 6-A. FK 타깃 텍스트 relabel (Cross W#1·W#2) — "데이터 정합하나 spec 텍스트가 거짓" 방지

테이블 rename 후에도 spec **본문 텍스트**가 `FK → LLMConfig`로 잔존하면 거짓이 된다. 변경 3에 다음 텍스트 갱신 추가:

| 파일 | 위치 | 갱신 |
| --- | --- | --- |
| `spec/1-data-model.md` | §2.11 `rerank_llm_config_id`·`extraction_llm_config_id` | `FK → LLMConfig` → **`FK → ModelConfig (kind=chat)`** |
| `spec/1-data-model.md` | §2.20 `AssistantSession.llm_config_id` | 동일 relabel |
| `spec/1-data-model.md` | `llm_usage_log.llm_config_id` 기술 | 동일 relabel |
| `spec/1-data-model.md` | §1 ASCII ERD (INFO-1) | `LLMConfig`/`RerankConfig` 2행 → `ModelConfig (1:N)` 단일 행 |

### 6-B. 하위 Rationale 대체 문안 (Rationale W#8·W#9·W#10) — 전제 소실 방지, 실제 문안 제시

- `spec/5-system/7-llm-client.md ## Rationale` "왜 LLMClientFactory에 통합하지 않았나" 항 → **대체 문안**:
  "ModelConfig 단일 테이블로 설정은 통합됐으나, rerank 호출은 입력 `(query, docs[])`·출력 score 배열·스트리밍 부재로
  chat/embedding과 API shape가 다르다. 따라서 `RerankClientFactory`는 분리 유지하고, `ModelConfig.kind`로 팩토리를 선택한다."
- `spec/5-system/9-rag-search.md ## Rationale` "왜 RerankConfig를 LLMConfig와 분리했나" 항 → **대체 문안**:
  "설정 테이블은 ModelConfig(kind=rerank)로 통합. 단 검색 후처리 호출 계약은 별도 RerankClient 유지(shape 차이)."
  (노드 단위 리랭크 설정 기각 항(INFO-7)은 통합과 무관하므로 그대로 보존.)
- `spec/5-system/8-embedding-pipeline.md ## Rationale` (V021 결정 항) → **추가 문안**:
  "`kind='embedding'` ModelConfig 1급화로 `listModels type='embedding'` 필터가 불필요해지고(소스가 이미 embedding kind),
  차원 SoT를 ModelConfig.dimension으로 일원화한다."

### 6-C. 감사 로그 액션명 (Cross W#5, Naming W#13)

- 변경 3에 `spec/5-system/1-auth.md §4.1` 추가: 감사 로그 액션 `llm_config.*`/`rerank_config.*` → **`model_config.*`**
  (`create`/`update`/`delete`/`set-default`). 과거 기록은 append-only 보존(기존 액션명 row는 그대로, 신규만 `model_config.*`).

### 6-D. 내비게이션·API SoT 동기화 (Cross W#3, Naming W#11·W#12)

- `spec/2-navigation/_layout.md` 항목 7 URL `/llm-configs` → **`/models`** (rerank 항목은 탭 통합으로 제거).
- `spec/2-navigation/6-config.md §3` API 표를 `/api/model-configs` **SoT로 교체**, 구 `/api/llm-configs`·`/api/rerank-configs`
  (서브경로 `preview-models`·`models`·`test`·`set-default` 포함) 행에 deprecation 주석 + **제거 시점 = 본 plan PR4** 명시.

### 6-E. set-default 동사형 경로 (Conv W#7)

- `PATCH /api/model-configs/:id/set-default`는 **기존 spec(LLMConfig·RerankConfig)의 선례 패턴 유지**임을 draft·spec에 1줄 명시
  (신규 명사형 `/default` 도입 시 기존 2개 엔드포인트와 불일치 → 일관성 위해 기존 동사형 계승). 결정: 기존 패턴 유지.

### 6-F. ModelConfig vs ModelInfo (Naming W#14 — INFO→WARNING 격상)

- 변경 4를 **WARNING급**으로 격상. `spec/5-system/7-llm-client.md §3.5 ModelInfo` 정의 상단 + 데이터모델 §2.16에
  구분 주석: "**ModelConfig** = 저장된 provider 설정 엔티티(DB) / **ModelInfo** = provider `listModels` 응답 항목(DTO)".

### 6-G. INFO 잔여

- `spec/data-flow/6-knowledge-base.md §2.1` 마이그레이션 참조 V029 → V091 갱신.
- `model_config.dimension`(모델 고유 출력 차원, **SoT**) vs `knowledge_base.embedding_dimension`(**파생 캐시**) 관계를
  `8-embedding-pipeline.md §5.2`에 1줄 명시.
- `/api/model-configs/:id/test`가 chat/embedding만 지원(rerank 연결 테스트 미제공)은 기존 R-3 정책 유지 — 변경 2 비고에 주석.
- §5.5 경로 갱신 시 보안 계약(SSRF 가드·rate limit·apiKey 미로깅) 동일 유지 1줄 명시.

## 변경 7 — 3차 consistency WARNING/INFO 흡수

- **auth §3.2 RBAC 표(Cross W#1)**: `Rerank Config` 행 제거 + `LLM Config` 행 → **`Model Config`(kind=chat/embedding/rerank) 단일 행** 통합. (변경 3 auth 범위 확장.)
- **`_layout.md §2.2` 항목 7(Cross W#2)**: URL `/llm-configs`→`/models` + **레이블 "LLM Config"→"Models"**, rerank 항목 제거(탭 통합). (변경 6-D 보강.)
- **`5-knowledge-base.md §2.2`(Cross W#3)**: 기존 `Part C` 링크(line 64/68) → **`Config > Models > Rerank 탭` 참조로 교체**(dead link 방지). (변경 3 범위.)
- **deprecation 제거 시점 통일(Cross W#4)**: 변경 2 §3의 "후속 PR에서 제거" → **"PR4에서 제거(변경 6-D SoT 참조)"**로 표현 통일.
- **auth §4.1 액션명 정책 인라인(Cross W#5, Naming W#10)**: spec 본문에 "신규 이벤트는 `model_config.*`; 기존 `llm_config.*`/`rerank_config.*` 행은 **append-only 보존**; 감사 쿼리는 두 세트를 **OR 결합**" 명시.
- **`/models` redirect 정책(Naming W#11)**: 변경 6-D에 `/llm-configs`·`/rerank-configs` → `/models` **클라이언트 redirect(북마크 보존)** 명시. (SPA 라우트라 301 대신 프론트 redirect.)
- **`7-llm-client.md` line 311(Naming W#12)**: `GET /api/llm-configs/:id/models` → `/api/model-configs/:id/models` 본문 경로도 변경 3 범위에 포함.
- **`6-config.md Part C` 본문(Cross INFO-7)**: 기존 Part C(Rerank) 섹션은 **Part B(Models 통합 화면)로 흡수·대체, Part C 헤딩 삭제**.
- **dimension SoT 명시(Naming INFO-14)**: `§2.16 ModelConfig` 표 `dimension` 설명에 "**SoT**. `KB.embedding_dimension`은 파생 캐시" 1줄 추가. `8-embedding-pipeline §5.3` 차원 표에 "ModelConfig.dimension이 SoT, 본 표는 참고" 주석.
- **타입 export(Naming INFO-15)**: 구현 시 `ModelConfigKind = 'chat'|'embedding'|'rerank'` 명시 export(JSONB discriminator `kind`와 혼용 방지) — 구현 plan에 기재.
- **rationale_continuity fatal**: 3차에서 해당 checker 산출 실패(재시도 필요) — 1차·2차에서는 정상 수행됐고 R-3 번복 형식요건 충족 확인 완료. 본 draft가 1·2차 rationale 지적(대체 문안)을 6-B로 이미 흡수.

## False Positive 기록 (반증 완료)

- **Plan W#8 `related_plan` dead link**: `plan/in-progress/unified-model-management.md`는 worktree에 **실재**(11KB). checker가 origin/main 기준 비교한 main-baseline FP(메모리 known 패턴).
- **Critical(1차 #4) PR #517 spec 충돌**: PR #517은 plan-only(spec 0건). 반증 완료.

## 인접 plan 조정 (side-effect, 구현 PR 단계)

- `plan/in-progress/exec-intake-queue-impl.md` PR2b V088 — 본 작업과 번호 선점. 먼저 merge되는 쪽이 V088, 나머지 renumber(의미충돌 없음).
- `plan/in-progress/rag-rerank-followup.md` 전 항목 `[x]` 완료이나 미이동 — 본 작업 landing 시 `plan/complete/`로 이동 권장(plan_coherence W#7).
- `plan/in-progress/kb-model-change-reembed-followup.md` §배경 — embedding 1급화 landing 후 `embedding_model_config_id` 기준으로 갱신 필요.

## 영향 없음(확인)

- AI 노드 `config.llmConfigId` 문자열·chat-kind FK(노드/assistant/usage_log/extraction/rerank_llm): UUID 보존으로 데이터 무변경(단, spec 본문 FK 텍스트는 6-A로 relabel).
- AuthConfig(Part A): 본 작업 범위 밖, 보존.
- `spec-sync-config-gaps.md`의 Auth gap(IP Whitelist/Header 미구현): Part A 영역이라 본 개정과 비충돌.
- PR #517(refactor 백로그 plan): plan-only, spec 비충돌.
