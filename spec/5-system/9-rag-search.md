# Spec: RAG 검색 엔진

> 관련 문서: [PRD AI & 지식 저장소](../4-nodes/3-ai/_product-overview.md) · [Spec AI Agent](../4-nodes/3-ai/1-ai-agent.md) · [Spec 임베딩 파이프라인](./8-embedding-pipeline.md) · [Spec Graph RAG](./10-graph-rag.md) · [Spec Knowledge Base](../2-navigation/5-knowledge-base.md)

---

## 1. 개요

AI Agent 노드가 Knowledge Base의 관련 문서를 검색하여 LLM 컨텍스트에 추가하는 RAG(Retrieval-Augmented Generation) 검색 엔진.

KB 의 `rag_mode` 에 따라 흐름이 분기된다:

- `vector` (default): 본 문서에서 정의하는 vector 유사도 검색
- `graph`: vector seed → 그래프 확장 → rerank 의 Hybrid 흐름. 상세는 [Spec Graph RAG §4](./10-graph-rag.md#4-검색-흐름-hybrid)

검색 호출 방식은 **AI Agent 노드가 KB 를 LLM tool 로 노출**하는 능동적 tool calling 방식이다 (§2 참조). 노드 핸들러가 LLM 호출 전에 검색을 강제 실행하지 않으며, LLM 이 사용자 의도를 보고 호출 여부·query·KB·결과 수를 능동 결정한다. 한 번에 여러 KB tool 을 동시 호출(병렬 검색)하거나, 결과가 부족하면 다른 query 로 재호출하는 것도 LLM 의 자율 결정에 따른다.

**능동적 의도 분해 (agentic RAG)**: 에이전트는 사용자의 입력 문장을 그대로 query 로 사용하지 않고, 답변에 필요한 **지식 단위** 로 분해해 검색한다. 별개의 정보가 필요하다고 에이전트가 판단하면 같은 turn 에 `kb_*` 를 여러 번 호출한다 (같은 KB 라도 별개 호출). 예: "교환과 반품 정책 알려줘" → `query="교환정책"` + `query="반품정책"` 두 번. 임베딩 검색은 단일 주제일수록 정확도가 높으며, 분해 여부는 에이전트가 능동 판단한다 (system prompt + tool description 으로 유도).

**호출 결과의 분리 유지**: 각 `kb_*` 호출은 단일 KB 만 검색하며, 결과는 호출별로 분리된 tool_result 메시지로 LLM 에 전달된다. **호출 간 score 기준 병합·재정렬은 수행하지 않는다** — 에이전트가 각 호출 결과를 그대로 인용·종합해 최종 답변을 만든다. 노드 메타(`meta.ragSources`) 누적 시점에는 chunkId 기반 dedup 만 적용해 References UI 의 중복 표시를 막을 뿐, LLM 에 전달되는 tool_result content 는 가공 없이 호출별로 분리된다.

> 참고: `RagSearchService.search()` 자체는 multi-KB 인자 호출 시 score 기준 병합 후 topK slicing 을 수행하지만, 이는 디버그 컨트롤러(`POST /knowledge-base/search`) 의 멀티-KB 검색 경로에서만 사용된다. AI Agent 노드의 `KbToolProvider` 는 항상 단일 KB 로 호출하므로 위 병합 로직이 작동하지 않는다.

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
  1 - (dc.embedding <=> $1) AS score
FROM document_chunk dc
JOIN document d ON d.id = dc.document_id
WHERE d.knowledge_base_id = ANY($2)
  AND d.embedding_status = 'completed'
  AND 1 - (dc.embedding <=> $1) >= $3
ORDER BY score DESC
LIMIT $4;
```

| 파라미터 | 설명 | 기본값 |
|---------|------|--------|
| `$1` | 쿼리 임베딩 벡터 | - |
| `$2` | Knowledge Base ID 배열 (KB tool 호출에서는 단일 KB) | - |
| `$3` | 유사도 임계값 (threshold) | LLM 호출 인자 또는 0.7 |
| `$4` | 최대 결과 수 (topK) | LLM 호출 인자 또는 5 |

### 3.2 거리 함수

- **Cosine Similarity**: `1 - (embedding <=> query_vector)`
- pgvector `<=>` 연산자: cosine distance
- 점수 범위: 0.0 (무관) ~ 1.0 (동일)

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
- `score`: 유사도 점수 (0.0 ~ 1.0)
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
| `maxToolCalls` 도달 | tool loop 종료 후 마지막 LLM 응답을 그대로 반환 |

> **원칙**: KB 검색 실패 시에도 LLM 대화는 계속된다 (graceful degradation). LLM 이 검색 실패 사실을 인지하고 사용자에게 적절히 안내할 수 있도록 tool_result 에 명시적으로 알린다.

---

## 7. 확장 포인트 — AgentToolProvider

KB 검색은 `AgentToolProvider` 추상화의 첫 구현체 (`KbToolProvider`)다. 같은 인터페이스로 다른 "핸들러 내부 실행형" tool (workspace 변수 조회, MCP server, 외부 vector store 등) 을 추가할 수 있다. 인터페이스 정의: `codebase/backend/src/nodes/ai/ai-agent/tool-providers/agent-tool-provider.interface.ts`.

기존 `tool_<nodeId>` 메커니즘 (워크플로 캔버스에서 다른 노드를 AI Agent 의 tool 로 연결) 은 별도 경로로 유지되며, 외부 execution engine 이 실제 호출을 수행한다.
