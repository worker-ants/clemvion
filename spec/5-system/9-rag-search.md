---
id: rag-search
status: partial
code:
  - codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts
  - codebase/backend/src/modules/knowledge-base/search/rerank.service.ts
  - codebase/backend/src/modules/knowledge-base/search/dynamic-cut.util.ts
  - codebase/backend/src/nodes/ai/ai-agent/tool-providers/kb-tool-provider.ts
pending_plans:
  - plan/in-progress/rag-rerank-followup.md
  - plan/in-progress/rag-dynamic-cut.md
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

> 참고: `RagSearchService.search()` 자체는 multi-KB 인자 호출 시 score 기준 병합 후 §3.4 동적 점수 컷(token-budget + inject-cap)을 수행하지만, 이는 디버그 컨트롤러(`POST /api/knowledge-bases/search`) 의 멀티-KB 검색 경로에서만 사용된다. AI Agent 노드의 `KbToolProvider` 는 항상 단일 KB 로 호출하므로 위 병합 로직이 작동하지 않는다.

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
      "top_k":     { "type": "integer", "description": "Max chunks to inject. If omitted, a dynamic token-budget cut applies (internal ceiling). Increase for broader recall." },
      "threshold": { "type": "number",  "description": "Default: <ragThreshold>" }
    },
    "required": ["query"]
  }
}
```

- `top_k` / `threshold` 는 LLM 이 호출 인자로 override 가능. `threshold` 의 노드 default 는 `ragThreshold`. `top_k` 는 명시(LLM arg 또는 노드 `ragTopK`) 시 주입 상한 override 이며, **미지정 시 §3.4 동적 점수 컷이 주입 청크 수를 결정**한다 (고정 default 없음).
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

`cross_encoder_llm` 의 listwise grading 이 모든 후보를 "관련 근거 없음"으로 판정한 경우 (§3.3.2 conditional escalate → `gradingNoGrounding`):

```json
{
  "kb": "Refund Policy",
  "query": "refund window",
  "grounding": "none",
  "note": "Relevance grading found no passages in this knowledge base that ground the query. Do not fabricate an answer from this KB.",
  "results": []
}
```

`grounding: "none"` 신호를 받은 AI Agent 는 해당 KB 기반 답변을 생성하지 않고 "관련 근거 없음"을 명시한다 (환각 억제). 이 신호는 `ragDiagnostics.rerank.gradingNoGrounding=true` (§4.2)와 1:1 대응한다.

KB 가 **검색 불가 상태**(`embedding_dimension` 이 NULL — 모델 변경 후 미재임베딩 / 재임베딩 진행 중, §5·[임베딩 파이프라인 §5.4/§7.3](./8-embedding-pipeline.md))인 경우:

```json
{
  "kb": "요금제 안내",
  "query": "요금제 종류",
  "status": "not_searchable",
  "reason": "reembedding_required",
  "note": "This knowledge base is being (re)embedded and is temporarily unsearchable. Tell the user it needs re-embedding (or that it is in progress); do not claim the KB is empty or fabricate an answer.",
  "results": []
}
```

- `reason`: `reembedding_in_progress` (`reembed_status='in_progress'`) / `reembedding_required` (`reembed_status='idle'` 이며 모델 변경 후 미재임베딩 — 사용자가 수동 재임베딩 전까지 영구 검색 불가).
- `not_searchable` 신호를 받은 AI Agent 는 해당 KB 기반 답변을 만들지 않고 "재임베딩이 필요/진행 중"임을 사용자에게 명시한다 (빈 KB·무관 결과로 오인 금지, 환각 억제). 이 신호는 `ragDiagnostics.skipReason="kb_unsearchable"` (§4.2)와 대응한다.
- **`search_failed` 와 구분**: `search_failed` 는 임베딩 API/pgvector 의 **일시적 인프라 오류**(재시도하면 회복 가능)이고, `not_searchable` 은 **데이터 적재 상태**(재임베딩 전까지 재시도해도 동일) 문제다 (§6).

> **봉투 판별 우선순위** (소비 코드는 다음 순서로 분기): `error` (예: `search_failed` — 일시 실패) → `status` (`not_searchable` — 검색 불가) → `grounding` (`none` — 근거 없음) → 정상 `results`. 한 tool_result content 에는 이 중 하나의 판별 키만 존재한다.
>
> **표기 규약**: tool_result content 의 판별 키 **문자열 값**(`search_failed` / `not_searchable` / `reembedding_required` / `none`)은 **snake_case** 다 (기존 `search_failed`·`none` 선례와 일관). 노드 출력 `code`(UPPER_SNAKE_CASE, [node-output §3.2](../conventions/node-output.md))·rerank `error` 코드(§4.2)와는 **다른 레이어**(LLM 컨텍스트용 content 문자열 vs 노드 출력/진단 코드)임에 유의한다.

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
| `$3` | 유사도 임계값 (threshold, θ) — 관련성 게이트 | LLM 호출 인자 또는 0.7 |
| `$4` | 회수 폭 (recall LIMIT) [^recall] | `rerank_mode=off`: 내부 상수 `RAG_RECALL_K`(50) · `≠off`: `rerank_candidate_k`(기본 50) |
| `$5` | 워크스페이스 ID (멀티테넌시 격리) | - |

[^recall]: `$4` 는 **회수 폭**이지 주입 청크 수가 아니다. 최종 생성 주입 청크 수는 §3.4 의 app-layer **동적 점수 컷**(token-budget + inject-cap)이 결정한다. D1 이전의 `LIMIT topK(5)` 고정 COUNT 선차단을 회수 폭 확대 + 동적 컷으로 대체한 것이 핵심 변경이다.

> **회수·컷 분기** (§3.3·§3.4): 두 경로 모두 **wide 회수 → 동적 점수 컷**이다. `rerank_mode = 'off'`(기본)이면 cosine θ(`$3`) 게이트는 **유지**하되 `LIMIT` 을 `RAG_RECALL_K`(50)로 넓히고, 생성 주입 청크 수는 §3.4 **app-layer 동적 점수 컷**(token-budget + inject-cap)이 결정한다 (D1 이전의 고정 `LIMIT topK` 선차단 폐기). `rerank_mode ≠ off` 면 cosine θ 미적용 wide 회수(`rerank_candidate_k`) → 리랭크 → §3.4 동적 컷이며, 이때 `kb_*` 의 `threshold` 인자·노드 `ragThreshold` 는 **rerank 점수 임계**로 해석된다.

> 실제 쿼리는 임베딩 차원 `<dim>` 으로 `::vector(<dim>)` 캐스트를 양변에 적용하고, `vector_dims(dc.embedding) = <dim>` 으로 차원이 다른 청크를 배제하며, `knowledge_base` 조인의 `workspace_id` 로 테넌트를 격리한다. KB ID 필터는 동일 차원의 KB 들을 그룹핑한 뒤 그룹 단위로 바인딩된다 (`searchVectorGroup`, `rag-search.service.ts`). 위 SQL 은 핵심 score 계산을 보여주는 개념 축약본이다.

> **검색 불가 KB 의 사전 차단** (`embedding_dimension IS NULL`): 위 SQL 은 `<dim>` 을 알아야 실행되므로, `embedding_dimension` 이 NULL 인 KB(모델 변경 후 미재임베딩 / 재임베딩 진행 중)는 **KB 메타 조회 단계에서 사전 차단**되어 위 vector 쿼리를 아예 실행하지 않는다 — 저장 청크가 옛 차원/공간이라 신규 query 와 비교하면 stale/오답이 되기 때문이다. 이는 "쿼리가 우연히 0행을 반환"하는 것이 아니라 **명시적 사전 차단**이며, 그 사실을 §2.2 `status:"not_searchable"` 봉투 + §4.2 `skipReason="kb_unsearchable"` 로 호출부에 노출한다 ([임베딩 파이프라인 §7.3](./8-embedding-pipeline.md)). graph 모드 seed 쿼리도 동일하게 NULL 차원이면 사전 차단된다.

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
| `off` (기본) | cross-encoder 재점수화 없음 — wide 회수(cosine θ 게이트) → **§3.4 동적 점수 컷**(token-budget + inject-cap). **리랭커 인프라 의존 없음** (셀프호스팅 기본값). 동적 컷은 cosine 점수 위 app-layer 후처리라 리랭커 불요. (D1 이전: 고정 `LIMIT topK` 선차단) |
| `cross_encoder` | wide 회수 → cross-encoder 재점수화 → §3.4 동적 점수 컷 |
| `cross_encoder_llm` | `cross_encoder` 후 **조건부(conditional escalate)** listwise LLM grading 1콜 — cross-encoder 상위 점수가 평탄/모호할 때만 escalate (정책·지시 기반 판단이 필요한 KB 용). 이 모드 선택 자체가 "LLM grading KB" 표시자 — 별도 플래그 없음 |

#### 3.3.2 흐름 (`rerank_mode ≠ off`)

```
1) wide 회수: cosine 임계 미적용, rerank_candidate_k(기본 50) 만큼 회수
2) cross-encoder rerank: (query, chunk.content) 쌍을 RerankConfig endpoint 로 점수화
   (RerankClient.rerank() — Spec LLM Client §3.6/§4.1)
