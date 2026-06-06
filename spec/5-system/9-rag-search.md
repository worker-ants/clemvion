---
id: rag-search
status: partial
code:
  - codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts
  - codebase/backend/src/nodes/ai/ai-agent/tool-providers/kb-tool-provider.ts
pending_plans:
  - plan/in-progress/rag-rerank-followup.md
---

# Spec: RAG 검색 엔진

> 관련 문서: [PRD AI & 지식 저장소](../4-nodes/3-ai/_product-overview.md) · [Spec AI Agent](../4-nodes/3-ai/1-ai-agent.md) · [Spec 임베딩 파이프라인](./8-embedding-pipeline.md) · [Spec Graph RAG](./10-graph-rag.md) · [Spec Knowledge Base](../2-navigation/5-knowledge-base.md) · [Convention RAG 평가 하베스](../conventions/rag-evaluation.md)

---

## Overview (제품 정의)

AI Agent 가 Knowledge Base 를 LLM tool 로 검색해 답변 근거를 회수하고, 선택적 리랭킹 후처리로 검색 정밀도를 높이는 RAG 검색 엔진이다. 사용자는 추가 설정 없이도 기본 vector 검색을 쓰고, KB 단위로 리랭커를 켜 정책·도메인 특화 정밀화를 더할 수 있다. 제품 맥락: [PRD AI & 지식 저장소](../4-nodes/3-ai/_product-overview.md).

---

## 1. 개요

AI Agent 노드가 Knowledge Base의 관련 문서를 검색하여 LLM 컨텍스트에 추가하는 RAG(Retrieval-Augmented Generation) 검색 엔진.

KB 의 `rag_mode` 에 따라 흐름이 분기된다:

