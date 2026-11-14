---
id: "CLE-KB-SEARCH-TOOL"
title: "RAG 검색 — 도구 결과 · 출력 메타 · 에러"
type: "design"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-KB-SEARCH"
ancestors: ["CLE-VISION", "CLE-KB", "CLE-KB-SEARCH"]
area: "CLE-KB"
content_hash: "7e3b8cd5db7740012e027235c1667395f915ee71cce90f0a3c9944c024ea9756"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "4a15129a5bcb736198e928e3f9b79e89adedc2b940bd5331b1d9af29c2eb3925"
etag: "sha256-ef4630b379230102540133b9c1e16e2ce779a1679845a62b0ddaf80eb3156896"
---
## 개요

이 문서는 [RAG 검색](CLE-KB-SEARCH.md) 의 하위 문서로 지식 저장소 도구(`kb_*`)의 정의와 결과 형식, 노드 출력의 검색 인용 메타(`meta.ragSources`)와 검색 진단(`meta.ragDiagnostics`), 화면 표시, 에러 처리를 정한다. 검색 · 리랭킹 · 점수 컷의 동작은 [RAG 검색 — 유사도 검색 · 리랭킹 · 점수 컷](CLE-KB-SEARCH-RANK.md) 에서 정한다.

## 지식 저장소 도구
### 지식 저장소 도구 정의

각 지식 저장소는 다음 도구 정의로 LLM 에 노출된다.

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