3) [cross_encoder_llm 만] conditional escalate — cross-encoder 상위 점수가 평탄/모호할 때만
   survivors(~15) listwise LLM grading (id 순위 + 1~10 점수, 1콜; pointwise 금지). escalate 안 되면 cross-encoder 결과 유지(정상)
4) §3.4 동적 점수 컷: rerank_score_threshold(θ) 미달 drop + token-budget 상한
5) inject-cap: 명시 top_k(노드 ragTopK 또는 LLM override) 있으면 그 값, 없으면 내부 ceiling 까지 주입
```

- 컷 기준이 cosine → **rerank 점수**로 이동한다. **고정 COUNT 컷(top-k)으로 의미 있는 청크가 잘리는 문제**를 §3.4 점수 기반 동적 컷(token-budget + inject-cap)으로 해소한다.
- 한국어 권장 cross-encoder 모델: `dragonkue/bge-reranker-v2-m3-ko` (자가호스팅 `tei`).
- **v1 결정 (2026-06-06 갱신 — [`spec-draft-rag-reranking.md §Rationale②`](../../plan/complete/spec-draft-rag-reranking.md) "항상 grading(v1)" 결정 번복)**: `cross_encoder_llm` 은 cross-encoder 상위 점수가 평탄/모호할 때만 listwise grading 으로 **conditional escalate** 한다. escalate 진입 **정량 임계는 합리적 default** 로 시작(§Rationale)하고, P0 골든셋 기반 A/B 확정은 후속([`rag-rerank-followup.md`](../../plan/in-progress/rag-rerank-followup.md)). escalate 미발생은 cross-encoder 결과를 그대로 사용한다(기존 동작의 부분집합 → 회귀 안전). "정책 판단 KB" 는 별도 컬럼/휴리스틱 없이 `rerank_mode = cross_encoder_llm` 선택으로 표현한다.
- **grader '근거 없음' 전달**: listwise grading 이 survivors 전부를 무관(저점)으로 판정하면 그 사실을 검색 결과 메타로 노출해 agent 가 "관련 근거 없음" 을 인지·명시하도록 한다 (환각 억제, Self-RAG 인용정밀도).
- **v1 범위 — 단일 KB 한정**: 리랭킹은 `RagSearchService` 가 **단일 KB** 로 호출된 경로(agentic `KbToolProvider`)에서만 적용된다. 멀티-KB 인자 검색(디버그 컨트롤러 경로)은 cosine score 병합 후 §3.4 동적 컷(token-budget + inject-cap)을 적용하며 리랭크는 하지 않는다(멀티-KB 리랭크는 후속). 단일 KB 가 RAG 의 정상 경로(§1, §2.1)이므로 v1 커버리지로 충분하다.

> 설계 결정·근거·폐기 대안: [`plan/complete/spec-draft-rag-reranking.md`](../../plan/complete/spec-draft-rag-reranking.md) `## Rationale`.