- `vector` (default): 본 문서에서 정의하는 vector 유사도 검색
- `graph`: vector seed → 그래프 확장 → rerank 의 Hybrid 흐름. 상세는 [Spec Graph RAG §4](./10-graph-rag.md#4-검색-흐름-hybrid)

검색 호출 방식은 **AI Agent 노드가 KB 를 LLM tool 로 노출**하는 능동적 tool calling 방식이다 (§2 참조). 노드 핸들러가 LLM 호출 전에 검색을 강제 실행하지 않으며, LLM 이 사용자 의도를 보고 호출 여부·query·KB·결과 수를 능동 결정한다. 한 번에 여러 KB tool 을 동시 호출(병렬 검색)하거나, 결과가 부족하면 다른 query 로 재호출하는 것도 LLM 의 자율 결정에 따른다.

**능동적 의도 분해 (agentic RAG)**: 에이전트는 사용자의 입력 문장을 그대로 query 로 사용하지 않고, 답변에 필요한 **지식 단위** 로 분해해 검색한다. 별개의 정보가 필요하다고 에이전트가 판단하면 같은 turn 에 `kb_*` 를 여러 번 호출한다 (같은 KB 라도 별개 호출). 예: "교환과 반품 정책 알려줘" → `query="교환정책"` + `query="반품정책"` 두 번. 임베딩 검색은 단일 주제일수록 정확도가 높으며, 분해 여부는 에이전트가 능동 판단한다 (system prompt + tool description 으로 유도).

**호출 결과의 분리 유지**: 각 `kb_*` 호출은 단일 KB 만 검색하며, 결과는 호출별로 분리된 tool_result 메시지로 LLM 에 전달된다. **호출 간 score 기준 병합·재정렬은 수행하지 않는다** — 에이전트가 각 호출 결과를 그대로 인용·종합해 최종 답변을 만든다. 노드 메타(`meta.ragSources`) 누적 시점에는 chunkId 기반 dedup 만 적용해 References UI 의 중복 표시를 막을 뿐, LLM 에 전달되는 tool_result content 는 가공 없이 호출별로 분리된다.

> 참고: `RagSearchService.search()` 자체는 multi-KB 인자 호출 시 score 기준 병합 후 topK slicing 을 수행하지만, 이는 디버그 컨트롤러(`POST /api/knowledge-bases/search`) 의 멀티-KB 검색 경로에서만 사용된다. AI Agent 노드의 `KbToolProvider` 는 항상 단일 KB 로 호출하므로 위 병합 로직이 작동하지 않는다.

---

## 2. 검색 호출 흐름 (LLM tool calling)

```
AI Agent 실행
  ↓
[setup] knowledgeBases 설정 확인 → 각 KB 를 `kb_<sanitizedKbId>` tool 로 LLM 에 노출
  ↓
[1st LLM call] system prompt + user message + tools 전달 (KB 검색 결과는 prefill 하지 않음)
  ↓
LLM 응답 분석
  ├─ 일반 텍스트 응답 → 종료 (KB 호출 없음, small-talk 등)
  └─ tool_use(kb_*) ≥ 1건  → §2.1 KB tool 실행 분기
        ↓
        각 호출에 대해 RagSearchService.search() 1회
        ↓
        결과를 tool_result 메시지로 변환하여 다음 turn 에 주입
        ↓
        [next LLM call] tool_result 포함하여 재호출
        ↓
        LLM 이 재검색 필요하다고 판단 → 또 다른 kb_* tool 호출 (`maxToolCalls` 한도 내)
        ↓
        충분하다고 판단 → 일반 텍스트 응답 → 종료
  ↓
응답 + meta.ragSources / meta.ragDiagnostics 반환
```

### 2.1 KB tool 정의

각 KB 는 다음 ToolDef 로 LLM 에 노출된다:

```json
{
  "name": "kb_<sanitizedKbId>",
  "description": "Search the \"<kb name> — <kb description>\" knowledge base. ...",
  "parameters": {
    "type": "object",
    "properties": {
      "query":     { "type": "string", "description": "Short search phrase ..." },
      "top_k":     { "type": "integer", "description": "Default: <ragTopK>" },
      "threshold": { "type": "number",  "description": "Default: <ragThreshold>" }
    },
    "required": ["query"]
  }
}
```

- `top_k` / `threshold` 는 LLM 이 호출 인자로 override 가능. 노드 config 의 `ragTopK` / `ragThreshold` 는 default 값.
- KB description 이 있으면 tool description 에 포함되어 LLM 이 KB 도메인을 판별해 라우팅한다.
- 동일 응답에서 여러 `kb_*` tool 호출이 가능 (병렬 검색).

### 2.2 KB tool 결과 포맷 (tool_result content)

```json
{
  "kb": "Refund Policy",
  "query": "refund window",
  "results": [
    { "source": "refund-rules.md", "score": 0.872, "content": "..." }
  ]
}
```

검색 실패 시:

```json
{
  "kb": "Refund Policy",
  "query": "refund window",
  "error": "search_failed",
  "results": []
}
```

LLM 은 결과의 `source` / `score` 를 보고 인용·신뢰도 판단을 수행한다.

### 2.3 호출 한도

- `maxToolCalls` (기본 10) 에 KB tool 호출이 포함된다. 한도 도달 시 loop 종료 후 마지막 LLM 응답을 반환한다.
- KB tool 호출 1건이 1 카운트.
- **batch 부분 truncate**: LLM 이 한 응답에 N 개 `tool_use` 를 emit 했는데 잔여 한도 `R < N` 인 경우, 앞쪽 `R` 건만 정상 실행하고 나머지 `N-R` 건은 `tool_call_budget_exceeded` 코드의 tool_result 로 회신한다. (Anthropic 은 모든 `tool_use` 에 대응하는 `tool_result` 가 없으면 400 을 내므로 누락 회신 금지.)

---

## 3. 유사도 검색

### 3.1 쿼리

```sql
SELECT
  dc.id AS chunk_id,
  dc.document_id,
  dc.content,
  dc.metadata,
  d.name AS document_name,
  1 - (dc.embedding::vector(<dim>) <=> $1::vector(<dim>)) AS score
FROM document_chunk dc
JOIN document d ON d.id = dc.document_id
JOIN knowledge_base kb ON kb.id = d.knowledge_base_id AND kb.workspace_id = $5
WHERE vector_dims(dc.embedding) = <dim>
  AND d.embedding_status = 'completed'
  AND dc.embedding IS NOT NULL
  AND 1 - (dc.embedding::vector(<dim>) <=> $1::vector(<dim>)) >= $3
ORDER BY score DESC
LIMIT $4;
```

| 파라미터 | 설명 | 기본값 |
|---------|------|--------|
| `$1` | 쿼리 임베딩 벡터 | - |
| `$2` | Knowledge Base ID 배열 (KB tool 호출에서는 단일 KB) | - |
| `$3` | 유사도 임계값 (threshold) | LLM 호출 인자 또는 0.7 |
| `$4` | 최대 결과 수 (topK) | LLM 호출 인자 또는 5 |
| `$5` | 워크스페이스 ID (멀티테넌시 격리) | - |

> **`rerank_mode ≠ off` 시 분기** (§3.3): KB 의 `rerank_mode` 가 `off` 가 아니면 위 SQL 은 cosine 임계(`$3`)를 적용하지 않고 `rerank_candidate_k` 만큼 wide 회수만 수행한다 — 컷은 리랭크 단계 이후로 미뤄진다. 이때 `kb_*` 의 `threshold` 인자·노드 `ragThreshold` 는 **rerank 점수 임계**로 해석된다. `rerank_mode = 'off'`(기본)이면 위 SQL 그대로 cosine 임계+topK 컷 (현행 동작).

> 실제 쿼리는 임베딩 차원 `<dim>` 으로 `::vector(<dim>)` 캐스트를 양변에 적용하고, `vector_dims(dc.embedding) = <dim>` 으로 차원이 다른 청크를 배제하며, `knowledge_base` 조인의 `workspace_id` 로 테넌트를 격리한다. KB ID 필터는 동일 차원의 KB 들을 그룹핑한 뒤 그룹 단위로 바인딩된다 (`searchVectorGroup`, `rag-search.service.ts`). 위 SQL 은 핵심 score 계산을 보여주는 개념 축약본이다.

### 3.2 거리 함수

- **Cosine Similarity**: `1 - (embedding <=> query_vector)`
- pgvector `<=>` 연산자: cosine distance
- 점수 범위: 0.0 (무관) ~ 1.0 (동일)

---

### 3.3 검색 후처리 — 리랭킹 (선택적)

회수된 후보 청크를 LLM 컨텍스트에 주입하기 전, KB 단위 `rerank_mode` 에 따라 **2차 정밀화(reranking)** 하는 선택적 단계. KB tool 인터페이스(`kb_*` 의 `query`/`top_k`/`threshold`)는 불변이며, 후처리는 `RagSearchService` 내부에서 일어난다.

> **상태**: `cross_encoder` 와 `cross_encoder_llm` 두 모드 모두 구현됨 (provider 1차 `tei`/`cohere`; 마이그레이션 V081 RerankConfig 테이블 · V082 KB rerank_* 컬럼). 본 리랭킹은 `rag_mode`(vector/graph)와 **직교** — graph 모드의 centrality-weighted score blending([Graph RAG §4](./10-graph-rag.md))은 graph 내부 1차 정렬이고, 본 절의 cross-encoder reranking 은 vector/graph 어느 회수 결과든 적용되는 2차 후처리다.

#### 3.3.1 모드

| `rerank_mode` | 동작 |
|---|---|
| `off` (기본) | 후처리 없음 — §3.1 SQL 그대로 (cosine 임계 + topK). **현행과 byte-identical (하위호환)**. 셀프호스팅에 리랭커 의존성을 강제하지 않기 위한 기본값 |
| `cross_encoder` | wide 회수 → cross-encoder 재점수화 → 동적 점수 컷 → top-k |
| `cross_encoder_llm` | `cross_encoder` 후 **항상** listwise LLM grading 1콜 추가 (정책·지시 기반 판단이 필요한 KB 용). 이 모드 선택 자체가 "LLM grading KB" 표시자 — 별도 플래그 없음 |

#### 3.3.2 흐름 (`rerank_mode ≠ off`)

```
1) wide 회수: cosine 임계 미적용, rerank_candidate_k(기본 50) 만큼 회수
2) cross-encoder rerank: (query, chunk.content) 쌍을 RerankConfig endpoint 로 점수화
   (RerankClient.rerank() — Spec LLM Client §3.6/§4.1)
3) [cross_encoder_llm 만] survivors(~15) listwise LLM grading 항상 수행 (id 순위 + 1~10 점수, 1콜; pointwise 금지)
4) 동적 점수 컷: rerank_score_threshold 가 있으면 점수 < 임계 청크 drop (없으면 정렬만)
5) 최종 top_k(노드 ragTopK 또는 LLM override)로 slice
```

- 컷 기준이 cosine → **rerank 점수**로 이동한다. 고정 top-k 컷으로 의미 있는 청크가 잘리는 문제를 점수 기반 동적 컷으로 해소한다.
- 한국어 권장 cross-encoder 모델: `dragonkue/bge-reranker-v2-m3-ko` (자가호스팅 `tei`).
- **v1 결정**: `cross_encoder_llm` 은 항상 LLM grading 을 수행한다(점수 평탄/모호 기반 conditional escalate 는 LLM 콜 비용 절감 최적화로, 정량 임계를 P0 평가셋으로 보정한 뒤 후속 도입). "정책 판단 KB" 는 별도 컬럼/휴리스틱 없이 `rerank_mode = cross_encoder_llm` 선택으로 표현한다.
- **v1 범위 — 단일 KB 한정**: 리랭킹은 `RagSearchService` 가 **단일 KB** 로 호출된 경로(agentic `KbToolProvider`)에서만 적용된다. 멀티-KB 인자 검색(디버그 컨트롤러 경로)은 기존 cosine score 병합 후 topK 컷을 유지하며 리랭크하지 않는다(멀티-KB 리랭크는 후속). 단일 KB 가 RAG 의 정상 경로(§1, §2.1)이므로 v1 커버리지로 충분하다.

> 설계 결정·근거·폐기 대안: [`plan/complete/spec-draft-rag-reranking.md`](../../plan/complete/spec-draft-rag-reranking.md) `## Rationale`.

---

## 4. 출력 메타데이터

AI Agent 응답의 `meta.ragSources` 와 `meta.ragDiagnostics`:

### 4.1 ragSources (run-results UI 에서 인용 청크 표시)

```json
{
  "ragSources": [
    {
      "documentId": "uuid",
      "documentName": "Customer FAQ",
      "chunkId": "uuid",
      "content": "관련 텍스트 (최대 200자)...",
      "score": 0.92
    }
  ]
}
```

- `content`: 원본 청크 텍스트의 앞 200자 (미리보기용)
- `score`: 점수 (0.0 ~ 1.0). `rerank_mode = 'off'` 면 cosine 유사도, `rerank_mode ≠ off` 면 **리랭크 점수**(정규화). (`cross_encoder` · `cross_encoder_llm` 모두 구현됨)
- `origin?`: 점수 출처/회수 단계. `cosine` (기본 vector) / `reranked` (리랭크 후처리 적용 — `cross_encoder` · `cross_encoder_llm` 모두 구현됨) / graph 모드의 `seed` / `expanded` ([Graph RAG §4.3](./10-graph-rag.md#43-출력-메타데이터)). 생략 시 `cosine`
- KB tool 이 한 노드 실행 동안 여러 번 호출되면 모든 결과가 누적된다 (multi-turn 도 포함).
- 멀티턴에서 "어느 응답이 어느 청크를 사용했는지"가 필요한 경우, 동일 항목이 turn 단위로 분리되어 `meta.turnDebug[].ragSources` / `meta.turnDebug[].ragDiagnostics` 에도 노출된다 — 노드 전체 누적은 `meta.ragSources` 그대로 유지하되, run-results UI 의 References 탭은 turn delta 를 메시지(턴)별 그룹으로 렌더한다.
- run-results UI: AI 노드가 KB 호출을 시도한 경우(`ragDiagnostics.attempted=true` 또는 `ragSources.length > 0`) 별도 **References 탭**을 노출해 노드 전체 요약 + turn 단위 그룹을 보여준다. Output / Meta 탭은 더 이상 KB 청크를 중복 노출하지 않으며, 발견성을 위해 Preview 탭의 assistant 메시지 하단에 사용 문서명 chip 을 1줄로 표시하고 클릭 시 References 탭으로 점프한다.

### 4.2 ragDiagnostics (검색 동작 진단)

```json
{
  "ragDiagnostics": {
    "attempted": true,
    "searchedKbCount": 2,
    "queriesUsed": ["refund window", "exchange policy"],
    "resultCount": 8
  }
}
```

| 필드 | 의미 |
|------|------|
| `attempted` | KB tool 이 노드 실행 동안 1번 이상 호출됐는지 |
| `searchedKbCount` | 호출된 distinct KB 수 |
| `queriesUsed` | LLM 이 발행한 모든 query 의 합집합 (호출 순서 유지) |
| `resultCount` | 모든 KB tool 호출에서 회수된 chunk 수의 합 |
| `skipReason` | `empty_kb_list` (KB 미설정) 또는 `no_results` (모든 호출이 0건) — 정상 시 생략 |
| `rerank?` | 리랭킹 후처리 진단 (`rerank_mode ≠ off` 호출 시에만 — `cross_encoder` · `cross_encoder_llm` 모두 구현됨). 아래 스키마 |

**`rerank` 서브객체** (`cross_encoder` · `cross_encoder_llm` 모두 구현됨 — §3.3):

```json
{
  "rerank": {
    "mode": "cross_encoder",
    "candidateCount": 50,
    "returnedCount": 6,
    "llmGradingApplied": false,
    "cutoffApplied": true,
    "error": null
  }
}
```

`error` 는 실패 시 `RERANK_ENDPOINT_FAILED` / `RERANK_NO_VALID_RESULTS` / `RERANK_LLM_GRADING_FAILED` / `RERANK_CONFIG_INVALID` (UPPER_SNAKE_CASE). 어떤 값이든 검색은 cosine 경로로 안전 강등되며 노드 실패가 아니다 (§6).

---

## 5. 임베딩 모델 일관성

- 검색 쿼리 임베딩은 **Knowledge Base의 embedding_model과 embedding_llm_config 와 동일한 endpoint** 사용
- 한 KB tool 호출은 단일 KB 에 대해 검색하므로, 해당 KB 의 모델/endpoint 로 임베딩
- LLM 이 같은 응답에서 여러 KB tool 을 호출하면 각 KB 의 임베딩 endpoint 가 독립적으로 사용됨

---

## 6. 에러 처리

| 상황 | 처리 |
|------|------|
| KB 메타 조회 실패 (NotFound 등) | 해당 KB 만 tool 노출에서 skip, 나머지는 노출. 경고 로그 |
| LLM 이 KB tool 을 호출하지 않음 | 정상 — `ragDiagnostics.attempted=false` 로 노출 |
| 검색 결과 0건 | `tool_result` 의 `results: []` 로 LLM 에 전달. LLM 이 재검색 또는 일반 답변 결정 |
| 임베딩 API / pgvector 쿼리 실패 | `tool_result` 의 `error: "search_failed"` 로 LLM 에 전달. LLM 이 graceful 응답 결정. 노드 실패는 아님 |
| 리랭커 endpoint 실패/타임아웃 | wide 회수 결과를 cosine score 순 top-k 컷으로 **안전 강등**. `ragDiagnostics.rerank.error = "RERANK_ENDPOINT_FAILED"` |
| 리랭커가 유효 결과 0건 반환 (모든 index 가 후보 범위 밖) | wide 회수 결과를 cosine score 순 top-k 컷으로 **안전 강등**. `ragDiagnostics.rerank.error = "RERANK_NO_VALID_RESULTS"`. 경고 로그 |
| RerankConfig 미구성/미지원 provider | 해당 KB `off` 강등 (cosine 경로). `RERANK_CONFIG_INVALID`. 경고 로그 |
| `cross_encoder_llm` grading LLM 실패 | cross-encoder 결과로 fallback (LLM 단계만 skip). `RERANK_LLM_GRADING_FAILED` |
| `maxToolCalls` 도달 | tool loop 종료 후 마지막 LLM 응답을 그대로 반환 |

> **원칙**: KB 검색 실패 시에도 LLM 대화는 계속된다 (graceful degradation). LLM 이 검색 실패 사실을 인지하고 사용자에게 적절히 안내할 수 있도록 tool_result 에 명시적으로 알린다.

---

## 7. 확장 포인트 — AgentToolProvider

KB 검색은 `AgentToolProvider` 추상화의 첫 구현체 (`KbToolProvider`)다. 같은 인터페이스로 다른 "핸들러 내부 실행형" tool (workspace 변수 조회, MCP server, 외부 vector store 등) 을 추가할 수 있다. 인터페이스 정의: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/agent-tool-provider.interface.ts`.

기존 `tool_<nodeId>` 메커니즘 (워크플로 캔버스에서 다른 노드를 AI Agent 의 tool 로 연결) 은 별도 경로로 유지되며, 외부 execution engine 이 실제 호출을 수행한다.

---

## Rationale

- **왜 완전 선택적(off 기본)인가**: 셀프호스팅 배포에서 리랭커 인프라(GPU·외부 API)를 강제하면 진입장벽·운영비가 오른다. `off` 기본은 (a) 하위호환 byte-identical (b) 리랭커 없는 배포에서도 제품 동작 (c) 점진 도입 가능. 리랭킹은 "품질 부가 단계"이지 필수 경로가 아니라는 §7 원칙과 일관.
- **왜 KB 단위인가**: 검색 파이프라인 소유권을 KB 에 둔 기존 결정(`rag_mode`·`embedding_model`·graph 파라미터 KB 단위)과 일관. KB 마다 도메인·문서 성격이 달라 리랭크 전략도 KB 단위가 자연스럽다. 노드 단위로 빼면 같은 KB 를 여러 노드가 쓸 때 설정이 분산된다.
- **왜 `rag_mode` 는 불변인데 `rerank_mode` 는 가변인가**: `rag_mode`(vector/graph)는 임베딩·entity 추출 등 **적재 산출물의 형태**를 결정해 사후 변경 시 재임베딩·재추출이 필요하다. `rerank_mode` 는 **검색 시점에만** 적용되는 후처리라 재임베딩·마이그레이션 없이 토글 가능하다. 따라서 비대칭이 정당하다.
- **왜 `ragThreshold` 의미를 재해석했나**: 별도 신규 필드를 추가하기보다 기존 `ragThreshold` 를 `rerank_mode` 에 따라 분기 해석한다 — off 면 cosine 임계(현행), ≠off 면 rerank 점수 임계 default. 신규 노드 config 필드 증식을 피하고, "최소 관련도 컷" 이라는 사용자 의도가 두 경로에서 동일하기 때문.
- **왜 cross-encoder 가 기본, LLM grading 은 escalate 인가**: 심화 리서치상 broad 벤치에서 cross-encoder 가 LLM 리랭커와 동급~우위이면서 지연·비용 1~2 자릿수 낮음. 고객지원 도메인 A/B 에서 listwise LLM 은 해결률 이점 0·40% 느림. LLM 의 실익은 정책·지시 판단·근거 인용 → `cross_encoder_llm` escalate 한정.
- **왜 동적 점수 컷인가**: 고정 top-k 는 query-의존 최적 k 를 무시 → 의미 청크 누락 + lost-in-the-middle. 점수 임계 동적 컷이 토큰 절감·환각 감소 효과. 컷 기준을 cosine→rerank 점수로 옮기는 게 핵심.
- **왜 RerankConfig 를 LLMConfig 와 분리했나**: 리랭커는 chat/embedding 과 API shape 가 다른 별도 model class. capability flag 로 LLMConfig 에 욱여넣기보다 sibling 리소스가 명확. 단 provider 추상화·SSRF 가드·secret-store 는 재사용.
- **폐기한 대안**:
  - *노드 단위 리랭크 설정*: KB 소유권 원칙 위반·설정 분산. 기각.
  - *항상 리랭크(off 없음)*: 셀프호스팅 강제 의존성. 기각.
  - *cosine 임계 유지한 채 리랭크*: wide 후보를 cosine 으로 미리 굶겨 리랭커 효과 반감. 기각(§3 에서 wide 회수 시 cosine 임계 미적용).
  - *VectorChord/ColBERT 등 in-DB 리랭킹*: 한국어 토크나이저 부재·인프라 복잡. cross-encoder API/TEI 로 충분.