- `top_k` 와 `threshold` 는 LLM 이 호출 인자로 바꿀 수 있다. `threshold` 의 기본값은 노드의 유사도 임계값(`ragThreshold`)이다.
- `top_k` 는 주입 상한(`ragTopK`)이다. LLM 인자나 노드 `ragTopK` 로 주면 그 값이 상한이다. 주지 않으면 [동적 점수 컷](CLE-KB-SEARCH-RANK.md#동적-점수-컷) 이 넣을 청크 수를 정한다. 고정 기본값은 없다.
- 지식 저장소 설명이 있으면 도구 설명에 들어가 LLM 이 도메인을 가려 부른다.
- 한 응답에서 여러 `kb_*` 를 부를 수 있다.

### 도구 결과 형식

정상 결과:

```json
{
  "kb": "Refund Policy",
  "query": "refund window",
  "results": [
    { "source": "refund-rules.md", "score": 0.872, "content": "..." }
  ]
}
```

LLM 은 `source` 와 `score` 로 인용과 신뢰도를 판단한다.

검색 실패(임베딩 API 나 pgvector 의 일시적인 인프라 에러):

```json
{
  "kb": "Refund Policy",
  "query": "refund window",
  "error": "search_failed",
  "results": []
}
```

근거 없음(`cross_encoder_llm` 의 LLM 그레이딩이 모든 후보를 근거 없음으로 판정, 진단의 `gradingNoGrounding=true` 와 1:1 대응):

```json
{
  "kb": "Refund Policy",
  "query": "refund window",
  "grounding": "none",
  "note": "Relevance grading found no passages in this knowledge base that ground the query. Do not fabricate an answer from this KB.",
  "results": []
}
```

이 신호를 받은 에이전트는 그 지식 저장소를 근거로 답하지 않고 관련 근거가 없다고 밝힌다. 환각을 줄이고 인용 정밀도를 높이려는 장치다.

검색 불가(`not_searchable`, 저장 청크 차원이 NULL):

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

- `reason` 은 재임베딩 진행 중(`reembed_status='in_progress'`)이면 `reembedding_in_progress`, 모델 변경 뒤 재임베딩 전(`reembed_status='idle'`)이면 `reembedding_required` 다. 뒤쪽은 사용자가 재임베딩할 때까지 계속 검색되지 않는다.
- 이 신호를 받은 에이전트는 그 지식 저장소로 답을 만들지 않고 재임베딩이 필요하거나 진행 중이라고 사용자에게 알린다. 빈 지식 저장소나 무관한 결과로 오인하지 않게 한다. 진단의 `skipReason="kb_unsearchable"` 과 대응한다.
- `search_failed` 는 다시 시도하면 회복될 수 있는 인프라 에러다. `not_searchable` 은 데이터 적재 상태 문제라 재임베딩 전까지는 다시 시도해도 같다.

판별 순서와 표기:

- 소비 코드는 `error`(일시 실패), `status`(검색 불가), `grounding`(근거 없음), 정상 `results` 순서로 분기한다. 결과 하나에는 판별 키가 하나만 있다.
- 판별 키의 문자열 값(`search_failed`, `not_searchable`, `reembedding_required`, `none`)은 snake_case 다. 노드 출력 에러 코드(UPPER_SNAKE_CASE, [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md))나 리랭킹 진단 에러 코드와는 층이 다르다. 이쪽은 LLM 컨텍스트에 넣는 본문 문자열이다.


## 출력 메타데이터

AI 에이전트 노드 출력의 `meta.ragSources` 와 `meta.ragDiagnostics` 를 검색 인용 메타라고 부른다. 스키마의 단일 기준은 이 절이다. Graph RAG 도 같은 구조를 쓴다.

### 인용 청크 (`ragSources`)

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

- `content`: 청크 원문의 앞 200자(미리보기용). Vector·Graph 공통 필드 이름이다.
- `score`: 0.0~1.0. 리랭킹 끔이면 코사인 유사도, 켬이면 정규화한 리랭킹 점수다.
- `origin?`: 점수 출처. `cosine`(기본 벡터), `reranked`(리랭킹 적용), Graph RAG 의 `seed`, `expanded`([Graph RAG](CLE-KB-GRAPH.md)). 생략하면 `cosine` 이다.
- 한 노드 실행 동안 도구를 여러 번 부르면 결과가 모두 쌓인다. 멀티턴도 포함한다.
- 멀티턴에서 어느 응답이 어느 청크를 썼는지 알 수 있도록 같은 항목을 턴 단위로 `meta.turnDebug[].ragSources`, `meta.turnDebug[].ragDiagnostics` 에도 싣는다. 노드 전체 누적은 `meta.ragSources` 에 그대로 둔다.

### 화면 표시

AI 노드가 지식 저장소를 부르려 했으면(`ragDiagnostics.attempted=true` 또는 `ragSources.length > 0`) 실행 결과 화면에 References 탭을 둔다. 노드 전체 요약과 턴 단위 묶음을 보여 준다. Output·Meta 탭에는 청크를 중복해서 싣지 않는다.

대화 미리보기(Preview)에는 두 표면이 있다.

- 📚 문서명 칩: 어시스턴트 메시지 아래 한 줄. 누르면 References 탭의 해당 턴으로 간다.
- 🔎 `rag` 행: 대화 타임라인 위의 독립 행이다. 그 턴에 `kb_*` 도구 호출이 가져온 청크를 턴 단위로 모아 보여 준다. 같은 호출은 🔧 도구 행으로도 보인다. 도구 행은 호출 하나와 그 결과를 보여 주고 `rag` 행은 그 턴에 모인 청크를 보여 준다.

세 표면(References 탭, 칩, 행)은 모두 `meta.turnDebug[].ragSources` 를 읽고 같은 턴이면 같은 `sources[]` 를 보여야 한다. 시각 매핑과 불변식은 [대화 미리보기](../CLE-EXEC/CLE-EXEC-PREVIEW.md), 소스 정의는 [대화 스레드](../CLE-IX/CLE-IX-THREAD.md) 에서 정한다. 이 절과 그 문서들은 같은 표면을 다루므로 한쪽을 고치면 다른 쪽도 확인한다.

### 검색 진단 (`ragDiagnostics`)

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

| 필드 | 뜻 |
|---|---|
| `attempted` | 노드 실행 동안 지식 저장소 도구가 한 번 이상 불렸는지 |
| `searchedKbCount` | 불린 서로 다른 지식 저장소 수 |
| `queriesUsed` | LLM 이 보낸 모든 질의의 합집합(호출 순서 유지) |
| `resultCount` | 모든 호출에서 가져온 청크 수의 합 |
| `skipReason` | `empty_kb_list`(지식 저장소 미설정), `kb_unsearchable`(불린 지식 저장소가 모두 검색 불가), `no_results`(검색은 했지만 모든 호출이 0건). 정상이면 생략 |
| `rerank?` | 리랭킹 진단. 리랭킹이 켜진 호출에만 있다 |

`skipReason` 은 노드 단위 값 하나이고 `resultCount === 0` 일 때만 채운다. 결과가 하나라도 있으면 생략한다. 0건 원인이 둘 이상이면 `empty_kb_list`, `kb_unsearchable`, `no_results` 순서로 가장 구체적인 사유를 고른다. 호출 하나의 검색 불가 사실은 그 호출의 도구 결과로 이미 LLM 에 전달되므로 `skipReason` 은 실행 결과 화면의 요약 진단용이다.

리랭킹 진단(`rerank`):

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

- `error`: 실패하면 `RERANK_ENDPOINT_FAILED`, `RERANK_NO_VALID_RESULTS`, `RERANK_LLM_GRADING_FAILED`, `RERANK_CONFIG_INVALID` 가운데 하나다. 어느 값이든 검색은 코사인 경로로 강등되고 노드 실패가 아니다.
- `llmGradingApplied`: `cross_encoder` 는 늘 `false` 다. `cross_encoder_llm` 은 그레이딩으로 넘어가 성공했을 때만 `true` 다. `false` 는 넘어가지 않은 경우와 그레이딩 실패를 모두 포함하므로 `mode` 와 `error` 로 구분한다.
- `gradingNoGrounding`: LLM 그레이딩이 실행됐고 모든 후보를 근거 없음으로 판정하면 `true` 다. 그레이딩 응답 해석 실패(`RERANK_LLM_GRADING_FAILED`)와는 다르다. 뒤쪽은 cross-encoder 결과로 돌아간다.
- `cutoffApplied`: 동적 점수 컷이 후보를 하나라도 뺐으면 `true` 다. 점수 컷 임계, 주입 토큰 예산, 주입 상한 가운데 어느 것이든 해당하며 강등 경로도 같다. 리랭킹 끔 경로의 컷 여부는 진단에 싣지 않는다. `rerank` 객체 자체가 리랭킹이 켜진 호출에만 있어서다.

## 에러 처리

| 상황 | 처리 |
|---|---|
| 지식 저장소 메타 조회 실패(찾을 수 없음 등) | 그 지식 저장소만 도구 노출에서 빼고 나머지는 노출한다. 경고 로그 |
| LLM 이 도구를 부르지 않음 | 정상이다. `ragDiagnostics.attempted=false` |
| 검색은 했지만 0건 | 도구 결과 `results: []`. LLM 이 다시 검색할지 일반 답변할지 정한다. 모든 호출이 0건이면 `skipReason="no_results"` |
| 검색 불가(저장 청크 차원 NULL, `reembedding_required`·`reembedding_in_progress`) | 메타 단계에서 미리 막는다(벡터·seed 쿼리 실행 안 함). `status:"not_searchable"` 와 `note` 로 LLM 에 알린다. `skipReason="kb_unsearchable"`. 노드 실패가 아니다. 옛 벡터로 검색하지 않는다. 화면 경고는 [지식 저장소 관리](CLE-KB-MANAGE.md) |
| 임베딩 API·pgvector 쿼리 실패 | 도구 결과 `error: "search_failed"`. LLM 이 알맞게 답한다. 노드 실패가 아니다. 일시 인프라 에러라 검색 불가와 다르다 |
| 리랭커 엔드포인트 실패·타임아웃 | 코사인 점수 순으로 정렬한 뒤 동적 점수 컷으로 강등. `rerank.error = "RERANK_ENDPOINT_FAILED"` |
| 리랭커가 유효 결과 0건 반환(모든 index 가 후보 범위 밖) | 코사인 점수 순으로 강등. `rerank.error = "RERANK_NO_VALID_RESULTS"`. 경고 로그 |
| 리랭커 모델 설정 없음·지원하지 않는 프로바이더 | 그 지식 저장소를 리랭킹 끔(코사인 경로)으로 강등. `RERANK_CONFIG_INVALID`. 경고 로그 |
| `cross_encoder_llm` 그레이딩 LLM 실패 | cross-encoder 결과로 돌아간다(LLM 단계만 건너뜀). `RERANK_LLM_GRADING_FAILED` |
| 그레이딩이 모든 후보를 무관으로 판정(정상) | 결과를 비우고 `gradingNoGrounding=true`. 도구 결과 `grounding:"none"`. `error=null` |
| 동적 점수 컷 | 순수 후처리라 따로 실패하지 않는다 |
| 도구 호출 한도 도달 | [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md) 의 도구 호출 한도 처리를 따른다 |

- `RERANK_CONFIG_INVALID` 는 검색 실행(리랭커 호출) 층에서만 쓰는 코드다. 검색 중 설정이 없거나 프로바이더를 쓸 수 없어도 에러를 던지지 않고 강등한다. `MODEL_CONFIG_INVALID`·`MODEL_CONFIG_NOT_FOUND` 는 모델 설정 CRUD(`/api/model-configs`) 층에서만 쓴다. 미지원 프로바이더 구성은 이 층에서 `MODEL_CONFIG_INVALID` 로 거부된다. 층별 대응은 [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md#rerankclientfactory), 코드 목록은 [에러 코드 규약과 카탈로그](../CLE-API/CLE-API-ERRCODES.md) 에 있다.
- 원칙: 지식 저장소 검색이 실패해도 LLM 대화는 이어간다. LLM 이 실패를 알고 사용자에게 알맞게 안내하도록 도구 결과에 명시한다.

## 구현 위치

- `codebase/backend/src/nodes/ai/ai-agent/tool-providers/kb-tool-provider.ts`
- `codebase/backend/src/modules/knowledge-base/search/rag-search.service.ts`
- 두 파일은 [RAG 검색](CLE-KB-SEARCH.md#구현-위치) 에도 적혀 있다. 리랭킹 · 동적 점수 컷 모듈은 [RAG 검색 — 유사도 검색 · 리랭킹 · 점수 컷](CLE-KB-SEARCH-RANK.md#구현-위치) 에 있다.

## Rationale

### `cutoffApplied` 의 뜻을 넓힌 이유

동적 점수 컷을 도입하면서 `ragDiagnostics.rerank.cutoffApplied` 가 "리랭킹 점수(θ) 컷" 하나에서 "θ, 주입 토큰 예산, 주입 상한 가운데 하나 이상" 으로 넓어졌다. `cutoffApplied=true` 를 반드시 θ 컷으로 읽던 소비자는 뜻을 다시 확인해야 한다. 별도 `dynamicCutApplied` 필드는 진단 스키마가 늘어나는 것을 피하려고 만들지 않았다.

### 검색 불가를 조용한 제외에서 명시 신호로 바꾼 이유

저장 청크 차원이 NULL 이면 검색에서 빼는 것(옛 벡터 비교 방지)은 올바른 안전장치라 유지한다. 하지만 예전에는 빈 `results:[]` 를 돌려줘 "지식 저장소가 비었다" 와 구분되지 않았다. 에이전트가 "관련 자료 없음" 으로 오답하거나 환각하기 쉬웠다. 특히 모델을 바꾸고 재임베딩을 잊은 저장소(`idle` 이면서 NULL)는 영구히 조용한 0건이 된다. `status:"not_searchable"` 과 `note` 로 바꿔 에이전트가 재임베딩 필요나 진행 중을 안내하게 했다. `grounding:"none"` 과 같은 방식이다. 문서 임베딩이 적던 "재임베딩 중인 저장소는 자연스럽게 검색에서 빠진다" 를 `idle` 이면서 NULL 인 경우까지 넓히고 조용한 제외를 없앤 결정이다.

### 이번 범위를 경고 노출로 한정한 이유

근본 원인은 모델 변경이 저장 청크 차원만 NULL 로 두고 재임베딩을 자동으로 시작하지 않는 데 있다. 이를 푸는 방법(자동 재임베딩 또는 저장 차단·확인 강제)은 비용과 UX 정책을 더 정해야 해서 뒤로 미뤘다. 이 결정은 이미 검색 불가가 된 상태를 에이전트와 사용자에게 알리는 표면에만 집중해 회귀 범위를 줄였다.