---

### 3.4 동적 점수 컷 (생성 주입, 모든 모드 공통)

회수·리랭크 직후 LLM 컨텍스트 주입 직전에 적용되는 **공통 후처리**(D1). 고정 COUNT 컷(`LIMIT topK=5`)이 query-의존 최적 k 를 무시해 의미 청크를 누락시키던 문제를, 회수 폭 확대 + 점수 기반 동적 컷으로 해소한다. KB tool 인터페이스(`kb_*` 의 `query`/`top_k`/`threshold`)는 불변이며 후처리는 `RagSearchService` 내부에서 일어난다.

```
1) wide 회수
   - off:  cosine θ 게이트 + LIMIT RAG_RECALL_K(50)
   - ≠off: rerank_candidate_k(기본 50) wide 회수 → cross-encoder 리랭크 + [cross_encoder_llm] 조건부 LLM grading (§3.3)
2) 동적 점수 컷 (점수 내림차순 정렬된 후보 위)
   a. θ 게이트:  off = cosine SQL 단계에서 이미 적용 / ≠off = rerank_score_threshold
   b. token-budget: 누적 토큰 추정이 RAG_INJECT_TOKEN_BUDGET(8000) 초과 시 중단 (단 최소 1개 보장)
   c. inject-cap:   명시 top_k 있으면 그 값, 없으면 RAG_MAX_INJECT_COUNT(12) ceiling
```

- **상수** (module-level constant, 환경변수 미노출):
  - `RAG_RECALL_K`(50) — off 경로 회수 폭. `rerank_candidate_k` 기본값(50)과 수치만 같고 **독립 코드패스**(KB 필드 아님).
  - `RAG_INJECT_TOKEN_BUDGET`(8000) — 주입 토큰 예산. working-memory 압축 예산 `DEFAULT_MEMORY_TOKEN_BUDGET`(8000)과 값은 같으나 쓰임새(KB 주입 상한 vs working-memory 압축)가 다른 별개 상수.
  - `RAG_MAX_INJECT_COUNT`(12) — 주입 ceiling.
