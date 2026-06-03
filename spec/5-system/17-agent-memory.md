---
id: agent-memory
status: partial
code:
  - codebase/backend/src/modules/agent-memory/**
pending_plans:
  - plan/in-progress/ai-context-memory-followup-v2.md
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
| `metadata` | JSONB | `{ source_node_id?, source_execution_id?, kind?, … }` — 추출 출처·분류 메타 |
| `created_at` | Timestamp | 추출 시각 (forgetting evict 기준, §4) |
| `updated_at` | Timestamp | 마지막 갱신 시각 |

**인덱스**: `(workspace_id, scope_key)` (스코프별 회수·evict) + pgvector partial 인덱스(`embedding`, `DocumentChunk` 와 동일 차원별 partial HNSW/IVFFlat 정책). [데이터 모델 §3](../1-data-model.md#3-인덱스-전략).

임베딩 차원·모델은 KB 인프라(`EmbeddingService`)를 재사용한다 — embedding 생성·차원 관리 로직을 중복 구현하지 않는다.

> 요구사항 `AGM-01` — `agent_memory` 테이블(pgvector 재사용, KB 분리). `AGM-02` — `(workspace_id, scope_key)` + pgvector 인덱스.

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
- **추출 모델**: 노드 `model`/`llmConfigId` 재사용 (별도 모델 필드 신설 없음 — scope-freeze).
- **저장 shape**: 추출된 각 사실/선호를 `content` 로, embedding 을 `EmbeddingService` 로 생성해 스코프 키와 함께 insert. `metadata.kind` 로 fact/preference 등 분류를 둘 수 있다 (분류 깊이는 구현 시 확정 — 본 v1 은 단순 텍스트 사실 단위로 충분).

**큐 분리**: 추출 작업은 기존 background body 실행 경로 위에서 동작한다. 전용 BullMQ 큐를 별도 분리할지는 구현 시점 부하 특성에 따라 결정 — v1 은 추출이 hot path 비차단인 점이 핵심 invariant 이고, 큐 토폴로지(공용 vs 전용)는 그 invariant 를 지키는 한 구현 재량이다. 전용 큐 분리 시 워크스페이스별 동시성 제한을 둘 수 있다.

> 요구사항 `AGM-04` — 턴 경계 비동기 추출(`scheduleBackgroundBody` snapshot 격리 준수, 노드 model 재사용).

## 4. 회수 (top-k, 동기) + forgetting

**회수 (LLM 호출 전 동기)**: 스코프 키 `(workspace_id, scope_key)` 안에서 현재 대화 컨텍스트를 쿼리로 top-k 의미검색(`memoryTopK` 결과 수, `memoryThreshold` 최소 유사도)을 동기 수행해, 회수된 `content` 를 **systemPrompt 안정 프리픽스** 에 주입한다 ([Spec AI 공통 §11.4](../4-nodes/3-ai/0-common.md#114-주입-위치-및-ordering) ordering [5a]). 회수는 hot path 동기 — 정확한 컨텍스트가 LLM 호출 시점에 있어야 하기 때문. 회수 건수는 `meta.memory.recalledCount` 로 echo.

`memoryTopK`/`memoryThreshold` 는 **persistent 메모리 회수 전용** 이며 KB 검색용 `ragTopK`/`ragThreshold` ([Spec RAG 검색](./9-rag-search.md)) 와 **독립** — 검색 대상이 다르다(`agent_memory` vs KnowledgeBase). 기본값은 RAG 정합을 위해 동일(`5` / `0.7`)하나 별도 필드다.

**forgetting (v1)**: `(workspace_id, scope_key)` 당 최신 `AGENT_MEMORY_MAX_PER_SCOPE = 1000` 건만 보존한다. 초과 시 `created_at` 오래된 순으로 evict (FIFO/LRU) — `ConversationThread` 의 `STORAGE_MAX_TURNS` evict 패턴과 동형. **TTL 기반 만료는 v2 로드맵.**

> 요구사항 `AGM-05` — 동기 top-k 회수(`memoryTopK`/`memoryThreshold`, KB 와 독립), 안정 프리픽스 주입. `AGM-06` — scope 당 최신 N=1000 FIFO/LRU evict (TTL 은 v2).

## 5. 격리 의무

모든 회수·추출·evict 쿼리는 **`workspace_id` 필터를 강제** 한다 (전 엔티티 공통 패턴). `memoryKey` 는 사용자 제어 표현식이므로 그 자체로 워크스페이스 경계를 넘는 키를 만들 수 없어야 한다 — 키는 항상 `(workspace_id, scope_key)` 로 결합되며 `workspace_id` 는 execution context 의 권위 값에서만 온다 (사용자 입력 불가).

> 요구사항 `AGM-07` — 모든 메모리 접근은 `workspace_id` 격리 강제 (cross-workspace 누수 차단).

## 6. v2 로드맵

- **TTL 기반 만료**: scope 당 FIFO/LRU(§4) 에 더해 시간 기반 만료 옵션.
- **추출 분류 깊이**: fact / preference / entity 의 구조화 분류·중복 dedup·갱신(같은 사실의 최신화) 정책.
- **사용자 식별자 연동**: 최종사용자 식별자(웹채팅 인증/세션) 도입 시 `memoryKey` 디폴트를 익명 `execution_id` 가 아닌 사용자 ID 로 승격하는 경로.
- **메모리 가시화 UI**: 워크스페이스 어드민이 scope 별 누적 메모리를 조회/삭제하는 surface.

---

## Rationale

### 스코프 키 설계 (`memoryKey ?? execution_id`)

**문제**: 세션 간 메모리는 "누구의 메모리인가" 를 식별하는 키가 필요하다. Mem0/Zep 은 caller-supplied `user_id` 를 받는다. 그러나 현재 제품에는 최종사용자 식별자가 부재하다 — 웹채팅 v1 은 익명이고, `Execution.executed_by` 는 워크플로를 만든 로그인 빌더지 대화 상대(최종사용자) 가 아니다.

**결정**: caller-supplied 패턴을 따르되 **표현식 필드 `memoryKey`** 로 노출한다. 빌더가 자신의 데이터(예: 외부 시스템의 고객 ID, 세션 토큰)를 표현식으로 주입하면 세션 간 개인화가 되고, 주입하지 않으면 `execution_id` 로 **세션 단위 격리** 가 안전 디폴트가 된다 (cross-session 누적이 일어나지 않아 사용자 간 메모리 누수가 구조적으로 불가능). 익명 디폴트가 "기억 없음" 이 아니라 "이 실행 안에서만 기억" 이라 summary_buffer 의 working-memory 와 자연 연속된다. 식별자 인프라가 생기면 디폴트를 사용자 ID 로 승격(v2)하면 되고, 그때까지 안전한 격리를 보장한다.

### pgvector 재사용 vs 별도 벡터DB 기각

**결정**: 별도 벡터 데이터베이스(Pinecone/Weaviate/Qdrant 등) 를 도입하지 않고 기존 PostgreSQL pgvector 인프라(`EmbeddingService`, RAG 검색 경로) 를 재사용한다.

**근거**: (1) KB/RAG 가 이미 pgvector 위에 구축돼 임베딩 생성·차원 관리·유사도 인덱스 운영 노하우가 한 스택에 있다 — 메모리만 별도 벡터DB 로 분리하면 운영 표면·장애 지점·일관성 경계가 2배가 된다. (2) 메모리 규모(scope 당 ≤1000 건)는 pgvector partial 인덱스로 충분하다 — 전용 벡터DB 의 대규모 ANN 최적화가 필요한 규모가 아니다. (3) `workspace_id` 격리·트랜잭션·백업이 메인 DB 와 동일 경계 안에서 자연히 보장된다. KB 와 같은 테이블이 아니라 **별도 테이블** 로 둔 이유는 회수 대상·생명주기·forgetting 정책이 KB(문서 청크, 영구) 와 메모리(추출 사실, evict 대상) 가 다르기 때문이다 — 재사용은 인프라(pgvector) 레벨이지 테이블 레벨이 아니다.
