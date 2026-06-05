---
id: agent-memory
status: partial
code:
  - codebase/backend/src/modules/agent-memory/**
pending_plans:
  - plan/in-progress/ai-context-memory-followup-v2.md
  - plan/in-progress/agent-memory-admin-ui.md
  - plan/in-progress/agent-memory-summary-model.md
---

# Spec: Agent Memory (AI Agent 세션 간 영속 메모리)

> 관련 문서: [Spec AI Agent](../4-nodes/3-ai/1-ai-agent.md) · [Spec AI 공통 §10](../4-nodes/3-ai/0-common.md#10-conversation-context-자동-컨텍스트-주입) · [Spec Conversation Thread](../conventions/conversation-thread.md) · [Spec 임베딩 파이프라인](./8-embedding-pipeline.md) · [Spec RAG 검색](./9-rag-search.md) · [데이터 모델 §2.23](../1-data-model.md#223-agentmemory)

---

## Overview (제품 정의)

AI Agent 노드의 `memoryStrategy: 'persistent'` 전략은 한 실행(세션) 을 넘어 사용자/대화에 관한 **사실·선호** 를 추출해 영속하고, 다음 호출에서 의미검색으로 회수해 LLM 컨텍스트에 주입한다. 챗봇·어시스턴트 시나리오에서 (1) 윈도우 밖으로 밀려난 초기 정보의 완전 소실, (2) 세션이 바뀌면 사용자를 매번 처음 보는 듯한 단절 — 두 문제를 해소한다.

`summary_buffer` (단일 실행 내 토큰예산 롤링 요약) 가 working-memory 압축이라면, `persistent` 는 그 working-memory 동작을 포함(superset)하면서 **세션 간 추출 메모리 레이어** 를 추가한다. Mem0/Zep 형 추출·회수 패턴을 KB/RAG 인프라(pgvector) 재사용으로 구현한다.

본 문서는 persistent 메모리 저장소(테이블 `agent_memory`)·스코프 키·추출/회수 파이프라인·forgetting 의 단일 진실 공급원이다. 노드 설정 필드(`memoryStrategy`/`memoryTokenBudget`/`memoryKey`/`memoryTopK`/`memoryThreshold`)와 실행 단계 배치는 [Spec AI Agent §1·§6.1](../4-nodes/3-ai/1-ai-agent.md#1-설정-config) 가 SoT.

---

## 1. 데이터 모델

저장소는 신규 테이블 `agent_memory` ([데이터 모델 §2.23](../1-data-model.md#223-agentmemory) 단일 진실). pgvector 확장을 `DocumentChunk` ([데이터 모델 §2.12.1](../1-data-model.md#2121-documentchunk)) 와 동일하게 재사용하되, KnowledgeBase 와는 분리된 별도 테이블이다.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | UUID | PK |
| `workspace_id` | UUID | FK → Workspace (CASCADE). 회수·추출·evict 모두 본 컬럼으로 필터 (격리 의무, §5) |
| `scope_key` | String | 메모리 네임스페이스 키 (§2) — `memoryKey` 평가값 또는 `execution_id` |
| `content` | Text | 추출된 사실/선호 텍스트 (회수 시 LLM 컨텍스트로 주입) |
| `embedding` | Vector | `content` 임베딩 (pgvector — `DocumentChunk.embedding` 과 동일 확장·차원 정책, [Spec 임베딩 파이프라인](./8-embedding-pipeline.md)) |
| `metadata` | JSONB | `{ source_node_id?, source_execution_id?, kind?, … }` — 추출 출처·분류 메타. `kind ∈ fact/preference/entity` (§3 추출 분류, AGM-11) |
| `created_at` | Timestamp | 추출 시각 (forgetting evict 기준, §4) |
| `updated_at` | Timestamp | 마지막 갱신 시각 (의미 dedup UPDATE 시 `now()` 로 갱신, §4 AGM-09) |
| `expires_at` | Timestamp? | TTL 만료 시각 (nullable, 디폴트 NULL=무만료). `memoryTtlDays` set 시 `now() + ttlDays`. recall 은 미만료만, evict 는 만료 row 삭제 (§4 AGM-10) |

**인덱스**: `(workspace_id, scope_key, created_at)` (스코프별 회수·FIFO/LRU evict — `created_at` 을 포함해 evict 정렬을 인덱스로 커버, V073) + pgvector partial 인덱스(`embedding`, `DocumentChunk` 와 동일 차원별 partial HNSW/IVFFlat 정책) + `expires_at` partial 인덱스(`WHERE expires_at IS NOT NULL` — TTL evict 만료 스캔 가속, V080) + `(workspace_id, scope_key, updated_at)` 인덱스(admin scope 목록 `GET /agent-memories/scopes` 의 `MAX(updated_at)` 정렬 index-only 커버 — created_at 인덱스와 직교, CONCURRENTLY V086). [데이터 모델 §3](../1-data-model.md#3-인덱스-전략).

임베딩 차원·모델은 KB 인프라(`EmbeddingService`)를 재사용한다 — embedding 생성·차원 관리 로직을 중복 구현하지 않는다. 사용할 **임베딩 모델**은 AI Agent 노드 config 의 `embeddingModel` 필드로 유저가 선택하며(미지정 시 워크스페이스 기본 → 최후 하드코딩 기본으로 폴백), 회수와 추출(저장)이 항상 같은 모델을 쓴다 (차원 일치 — §3 임베딩 출처). `agent_memory` 에 전용 임베딩 모델 컬럼은 두지 않는다.

> 요구사항 `AGM-01` — `agent_memory` 테이블(pgvector 재사용, KB 분리). `AGM-02` — `(workspace_id, scope_key, created_at)` scope 인덱스(회수·evict 정렬 커버) + `(workspace_id, scope_key, updated_at)` 인덱스(admin scope 목록 MAX(updated_at) 정렬 커버, V086) + pgvector 인덱스.

## 2. 스코프 키

메모리 네임스페이스는 **`(workspace_id, scope_key)`** 2-튜플이다. `scope_key` 는:

- **AI Agent 노드 `memoryKey` (Expression) 가 평가되어 truthy** 면 그 값 → **세션 간 영속(개인화)**. 같은 key 를 쓰는 후속 실행이 같은 메모리를 회수.
- **`memoryKey` 미설정/빈값** 이면 `execution_id` fallback → **세션 단위 격리** (cross-session 누적 없음 — 안전 디폴트).

`workspace_id` 는 항상 필수 필터다 (사용자가 `memoryKey` 를 어떻게 주든 워크스페이스 경계를 넘지 못한다, §5).

> 요구사항 `AGM-03` — 스코프 키 resolve: `memoryKey ?? execution_id`, 항상 `workspace_id` 와 결합.

## 3. 추출 파이프라인 (턴 경계 비동기)

`persistent` 전략에서 **턴 경계마다 비동기 background** 로 직전 turn(들)에서 추출할 사실/선호를 LLM 으로 추출해 `agent_memory` 에 저장한다.

- **비동기 (hot path 비차단)**: 추출 LLM 콜을 응답 latency 에 얹지 않는다 — 사용자는 추출 완료를 기다리지 않는다. 회수(§4)만 동기, 추출은 비동기.
- **격리 invariant**: 기존 `scheduleBackgroundBody` 계열 background 실행 패턴을 따르며, **turns snapshot 의 shallow-copy 격리 invariant** 를 준수한다 — background 작업이 보는 turn 스냅샷이 이후 메인 루프의 turn 변경에 오염되지 않도록 한다.
- **추출(LLM) 모델**: AI Agent 노드 config 의 `extractionModel` (미설정 시 노드 `model` → LLMConfig 기본) 을 사용한다 — fallback 체인 `extractionModel → model → llmConfig.defaultModel`. `extractionModel` 미설정 시 기존 동작(노드 `model` 재사용) 이 100% 유지된다. `llmConfigId` (provider/credential) 는 노드 것을 그대로 재사용 (모델 ID 만 분리, provider 분리 아님). 추출은 메인 추론보다 단순한 작업이라 저비용 모델 지정으로 비용을 줄일 수 있다 ([Spec AI Agent §12.12](../4-nodes/3-ai/1-ai-agent.md#1212-요약추출-전용-llm-모델-옵션-summarymodel--extractionmodel)).
- **임베딩 모델 출처 (임베딩 출처)**: 저장 임베딩과 회수(§4) 임베딩은 **반드시 같은 모델**을 써야 한다 (차원·endpoint 일치 — 불일치 시 cosine 검색이 무의미하거나 400 에러). 모델 출처 우선순위는 ① AI Agent 노드 config 의 `embeddingModel` 필드(유저가 노드에서 직접 선택) → ② 미지정 시 워크스페이스 기본 LLMConfig 의 임베딩 모델(`EmbeddingService`/`LlmService.resolveConfig` 해석) → ③ 그 외 모두 미지정 시 최후 하드코딩 기본(`text-embedding-3-small`). `embeddingModel` 은 노드 config → 회수 호출 + 추출 enqueue payload(`embeddingModel`) → processor → `saveMemories` 로 동일하게 전달돼 회수·저장이 동일 모델을 보장한다. `agent_memory` 에 전용 `llm_config`/`embedding_model` 컬럼은 두지 않는다 (노드 config 필드로 충분).
- **저장 shape**: 추출된 각 사실/선호를 `content` 로, embedding 을 `EmbeddingService` 로 생성해 스코프 키와 함께 저장. `metadata.kind` 로 분류 (아래 추출 분류).

**증분 추출 (watermark, AGM-08)**: 멀티턴은 매 turn 전체 thread 를 재추출하지 않고 직전 추출 이후 새로 추가된 turn 만 추출한다. 멀티턴 `_resumeState.lastExtractionTurnSeq` 가 직전 추출이 커버한 마지막 turn 의 `seq` 를 watermark 로 영속하며, 각 turn 경계에서 `seq > lastExtractionTurnSeq` 인 turn 만 snapshot 해 enqueue 하고 그 최대 seq 로 watermark 를 전진시킨다 (신규 turn 0개면 enqueue skip). single-turn 은 1회 추출이라 전체 turn 을 snapshot (watermark 무관). 멀티턴 누적 thread 에서 동일 초기 turn 을 매 turn 재추출하던 중복 LLM 콜·중복 저장을 제거한다.

**추출 분류 (kind, AGM-11)**: 추출 프롬프트는 각 항목을 `{content, kind}` JSON 객체로 반환하게 한다 (`kind ∈ fact/preference/entity`). 파서는 객체 `{content, kind}` 와 문자열(구 shape) 을 모두 수용하며, kind 결손/미지원 값은 `fact` 로 fallback (안전 디폴트). 분류값은 `metadata.kind` 로 저장돼 회수·가시화 시 사실/선호/개체를 구분한다 (기존 hardcoded `fact` 대체).

**큐 분리**: 추출 작업은 기존 background body 실행 경로 위에서 동작한다. 전용 BullMQ 큐를 별도 분리할지는 구현 시점 부하 특성에 따라 결정 — v1 은 추출이 hot path 비차단인 점이 핵심 invariant 이고, 큐 토폴로지(공용 vs 전용)는 그 invariant 를 지키는 한 구현 재량이다. 전용 큐 분리 시 워크스페이스별 동시성 제한을 둘 수 있다.

> 요구사항 `AGM-04` — 턴 경계 비동기 추출(`scheduleBackgroundBody` snapshot 격리 준수, 추출 모델 = `extractionModel ?? 노드 model ?? llmConfig 기본`). `AGM-08` — 증분 추출(멀티턴 `lastExtractionTurnSeq` watermark, `seq` 초과 turn 만 snapshot). `AGM-11` — 추출 분류(`{content, kind}`, kind ∈ fact/preference/entity, fallback `fact`).

## 4. 회수 (top-k, 동기) + forgetting

**회수 (LLM 호출 전 동기)**: 스코프 키 `(workspace_id, scope_key)` 안에서 현재 대화 컨텍스트를 쿼리로 top-k 의미검색(`memoryTopK` 결과 수, `memoryThreshold` 최소 유사도)을 동기 수행해, 회수된 `content` 를 **systemPrompt 안정 프리픽스** 에 주입한다 ([Spec AI 공통 §11.4](../4-nodes/3-ai/0-common.md#114-주입-위치-및-ordering) ordering [5a]). 회수는 hot path 동기 — 정확한 컨텍스트가 LLM 호출 시점에 있어야 하기 때문. 회수 건수는 `meta.memory.recalledCount` 로 echo.

`memoryTopK`/`memoryThreshold` 는 **persistent 메모리 회수 전용** 이며 KB 검색용 `ragTopK`/`ragThreshold` ([Spec RAG 검색](./9-rag-search.md)) 와 **독립** — 검색 대상이 다르다(`agent_memory` vs KnowledgeBase). 기본값은 RAG 정합을 위해 동일(`5` / `0.7`)하나 별도 필드다.

회수 쿼리 임베딩은 추출(저장)과 **같은 임베딩 모델 출처**(노드 config `embeddingModel` → 워크스페이스 기본 → 하드코딩 기본)를 써 차원이 일치해야 한다 (§3 임베딩 출처). 회수 쿼리 텍스트는 현재 사용자 메시지(`userPrompt`)이며, 빈 값(systemPrompt-only 실행)일 때는 systemPrompt 본문으로 fallback 해 회수가 무음 no-op 가 되지 않게 한다.

회수 SQL 은 만료 row 를 제외한다 — `(expires_at IS NULL OR expires_at > now())` 필터 (TTL, 아래 AGM-10).

**의미기반 dedup/갱신 (Mem0 식, AGM-09)**: 저장(`saveMemories`) 시 무조건 INSERT 하지 않고, 각 신규 fact 의 임베딩으로 같은 `(workspace_id, scope_key)` 안에서 cosine 유사도 ≥ `MEMORY_DEDUP_SIMILARITY = 0.85` 인 기존 fact 를 탐색한다 (회수 cosine SQL 재사용, `LIMIT 1`). 있으면 그 row 를 **UPDATE**(content/embedding/metadata/`updated_at=now()`; `expires_at` 은 **`ttlDays`(노드 `memoryTtlDays`) 가 제공된 경우에만** `now() + ttlDays` 로 재설정하고, 미제공 시 기존 `expires_at` 을 보존한다 — 갱신이 기존 TTL 을 의도치 않게 연장/삭제하지 않도록), 없으면 INSERT. 같은 batch 안의 신규 fact 간 중복도 in-memory cosine 으로 방지한다(직전 처리한 fact 와 유사하면 그 row 재갱신). 임계 0.85 는 회수 기본 0.7 보다 보수적으로 높여 "관련은 있으나 다른 사실" 은 별도 저장하고 "사실상 같은 사실" 만 최신화한다. dedup 탐색 실패(미지원 차원/에러)는 graceful 하게 INSERT 로 진행(저장 경로를 막지 않음).

**TTL 만료 (AGM-10)**: 노드 config `memoryTtlDays`(Integer, optional, 미설정=무만료) 가 set 되면 저장 시 `expires_at = now() + ttlDays` 를 채운다. 값은 노드 config → enqueue payload(`ttlDays`) → processor → `saveMemories` 인자로 전달된다. 회수는 미만료 row 만 반환하고(위), evict 는 만료 row 를 먼저 삭제(`DELETE … WHERE expires_at < now()`) 한 뒤 FIFO/LRU 를 적용한다.

**forgetting (FIFO/LRU)**: 위 만료 정리 후 `(workspace_id, scope_key)` 당 최신 `AGENT_MEMORY_MAX_PER_SCOPE = 1000` 건만 보존한다. 초과 시 `created_at` 오래된 순으로 evict — `ConversationThread` 의 `STORAGE_MAX_TURNS` evict 패턴과 동형.

> 요구사항 `AGM-05` — 동기 top-k 회수(`memoryTopK`/`memoryThreshold`, KB 와 독립), 안정 프리픽스 주입, 만료 row 제외. `AGM-06` — scope 당 최신 N=1000 FIFO/LRU evict. `AGM-09` — 의미기반 dedup/갱신(`MEMORY_DEDUP_SIMILARITY=0.85`, 유사 시 UPDATE). `AGM-10` — TTL 만료(`expires_at`/`memoryTtlDays`, recall 필터·evict 삭제).

## 5. 격리 의무

모든 회수·추출·evict 쿼리는 **`workspace_id` 필터를 강제** 한다 (전 엔티티 공통 패턴). `memoryKey` 는 사용자 제어 표현식이므로 그 자체로 워크스페이스 경계를 넘는 키를 만들 수 없어야 한다 — 키는 항상 `(workspace_id, scope_key)` 로 결합되며 `workspace_id` 는 execution context 의 권위 값에서만 온다 (사용자 입력 불가).

> 요구사항 `AGM-07` — 모든 메모리 접근은 `workspace_id` 격리 강제 (cross-workspace 누수 차단).

## 6. 메모리 관리 API (조회·삭제, admin surface)

누적된 persistent 메모리를 워크스페이스 멤버가 점검·정리하는 read/delete REST surface. 저장·회수·forgetting (§3·§4) 와 별개의 관리 경로이며, 모든 라우트는 `workspace_id` 격리(§5)를 강제한다 — `workspace_id` 는 인증 미들웨어가 주입하는 워크스페이스 컨텍스트에서만 오고 쿼리/바디로 받지 않는다.

| 메서드 · 경로 | 설명 | 인가 |
|---|---|---|
| `GET /agent-memories/scopes` | 워크스페이스의 distinct `scope_key` 목록 — 각 scope 의 메모리 건수와 최신 `updated_at`. 페이지네이션(`limit`/`offset`), `q` 로 `scope_key` 부분일치 필터. | 워크스페이스 멤버(viewer+) |
| `GET /agent-memories` | 단일 scope 의 메모리 행 — `scopeKey`(필수), `kind`(옵션 `fact`/`preference`/`entity` 필터), `limit`/`offset`. `created_at` 내림차순. | 워크스페이스 멤버(viewer+) |
| `DELETE /agent-memories/:id` | 단건 삭제 (204 No Content). | editor+ |
| `DELETE /agent-memories?scopeKey=` | 한 scope 의 메모리 전체 삭제 (204) — `scopeKey` 필수. | editor+ |

- **embedding 제외**: 조회 응답은 `id`·`content`·`kind`(`metadata.kind`)·`scopeKey`·`createdAt`·`updatedAt`·`expiresAt` 만 노출한다. 임베딩 벡터는 대용량이며 가시화에 불필요하므로 반환하지 않는다.
- **hard delete**: 삭제는 soft delete 가 아니라 forgetting(§4) evict 과 동형의 영구 삭제다. 메모리는 본디 evict 대상(추출 사실, scope 당 1000 FIFO)이라 KB 문서와 달리 복구를 보장하지 않는다.
- **격리**: 단건 삭제도 `WHERE id = $1 AND workspace_id = $ws` 로 워크스페이스 교차 삭제를 차단한다 (다른 워크스페이스의 `id` 를 알아도 삭제 불가 → 404).
- **페이지네이션(scopes)**: `GET /agent-memories/scopes` 의 `total` 은 `LIMIT/OFFSET` 적용 전 전체 distinct `scope_key` 수다(단일 쿼리 `COUNT(*) OVER()`). `offset` 이 전체 수를 초과해 반환 행이 0개면 `total` 은 `0` 으로 보고된다 — UI 는 첫 페이지의 `total` 범위 안에서만 페이지하므로 무해하다.

> 요구사항 `AGM-12` — scope별 메모리 조회 API (`GET /agent-memories/scopes`, `GET /agent-memories`). `workspace_id` 격리, embedding 응답 제외, `kind` 필터.
> 요구사항 `AGM-13` — 메모리 삭제 API (`DELETE /agent-memories/:id` 단건, `DELETE /agent-memories?scopeKey=` scope 전체). editor+ 권한, hard delete, 워크스페이스 교차 차단.

UI surface (사이드바·페이지·삭제 확인 모달) 는 [Spec 내비게이션 §Agent Memory](../2-navigation/16-agent-memory.md) 가 SoT.

## 7. v2 로드맵

**실현됨 (v2)** — 아래 항목은 구현 완료 (§3·§4·§6 본문이 SoT):

- ~~**증분 추출**~~: ✅ 멀티턴 watermark(`lastExtractionTurnSeq`) 로 신규 turn 만 추출 (AGM-08, §3).
- ~~**TTL 기반 만료**~~: ✅ `expires_at` + `memoryTtlDays` 노드 config, recall 필터·evict 삭제 (AGM-10, §4).
- ~~**구조화 dedup·갱신**~~: ✅ 의미기반 dedup(`MEMORY_DEDUP_SIMILARITY=0.85`, 유사 시 UPDATE) — 같은 사실의 최신화 (AGM-09, §4).
- ~~**추출 분류**~~: ✅ fact / preference / entity 의 `{content, kind}` 구조화 분류 (AGM-11, §3).
- ~~**메모리 가시화 UI**~~: ✅ 워크스페이스 멤버가 scope 별 메모리를 조회/삭제하는 admin surface (AGM-12/13, §6; UI [내비 §Agent Memory](../2-navigation/16-agent-memory.md)).

**남은 로드맵**:

- **사용자 식별자 연동**: 최종사용자 식별자(웹채팅 인증/세션) 도입 시 `memoryKey` 디폴트를 익명 `execution_id` 가 아닌 사용자 ID 로 승격하는 경로.

---

## Rationale

### 스코프 키 설계 (`memoryKey ?? execution_id`)

**문제**: 세션 간 메모리는 "누구의 메모리인가" 를 식별하는 키가 필요하다. Mem0/Zep 은 caller-supplied `user_id` 를 받는다. 그러나 현재 제품에는 최종사용자 식별자가 부재하다 — 웹채팅 v1 은 익명이고, `Execution.executed_by` 는 워크플로를 만든 로그인 빌더지 대화 상대(최종사용자) 가 아니다.

**결정**: caller-supplied 패턴을 따르되 **표현식 필드 `memoryKey`** 로 노출한다. 빌더가 자신의 데이터(예: 외부 시스템의 고객 ID, 세션 토큰)를 표현식으로 주입하면 세션 간 개인화가 되고, 주입하지 않으면 `execution_id` 로 **세션 단위 격리** 가 안전 디폴트가 된다 (cross-session 누적이 일어나지 않아 사용자 간 메모리 누수가 구조적으로 불가능). 익명 디폴트가 "기억 없음" 이 아니라 "이 실행 안에서만 기억" 이라 summary_buffer 의 working-memory 와 자연 연속된다. 식별자 인프라가 생기면 디폴트를 사용자 ID 로 승격(v2)하면 되고, 그때까지 안전한 격리를 보장한다.

### pgvector 재사용 vs 별도 벡터DB 기각

**결정**: 별도 벡터 데이터베이스(Pinecone/Weaviate/Qdrant 등) 를 도입하지 않고 기존 PostgreSQL pgvector 인프라(`EmbeddingService`, RAG 검색 경로) 를 재사용한다.

**근거**: (1) KB/RAG 가 이미 pgvector 위에 구축돼 임베딩 생성·차원 관리·유사도 인덱스 운영 노하우가 한 스택에 있다 — 메모리만 별도 벡터DB 로 분리하면 운영 표면·장애 지점·일관성 경계가 2배가 된다. (2) 메모리 규모(scope 당 ≤1000 건)는 pgvector partial 인덱스로 충분하다 — 전용 벡터DB 의 대규모 ANN 최적화가 필요한 규모가 아니다. (3) `workspace_id` 격리·트랜잭션·백업이 메인 DB 와 동일 경계 안에서 자연히 보장된다. KB 와 같은 테이블이 아니라 **별도 테이블** 로 둔 이유는 회수 대상·생명주기·forgetting 정책이 KB(문서 청크, 영구) 와 메모리(추출 사실, evict 대상) 가 다르기 때문이다 — 재사용은 인프라(pgvector) 레벨이지 테이블 레벨이 아니다.

### 증분 추출 watermark (AGM-08)

**문제**: 멀티턴은 `ConversationThread` 에 turn 을 누적한다. 턴 경계마다 전체 thread 를 추출 LLM 에 넘기면 (1) 동일한 초기 turn 을 매 turn 재추출하는 중복 LLM 콜이 turn 수에 비례해 증가하고, (2) 같은 사실이 반복 추출돼 저장 경로(이제 dedup 이 있지만)와 임베딩 콜에 불필요한 부하를 준다.

**결정**: `_resumeState.lastExtractionTurnSeq` 를 watermark 로 두고 `seq` 초과 turn 만 snapshot 한다. ConversationTurn 의 `seq` 는 단조 증가하므로(conversation-thread §3.2) watermark 비교만으로 "직전 추출 이후 새 turn" 을 결정적으로 가른다. single-turn 은 1회성이라 watermark 가 무의미해 전체 추출을 유지한다 — 분기 없이 "watermark 없으면 전체" 규칙으로 통일된다. watermark 는 추출이 실제 enqueue 된 snapshot 의 최대 seq 로만 전진하므로(신규 0개면 skip + 불변), 추출 enqueue 와 watermark 가 원자적으로 정합한다.

### 의미기반 dedup 임계 0.85 (AGM-09)

**문제**: 정확일치 dedup(기존)은 "계정 등급은 gold" 와 "사용자 계정은 gold 등급" 같은 동일 사실의 표현 변형을 별개로 저장해 같은 scope 가 중복·모순 사실로 오염된다. Mem0/Zep 은 임베딩 유사도로 같은 사실을 묶어 최신화(UPDATE)한다.

**결정**: 회수에 이미 있는 cosine SQL 을 재사용해 신규 fact 마다 가장 유사한 기존 fact 1건을 찾고, 임계 이상이면 INSERT 대신 그 row 를 최신 content/embedding 으로 UPDATE 한다. 임계 `0.85` 는 회수 기본 `0.7` 보다 높다 — 회수는 "관련 있으면 끌어온다"(recall 친화)가 목적이지만 dedup 은 "사실상 같은 사실만 합친다"(precision 친화)가 목적이라 더 보수적이어야 오병합(서로 다른 사실을 하나로 덮어쓰기)을 피한다. dedup 실패를 graceful INSERT 로 흘리는 이유는, dedup 은 품질 최적화지 정합성 불변식이 아니어서 실패가 저장 자체를 막으면 안 되기 때문이다.

### TTL 만료 (AGM-10)

**결정**: scope 당 FIFO/LRU(개수 상한)에 더해 `expires_at` 절대시각 기반 시간 만료를 옵션으로 둔다. 개수 상한은 "용량" 을, TTL 은 "신선도" 를 다스린다 — 둘은 직교한다(오래됐지만 1000건 미만이라 FIFO 로는 안 지워지는 사실을 TTL 이 정리). `expires_at` 을 row 에 절대시각으로 박는(상대 ttlDays 가 아닌) 이유는 회수 필터(`> now()`)·evict(`< now()`)가 저장 시점 기준으로 결정적이고, partial 인덱스(`WHERE expires_at IS NOT NULL`)로 무만료 다수 케이스의 인덱스 비용을 0 으로 유지하기 때문이다. 디폴트 무만료(NULL)는 기존 동작을 보존한다 — 빌더가 명시적으로 `memoryTtlDays` 를 set 할 때만 만료가 켜진다.

### 추출 분류 kind (AGM-11)

**결정**: 추출 항목을 `{content, kind}` 로 구조화하되 파서가 문자열(구 shape)도 수용하고 미지원 kind 를 `fact` 로 fallback 한다. 분류를 LLM 응답 스키마에 넣는 비용은 작고(프롬프트 한 줄), fact/preference/entity 구분은 향후 회수 가중·가시화 UI·forgetting 정책 차등의 토대가 된다. fallback 을 둔 이유는 분류가 추출의 부가정보지 필수 불변식이 아니어서, 모델이 분류를 누락/오기해도 저장(=핵심)이 깨지면 안 되기 때문이다.