- **신규 KB/노드 config 필드 없음** — 사용자/LLM 노출은 θ(`ragThreshold`)·`top_k`(`ragTopK` 또는 LLM arg)만. 회수 폭/예산/ceiling 은 내부 상수 (Rationale: 신규 config 필드 증식 회피).
- **토큰 추정**: KB 청킹 경로의 `chunking/text-chunker.estimateTokens`(char/3, 동기·무의존)를 재사용한다 — KB 청크 도메인과 동일 추정. ai-agent working-memory 의 language-aware 추정과는 의도적 분리(서로 다른 도메인, 회귀 0).
- **적용 경로**: 단일 KB vector · multi-KB merge(디버그 컨트롤러) · graph 통합 결과 모두 최종 주입 단계에 동일 적용된다.
- **실패 처리**: 동적 컷은 in-process 순수 후처리(필터·합산)라 별도 실패 모드가 없다. 상위 예외는 기존 검색 try/catch(빈 결과/`search_failed`)가 커버한다 (§6).
- **pgvector HNSW `ef_search` (recall 보전)**: wide 회수(`LIMIT 5 → RAG_RECALL_K(50)`, rerank `candidateK` ≤ 200)는 HNSW 기본 `ef_search=40` 을 초과하므로, 그대로 두면 `ef_search < LIMIT` 이 되어 recall@LIMIT 가 저하된다. vector 회수 쿼리(`searchVectorGroup`)는 `SET LOCAL hnsw.ef_search = clamp(LIMIT×2, 40, 1000)`(`hnswEfSearchFor`)를 **트랜잭션 스코프**로 적용해 재현율을 보전한다 — `SET LOCAL` 이라 풀 커넥션 오염이 없고, pgvector 표준 GUC 라 **전 매니지드에서 동일 동작**(별도 확장 불요). graph seed(`seedTopK` 기본 5 < 40)는 기본값으로 충분하므로 미적용. (`ivfflat` 미사용 — 차원별 partial HNSW 만 운용.) 프로덕션 부하에 따른 정밀 튜닝(값·KB config 노출)은 후속.

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
| `skipReason` | `empty_kb_list` (KB 미설정) / `kb_unsearchable` (호출된 KB 가 전부 검색 불가 — `embedding_dimension` NULL) / `no_results` (검색은 됐으나 모든 호출이 0건) — 정상 시 생략 |
| `rerank?` | 리랭킹 후처리 진단 (`rerank_mode ≠ off` 호출 시에만 — `cross_encoder` · `cross_encoder_llm` 모두 구현됨). 아래 스키마 |

- **`skipReason` 는 노드 단위 단일 값**이며 `resultCount === 0` 일 때만 세팅된다(하나라도 결과가 회수됐으면 생략 — `resultCount > 0` 과 공존하지 않는다). 0건 원인이 둘 이상이면 **`empty_kb_list` → `kb_unsearchable` → `no_results`** 우선순위로 가장 구체적인 사유를 채택한다: 호출된 KB 가 전부 검색 불가(`embedding_dimension` NULL)면 `kb_unsearchable`, 검색은 됐으나 임계 미달 등으로 전부 0건이면 `no_results`. 개별 호출의 검색 불가 사실은 그 호출의 tool_result `status:"not_searchable"` 봉투(§2.2)로 이미 LLM 에 전달되므로, `skipReason` 은 노드 요약 진단(run-results UI)용이다.

**`rerank` 서브객체** (`cross_encoder` · `cross_encoder_llm` 모두 구현됨 — §3.3):

```json
{
  "rerank": {
    "mode": "cross_encoder",
    "candidateCount": 50,
    "returnedCount": 6,
    "llmGradingApplied": false,
    "gradingNoGrounding": false,
    "cutoffApplied": true,
    "error": null
  }
}
```

`error` 는 실패 시 `RERANK_ENDPOINT_FAILED` / `RERANK_NO_VALID_RESULTS` / `RERANK_LLM_GRADING_FAILED` / `RERANK_CONFIG_INVALID` (UPPER_SNAKE_CASE). 어떤 값이든 검색은 cosine 경로로 안전 강등되며 노드 실패가 아니다 (§6).

- `llmGradingApplied`: `cross_encoder` 는 항상 `false`. `cross_encoder_llm` 은 **conditional escalate 로 escalate + grading 성공 시에만** `true` — escalate 미발생(상위 점수가 평탄/모호하지 않음) 또는 grading 실패 강등 시 `false`. 따라서 `false` 는 두 케이스(escalate 안 됨 / grading 실패)를 포함하며 `mode`·`error` 로 구분한다.
- `gradingNoGrounding`: `cross_encoder_llm` 의 conditional escalate 로 **listwise grading 이 실행됐고 grader 가 모든 survivor 를 무관(근거 없음)으로 판정**한 경우 `true` (§3.3.2 '근거 없음' 전달). grading 미실행/일부 관련 시 `false`. 이 신호를 받은 KB tool 호출은 결과 메타에 '관련 근거 없음' 을 명시해 agent 환각을 억제한다. grading parse 실패(`RERANK_LLM_GRADING_FAILED`)와는 구분된다(후자는 cross-encoder 결과로 fallback).
- `cutoffApplied`: §3.4 동적 점수 컷이 후보를 하나라도 떨어뜨렸으면 `true` — rerank 점수 컷(θ) / token-budget 컷 / inject-cap 컷 중 **어느 것이든** 적용 시 포함(의미 확장). 별도 `dynamicCutApplied` 필드는 v1 미신설(진단 schema 증식 회피). `rerank` 서브객체는 `rerank_mode ≠ off` 호출에만 존재하므로 off 경로의 동적 컷 적용 여부는 v1 에서 진단에 노출하지 않는다(의도적 생략).

---

## 5. 임베딩 모델 일관성

- 검색 쿼리 임베딩은 **Knowledge Base의 embedding_model과 embedding_llm_config 와 동일한 endpoint** 사용
- 한 KB tool 호출은 단일 KB 에 대해 검색하므로, 해당 KB 의 모델/endpoint 로 임베딩
- LLM 이 같은 응답에서 여러 KB tool 을 호출하면 각 KB 의 임베딩 endpoint 가 독립적으로 사용됨
- **비대칭 입력**: 검색 쿼리 임베딩은 `LlmService.embed(..., inputType:'query')` 로 호출한다 (적재 청크는 `'document'`). e5/Gemini 계열 모델에서 query/passage 를 올바르게 구분해 silent 회수 품질저하를 막는다 ([임베딩 파이프라인 §5.4](./8-embedding-pipeline.md), `rag-search.service.ts`).
- **`embedding_dimension` 의 의미**: KB 의 `embedding_dimension` 은 "모델이 출력하는 차원"이 아니라 **현재 저장된 청크 벡터의 실제 차원**이다. 첫 임베딩 완료 시 채워지고, 모델 변경(또는 재임베딩 트리거) 시 NULL 로 초기화돼 재임베딩 완료 전까지 NULL 로 남는다. NULL = "저장 청크의 차원/벡터 공간이 현재 모델과 일치한다는 보장이 없음" → 검색 사전 차단(§3.1·§6). 이 때문에 임베딩 테스트(probe)로 얻은 모델 출력 차원을 미리 저장하지 않는다 ([Rationale](#rationale)).

---

## 6. 에러 처리

| 상황 | 처리 |
|------|------|
| KB 메타 조회 실패 (NotFound 등) | 해당 KB 만 tool 노출에서 skip, 나머지는 노출. 경고 로그 |
| LLM 이 KB tool 을 호출하지 않음 | 정상 — `ragDiagnostics.attempted=false` 로 노출 |
| 검색 결과 0건 (검색은 수행됨) | `tool_result` 의 `results: []` 로 LLM 에 전달. LLM 이 재검색 또는 일반 답변 결정. `ragDiagnostics.skipReason="no_results"` (모든 호출 0건 시) |
| KB 검색 불가 — `embedding_dimension` NULL (모델 변경 후 미재임베딩 `reembedding_required` / 재임베딩 진행 중 `reembedding_in_progress`) | KB 메타 단계에서 **사전 차단**(vector/seed 쿼리 미실행, §3.1) 후 §2.2 `status:"not_searchable"` 봉투 + `note` 로 LLM 에 전달. `ragDiagnostics.skipReason="kb_unsearchable"`. **노드 실패 아님**(graceful) — LLM 이 "재임베딩 필요/진행 중"을 사용자에게 안내. stale 벡터 검색은 의도적으로 수행하지 않음 ([§5 임베딩 모델 일관성](#5-임베딩-모델-일관성), [임베딩 파이프라인 §5.4/§7.3](./8-embedding-pipeline.md)). UI 목록 카드 경고: [Knowledge Base §2.2.1](../2-navigation/5-knowledge-base.md) |
| 임베딩 API / pgvector 쿼리 실패 | `tool_result` 의 `error: "search_failed"` 로 LLM 에 전달. LLM 이 graceful 응답 결정. 노드 실패는 아님. (`not_searchable` 과 구분 — 이쪽은 일시 인프라 오류) |
| 리랭커 endpoint 실패/타임아웃 | wide 회수 결과를 cosine score 순 정렬 후 §3.4 동적 컷(token-budget + inject-cap)으로 **안전 강등**. `ragDiagnostics.rerank.error = "RERANK_ENDPOINT_FAILED"` |
| 리랭커가 유효 결과 0건 반환 (모든 index 가 후보 범위 밖) | wide 회수 결과를 cosine score 순 정렬 후 §3.4 동적 컷으로 **안전 강등**. `ragDiagnostics.rerank.error = "RERANK_NO_VALID_RESULTS"`. 경고 로그 |
| RerankConfig 미구성/미지원 provider | 해당 KB `off` 강등 (cosine 경로). `RERANK_CONFIG_INVALID`. 경고 로그 |
| `cross_encoder_llm` grading LLM 실패 | cross-encoder 결과로 fallback (LLM 단계만 skip). `RERANK_LLM_GRADING_FAILED` |
| `cross_encoder_llm` grading 이 모든 후보 무관 판정 (**정상, 에러 아님**) | 결과 비우고 `gradingNoGrounding=true` (§4.2). KB tool 이 `grounding:"none"` 으로 '관련 근거 없음' 을 agent 에 명시 (§2.2·§3.3.2 환각 억제). `error=null` |
| 동적 점수 컷 (§3.4) | in-process 순수 후처리(필터·합산) — 별도 실패 모드 없음. 상위 검색 실패는 기존 `search_failed`/빈 결과 fallback 으로 커버 |
| `maxToolCalls` 도달 | tool loop 종료 후 마지막 LLM 응답을 그대로 반환 |

> **원칙**: KB 검색 실패 시에도 LLM 대화는 계속된다 (graceful degradation). LLM 이 검색 실패 사실을 인지하고 사용자에게 적절히 안내할 수 있도록 tool_result 에 명시적으로 알린다.

---

## 7. 확장 포인트 — AgentToolProvider

KB 검색은 `AgentToolProvider` 추상화의 첫 구현체 (`KbToolProvider`)다. 같은 인터페이스로 다른 "핸들러 내부 실행형" tool (workspace 변수 조회, MCP server, 외부 vector store 등) 을 추가할 수 있다. 인터페이스 정의: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/agent-tool-provider.interface.ts`.

기존 `tool_<nodeId>` 메커니즘 (워크플로 캔버스에서 다른 노드를 AI Agent 의 tool 로 연결) 은 별도 경로로 유지되며, 외부 execution engine 이 실제 호출을 수행한다.

---

## Rationale

- **왜 완전 선택적(off 기본)인가**: 셀프호스팅 배포에서 리랭커 인프라(GPU·외부 API)를 강제하면 진입장벽·운영비가 오른다. `off` 기본은 (a) **리랭커 인프라 없이 동작** (b) 점진 도입 가능. 리랭킹은 "품질 부가 단계"이지 필수 경로가 아니라는 §7 원칙과 일관.
  - **byte-identical 조항 폐기 (D1, 2026-06-06)**: 기존 리랭킹 spec 의 "off = 현행과 byte-identical 하위호환" 조항([`plan/complete/spec-draft-rag-reranking.md §1`](../../plan/complete/spec-draft-rag-reranking.md) / 본 문서 §3.3.1 구판)을 **폐기**한다. D1 동적 컷(§3.4) 도입으로 off 경로도 고정 `LIMIT topK` 대신 wide 회수 + app-layer 동적 컷을 거치므로 byte-identical 이 아니다. 새 하위호환 정의 = "**리랭커 인프라 없이 동작·점진 도입 가능**" (동적 컷은 cosine 점수 위 순수 app-layer 후처리라 새 인프라 의존을 만들지 않는다).
- **왜 KB 단위인가**: 검색 파이프라인 소유권을 KB 에 둔 기존 결정(`rag_mode`·`embedding_model`·graph 파라미터 KB 단위)과 일관. KB 마다 도메인·문서 성격이 달라 리랭크 전략도 KB 단위가 자연스럽다. 노드 단위로 빼면 같은 KB 를 여러 노드가 쓸 때 설정이 분산된다.
- **왜 `rag_mode` 는 불변인데 `rerank_mode` 는 가변인가**: `rag_mode`(vector/graph)는 임베딩·entity 추출 등 **적재 산출물의 형태**를 결정해 사후 변경 시 재임베딩·재추출이 필요하다. `rerank_mode` 는 **검색 시점에만** 적용되는 후처리라 재임베딩·마이그레이션 없이 토글 가능하다. 따라서 비대칭이 정당하다.
- **왜 `ragThreshold` 의미를 재해석했나**: 별도 신규 필드를 추가하기보다 기존 `ragThreshold` 를 `rerank_mode` 에 따라 분기 해석한다 — off 면 cosine 임계(현행), ≠off 면 rerank 점수 임계 default. 신규 노드 config 필드 증식을 피하고, "최소 관련도 컷" 이라는 사용자 의도가 두 경로에서 동일하기 때문.
- **왜 cross-encoder 가 기본, LLM grading 은 escalate 인가**: 심화 리서치상 broad 벤치에서 cross-encoder 가 LLM 리랭커와 동급~우위이면서 지연·비용 1~2 자릿수 낮음. 고객지원 도메인 A/B 에서 listwise LLM 은 해결률 이점 0·40% 느림. LLM 의 실익은 정책·지시 판단·근거 인용 → `cross_encoder_llm` escalate 한정.
- **왜 동적 점수 컷인가 (D1)**: 고정 COUNT 컷(`LIMIT topK=5`)은 query-의존 최적 k 를 무시 → 의미 청크 누락 + lost-in-the-middle. **고치는 대상은 COUNT 선차단이지 관련성 게이트(θ)가 아니다** — θ 는 off=cosine SQL·≠off=rerank 점수 게이트로 그대로 유지하고, 회수 폭을 넓힌(`RAG_RECALL_K`=50) 뒤 token-budget + inject-cap(12) 으로 주입 수를 동적 결정한다. 근거: CAR(토큰 −60%·지연 −22%·환각 −10%). 모든 모드(vector/graph/rerank) 최종 주입 단계에 공통 적용.
  - **왜 θ 를 SQL/rerank 게이트로 유지(이동 안 함)했나**: θ 를 app-layer 로 옮기면 graph expanded 청크(가중 저점)를 의도치 않게 over-drop 하는 등 의미 변화 위험이 있다. 회수 폭 확대 + app-layer budget/cap 만으로 D1 목표(의미 청크 누락 해소)를 달성하므로 회귀 표면을 최소화했다.
  - **off cosine θ 유지 vs 기각 대안**: §3.3.1 구판이 기각한 "cosine 임계 유지한 채 리랭크"(wide 후보를 cosine 으로 미리 굶겨 리랭커 효과 반감) 와 **별개**다. off 에는 리랭커가 없어 cosine θ 가 유일한 관련성 게이트이므로 제거 대상이 아니다.
- **왜 회수폭/예산/ceiling 을 내부 상수로 두나**: `ragThreshold` 재해석 선례(아래) 및 "신규 노드 config 필드 증식 회피" 원칙과 일관. v1 은 module-level 상수(환경변수 미노출)로 시작하고, 튜닝 수요가 측정되면 후속에 KB 필드로 승격한다. 사용자/LLM 노출은 θ·`top_k` 만.
- **왜 `ragTopK` 기본값(5)을 제거(optional)했나**: 동적 컷(§3.4) 도입으로 '고정 기본 주입 수' 개념 자체가 사라진다. 이전 리랭킹 spec([`spec-draft-rag-reranking.md §5`](../../plan/complete/spec-draft-rag-reranking.md))이 기본값 5 를 유지한 것은 리랭크 후 최종 슬라이스 의미 보강에 그쳤고, D1 이 그 슬라이스를 동적 컷으로 대체하므로 기본값 제거는 자연스러운 귀결이다. `ragTopK` 는 이제 **선택적 상한 override** — 미지정 시 동적 컷(ceiling 12)이 지배, 명시 시 그 값이 ceiling. `ragThreshold`(θ)는 기본 0.7 유지(여전히 관련성 게이트).
- **왜 D2 conditional escalate 를 지금 도입하나**: 기존 v1 결정 "`cross_encoder_llm` 은 항상 grading"([`spec-draft-rag-reranking.md §Rationale`](../../plan/complete/spec-draft-rag-reranking.md) · 본 문서 §3.3.2 구판 v1 결정 · [`rag-quality-improvement.md §6`](../../plan/in-progress/rag-quality-improvement.md) 2026-06-04 확정)은 **LLM 콜 비용 보호용 단순화**였다. conditional escalate 진입 구조는 데이터와 무관하게 안전하다 — escalate 미발생 시 cross-encoder 결과를 그대로 쓰므로 v1 동작의 부분집합이다. 따라서 escalate **메커니즘은 지금 도입**하되, escalate 진입 **정량 임계는 합리적 default**(예: 상위 N 점수의 평탄도 — 최고점과 차이/표준편차 기반)로 시작하고 P0 골든셋 기반 A/B 확정은 후속([`rag-rerank-followup.md`](../../plan/in-progress/rag-rerank-followup.md))으로 분리한다. 회귀 위험이 낮은 이유가 이 부분집합 성질이다.
- **v1 breaking note — `cutoffApplied` 의미 확장 (D1)**: 본 개정으로 `ragDiagnostics.rerank.cutoffApplied` 가 "rerank 점수(θ) 컷" 단독에서 "θ / token-budget / inject-cap 세 컷 중 하나 이상 발동"으로 의미가 확장됐다 (§4.2). 강등(fallback) 경로에서도 token-budget/inject-cap 컷 발생 시 `true` 가 반환된다. `cutoffApplied=true → 반드시 θ 컷` 으로 해석하던 기존 소비자는 의미를 재확인해야 한다.
- **왜 token-budget 추정에 char/3(text-chunker)을 쓰나**: KB 청크 도메인과 동일 추정 함수(`chunking/text-chunker.estimateTokens`)를 재사용한다 — 빠른 균일 근사로 주입 컷에 충분. ai-agent working-memory 경로의 language-aware 추정과는 서로 다른 도메인이라 의도적으로 분리(회귀 0). 상수 `RAG_INJECT_TOKEN_BUDGET`(8000)은 working-memory `DEFAULT_MEMORY_TOKEN_BUDGET`(8000)과 값만 같을 뿐 별개 상수(혼선 차단 위해 RAG prefix 명명).
- **왜 RerankConfig 를 LLMConfig 와 분리했나**: 리랭커는 chat/embedding 과 API shape 가 다른 별도 model class. capability flag 로 LLMConfig 에 욱여넣기보다 sibling 리소스가 명확. 단 provider 추상화·SSRF 가드·secret-store 는 재사용.
- **왜 검색 불가(`embedding_dimension` NULL)를 silent 제외에서 명시 신호로 바꿨나**: NULL→검색 제외(stale 벡터 비교 방지)는 올바른 안전장치라 **유지**하되, 기존엔 빈 `results:[]` 를 반환해 "KB 가 비었음"과 구분되지 않았다. 그 결과 에이전트가 "관련 자료 없음"으로 오답하거나 환각하기 쉬웠다 — 특히 모델 변경 후 재임베딩을 잊은 `idle+NULL` KB 는 **영구히 조용한 0건**이 된다. `status:"not_searchable"` + `note` 명시 신호로 바꿔 에이전트가 "재임베딩 필요/진행 중"을 사용자에게 안내하게 한다(graceful, `grounding:"none"` 선례와 동형). 이는 8-embedding §7.3 의 "in_progress KB 는 자연스럽게 검색 제외" 서술을 **idle+NULL 케이스까지 일반화 + silent 제거**로 갱신한 것이다.
- **왜 probe(임베딩 테스트) 차원을 미리 저장하지 않나**: `embedding_dimension` 은 "현재 저장된 청크 벡터의 실제 차원"이지 "모델이 출력하는 차원"이 아니다(§5). 모델 변경 후 probe 로 얻은 신 모델 출력 차원을 미리 박으면, 저장 청크는 여전히 옛 모델 차원/공간이라 (a) `vector_dims` 필터에서 전부 탈락해 여전히 0건이거나 (b) 차원이 우연히 같으면 옛 벡터 ↔ 신 query 의 **stale 오답**이 된다. 따라서 차원은 실제 적재 경로(`EmbeddingService`)가 race-free 하게만 채우고, probe 는 read-only 검증으로 유지한다.
- **왜 이번 범위를 경고 노출로 한정했나**: 근본 원인(`update()` 모델 변경이 `embedding_dimension` 만 NULL 로 두고 재임베딩을 자동 트리거하지 않아 영구 검색불가 구멍이 생김)의 해소(자동 재임베딩 트리거 또는 저장 차단/강제 확인)는 비용·UX 정책 결정이 더 필요해 별도 후속으로 분리한다. 본 변경은 "이미 검색불가가 된 상태를 에이전트·사용자에게 알리는" 표면에 집중해 회귀 표면을 최소화한다.
- **폐기한 대안**:
  - *노드 단위 리랭크 설정*: KB 소유권 원칙 위반·설정 분산. 기각.
  - *항상 리랭크(off 없음)*: 셀프호스팅 강제 의존성. 기각.
  - *cosine 임계 유지한 채 리랭크*: wide 후보를 cosine 으로 미리 굶겨 리랭커 효과 반감. 기각(§3 에서 wide 회수 시 cosine 임계 미적용).
  - *VectorChord/ColBERT 등 in-DB 리랭킹*: 한국어 토크나이저 부재·인프라 복잡. cross-encoder API/TEI 로 충분.
