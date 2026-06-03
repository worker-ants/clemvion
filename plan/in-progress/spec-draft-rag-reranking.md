---
worktree: rag-quality-proposal-0c618c
started: 2026-06-03
owner: planner
---
# Spec 초안: RAG 검색 후처리 — 리랭킹 (선택적)

> 성격: `project-planner` draft. consistency-check 통과 후 아래 §10 의 실제 spec 파일들에 반영.
> 기반: [`plan/in-progress/rag-quality-improvement.md`](./rag-quality-improvement.md) D1(동적 점수 컷)·D2(cross-encoder 기본 + LLM grading escalate).
> 영향 spec: `spec/5-system/9-rag-search.md`(주), `spec/5-system/7-llm-client.md`, `spec/2-navigation/5-knowledge-base.md`, `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/5-system/10-graph-rag.md`(rerank 용어 disambiguation).

---

## 1. Overview (제품 정의)

RAG 검색이 회수한 후보 청크를, LLM 컨텍스트에 주입하기 전에 **2차 정밀화(reranking)** 하는 선택적 단계를 추가한다.

**핵심 원칙 — 완전 선택적 (off 포함)**:
- 본 프로젝트는 **셀프호스팅 가능**하므로, 리랭커는 외부 의존성을 강제하지 않는다.
- KB 단위 `rerank_mode` 의 **기본값은 `off`** — 설정하지 않으면 현재(cosine `ORDER BY score DESC LIMIT topK`)와 **완전히 동일하게 동작**한다 (하위호환).
- 사용자는 KB 단위로 `off` / `cross_encoder` / `cross_encoder_llm` 중 선택한다.
- 리랭커 endpoint 는 `local`/`tei` provider 로 **사내 자가호스팅**(예 HuggingFace TEI 가 서빙하는 `bge-reranker-v2-m3`) 하거나, Cohere/Jina/Voyage 등 외부 API 를 쓸 수 있다.

**사용자 가치**:
- dense-only 가 놓치는 정밀도(정확 용어·근접-오답 청크 제거)를 cross-encoder 가 보완.
- 고정 top-k 컷으로 의미 있는 청크가 잘리는 문제를, **동적 점수 컷**으로 해소(D1).
- 정책·지시 기반 판단이 필요한 KB 는 LLM grading 까지 escalate(D2).

---

## 2. 데이터 모델

### 2.1 `knowledge_base` 추가 컬럼

| 컬럼 | 타입 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `rerank_mode` | Enum | `off` | `off` / `cross_encoder` / `cross_encoder_llm`. **사후 변경 가능**(재임베딩 불요 — 검색 시점 동작) |
| `rerank_config_id` | UUID? | NULL | cross-encoder 리랭커 provider 설정(§2.2). NULL → 워크스페이스 default rerank config, 그것도 없으면 `off` 로 graceful fallback |
| `rerank_candidate_k` | Integer | `50` | 리랭크에 투입할 1차 회수 후보 수(wide pool). vector/graph 회수 단계의 LIMIT 를 이 값으로 확대 |
| `rerank_score_threshold` | Float? | NULL | 리랭크 점수 동적 컷 임계(D1). NULL → 컷 없이 점수순 정렬만, 최종 top-k 로 자름 |
| `rerank_llm_config_id` | UUID? | NULL | `cross_encoder_llm` 모드의 grading LLM. NULL → 워크스페이스 default chat LLM. (graph 모드 `extraction_llm_config_id` 와 동형) |

> `rerank_mode = 'off'` KB 는 위 나머지 컬럼을 무시한다 — graph 모드 KB 가 `vector` 모드에서 graph 컬럼을 무시하는 것과 동일 패턴.
> 리랭킹은 `rag_mode`(vector/graph)와 **직교**한다 — vector·graph 어느 모드의 회수 결과든 후처리로 적용된다. (graph 모드 내부의 "rerank"=centrality 재가중과는 별개 단계 — §10 용어 disambiguation.)

### 2.2 RerankConfig (워크스페이스 리소스)

LLMConfig(`{provider, apiKey, baseUrl?, defaultModel}`, [Spec LLM Client §4](../../spec/5-system/7-llm-client.md))와 **동형의 sibling 리소스**. cross-encoder 리랭커는 chat/embedding 과 API shape 가 달라(전용 `/rerank` 엔드포인트) 별도 capability 로 분리한다.

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `provider` | Enum | `cohere` / `jina` / `voyage` / `tei`(HF Text-Embeddings-Inference, 자가호스팅 bge-reranker) / `local`(OpenAI-compatible `/rerank`) |
| `baseUrl` | String? | 자가호스팅 endpoint. `tei`/`local` 은 필수. **SSRF 가드 재사용** — `local`/`tei` 는 사설망 예외([LLM Client §5.3 SSRF](../../spec/5-system/7-llm-client.md)) |
| `apiKey` | String? | 외부 provider 용. secret-store 경유 |
| `defaultModel` | String | 예: `rerank-3.5`(cohere) / `jina-reranker-v2-base-multilingual` / `bge-reranker-v2-m3` / `dragonkue/bge-reranker-v2-m3-ko`(한국어) |

---

## 3. 검색 후처리 흐름

`RagSearchService.search()` 가 vector/graph 회수로 후보를 만든 **뒤**, KB `rerank_mode` 에 따라 분기한다. KB tool 인터페이스(`kb_*` 의 `query`/`top_k`/`threshold`)는 **불변** — AI Agent 노드·spec 변경 최소.

```
[회수] vector(또는 graph) 검색
   ├─ rerank_mode = off:
   │     기존 그대로 — cosine score ≥ threshold AND ORDER BY score DESC LIMIT top_k
   │     (하위호환: 현 동작과 byte-identical)
   │
   └─ rerank_mode ≠ off:
        1) wide 회수: cosine threshold 적용하지 않고 rerank_candidate_k(기본 50) 만큼 회수
           (리랭커가 볼 후보를 cosine 임계로 미리 굶기지 않음 — D1/D2)
        2) cross-encoder rerank: (query, chunk.content) 쌍을 RerankConfig endpoint 로 점수화
        3) [cross_encoder_llm 한정] escalate 조건 충족 시 listwise LLM grading (§4.2)
        4) 동적 점수 컷(D1): rerank_score_threshold 가 있으면 점수 < 임계 청크 drop;
           없으면 점수순 정렬만
        5) 최종 top_k(노드 ragTopK 또는 LLM override) 로 slice
```

- 회수→리랭크→컷 순서로, **컷 기준이 cosine → rerank score 로 이동**한다. `rerank_mode ≠ off` 일 때 `kb_*` 의 `threshold` 인자는 **rerank 점수 임계**로 해석된다(없으면 `rerank_score_threshold`). cosine 임계는 wide 회수에서 적용하지 않는다.
- graph 모드 + rerank: graph 가 seed+expanded 로 만든 후보 집합을 cross-encoder 가 재점수화한다(centrality 가중은 graph 내부 1차, cross-encoder 는 2차).

---

## 4. 리랭크 모드

### 4.1 `cross_encoder` (기본 권장)
- 단일 cross-encoder 호출로 후보 전체 재점수화 → 동적 컷 → top-k.
- 한국어 권장 모델: `dragonkue/bge-reranker-v2-m3-ko`(자가호스팅 TEI). 지연 ~수십 ms, query당 저비용.
- **escalate 없음** — 대부분의 KB 에 충분.

### 4.2 `cross_encoder_llm` (정책·지시 판단 KB)
- `cross_encoder` 수행 후, **escalate 조건**이면 survivors(~15개)에 listwise LLM grading 1콜 추가:
  - escalate 조건(AND): ① cross-encoder 상위 점수가 평탄/모호(임계 미달 또는 점수 분산 작음) ② KB 가 정책·지시 기반 판단 KB 로 표시됨.
  - LLM 은 후보 id 목록을 **관련도 순서 + 1~10 점수**로 1콜 반환(pointwise 금지 — N콜·이점 0). 점수 동적 컷 적용.
  - grading LLM = `rerank_llm_config_id`(NULL → ws default chat).
- 비용·지연(+0.5~1s/콜)을 감수할 가치가 있는 KB 에만. grader 가 "관련 없음" 판정 시 빈 결과 → tool_result `results: []`(LLM 이 근거 부재 인지, 환각 억제).

---

## 5. config (설정 위치)

- **KB 단위**(knowledge-base.md): `rerank_mode` / `rerank_config_id` / `rerank_candidate_k` / `rerank_score_threshold` / `rerank_llm_config_id`. KB 가 자신의 검색 파이프라인을 소유(embedding_model·rag_mode 가 KB 단위인 것과 일관).
- **워크스페이스 단위**: RerankConfig 리소스(§2.2) + 선택적 default rerank config 지정.
- **AI Agent 노드 단위**(ai-agent.md §1): 기존 `ragTopK`/`ragThreshold` 유지. 의미 보강:
  - `ragTopK` = **리랭크 후** 최종 청크 수(LLM override 가능).
  - `ragThreshold` = `rerank_mode=off` → cosine 임계(현행). `rerank_mode≠off` → rerank 점수 임계 default(KB `rerank_score_threshold` 미설정 시 fallback).
  - 노드는 리랭커 provider·모드를 직접 노출하지 않는다(KB 소유) — graph 파라미터를 KB 단위로만 노출한 결정([Graph RAG §120])과 일관.

---

## 6. LLM Client — rerank capability ([Spec LLM Client §3](../../spec/5-system/7-llm-client.md))

`LLMClient` 에 선택적 `rerank()` 추가:
```ts
rerank?(query: string, documents: string[], model?: string,
        opts?: { topK?: number }): Promise<{ index: number; score: number }[]>;
```
- provider 별 매핑: cohere `POST /v1/rerank`, jina `POST /rerank`, tei `POST /rerank`, local OpenAI-compatible `/rerank`(또는 vLLM `/score`).
- `rerank()` 미지원 provider 로 RerankConfig 가 잘못 구성되면 `LLM_CONFIG_INVALID`.
- LLM client 팩토리·SSRF 가드·secret-store 경유 등 기존 인프라 재사용.

---

## 7. 에러 처리 / graceful degradation

| 상황 | 처리 |
| --- | --- |
| RerankConfig 미구성/조회 실패 | 해당 KB 는 **`off` 로 fallback**(cosine 경로). 경고 로그. 노드 실패 아님 |
| 리랭커 endpoint 호출 실패/타임아웃 | wide 회수 결과를 **cosine score 순**으로 top-k 컷 후 반환(fallback). `ragDiagnostics.rerank.error = "RERANK_ENDPOINT_FAILED"` 기록 |
| `cross_encoder_llm` 의 grading LLM 실패 | cross-encoder 결과로 fallback(LLM 단계만 skip). `error = "RERANK_LLM_GRADING_FAILED"` |
| RerankConfig 미지원 provider 구성 | `error = "RERANK_CONFIG_INVALID"`(구성 시점) |
| 회수 0건 | 기존대로 `results: []` |

> 에러 코드는 `UPPER_SNAKE_CASE`([Spec 에러 처리 규약](../../spec/5-system/3-error-handling.md)). 신규 코드 `RERANK_ENDPOINT_FAILED` / `RERANK_LLM_GRADING_FAILED` / `RERANK_CONFIG_INVALID` 는 spec 반영 시 `spec/conventions/error-codes.md` 레지스트리 등재 여부 결정(I7). 단 이들은 노드 실패가 아니라 진단 필드 값이므로 cosine 경로로 안전 강등은 유지.

> **원칙**: 리랭킹은 **품질 향상 부가 단계**이며, 어떤 실패도 검색 자체를 죽이지 않는다 — 항상 cosine 경로로 안전 강등. (기존 graceful degradation 원칙 §[9-rag-search §6] 확장.)

---

## 8. 출력 메타데이터 (ragDiagnostics 확장)

`meta.ragDiagnostics` 에 rerank 진단 추가(선택 — `rerank_mode≠off` 호출 시에만):
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
`ragSources[].score` 는 rerank 적용 시 **rerank 점수**(0~1 정규화). `origin` 에 `reranked` 표기 가능. run-results References 탭이 이를 그대로 표시.

---

## 9. UI ([Spec Knowledge Base](../../spec/2-navigation/5-knowledge-base.md))

KB 상세/생성 폼에 "검색 정밀화(Reranking)" 섹션:
```
── Reranking ──  (선택)
Mode:  [Off ▼]   (Off / Cross-encoder / Cross-encoder + LLM)
┊ (Off 아닐 때)
┊  Reranker:        [내 bge-reranker-ko ▼]  (RerankConfig 선택)
┊  Candidate pool:  [50__]
┊  Score cutoff:    [____]  (비우면 컷 없음)
┊ (Cross-encoder + LLM 일 때)
┊  Grading LLM:     [Workspace default ▼]
```
- Off 가 기본 — 기존 KB 는 마이그레이션 시 모두 `off` 로 채워져 동작 불변.
- 워크스페이스 설정에 RerankConfig 관리 화면 추가(LLMConfig 관리와 동일 패턴).

---

## 10. 반영 대상 spec (consistency-check 통과 후)

> consistency-check `00_02_05` 반영: W1·W2(data-model)·W3(9-rag-search §3.1)·W4(graph 용어)·I8(swagger DTO) 항목 추가.

1. `spec/5-system/9-rag-search.md` — §3 뒤에 "검색 후처리(리랭킹)" 절 신설; **§3.1 `$3 threshold` 설명에 `rerank_mode` 분기 명시**(off→cosine 임계 / ≠off→rerank 점수 임계, W3); §4.1 `ragSources[].score` 이중 의미 + `origin?: 'cosine' | 'reranked'`(I3); §4.2 `ragDiagnostics.rerank?` 서브객체 스키마(I2); §6 에러 처리 확장.
2. `spec/5-system/7-llm-client.md` — **`RerankClient`/`RerankClientFactory` 별도 인터페이스 경로**(LLMClientFactory 오염 방지, I1), §2 프로바이더 표에 Rerank 열, `/rerank` 매핑, RerankConfig provider.
3. `spec/2-navigation/5-knowledge-base.md` — KB rerank 컬럼·UI, 워크스페이스 RerankConfig 관리.
4. `spec/4-nodes/3-ai/1-ai-agent.md` — §1 `ragTopK`/`ragThreshold` 의미 보강 노트(리랭크 후 top-k / `rerank_mode≠off` KB 에서는 rerank 점수 임계로 해석, I4). ⚠️ **착수 전 `claude/ai-context-memory-9c7e6e` branch(같은 파일 §1 에 `memoryTopK`/`memoryThreshold` 추가, active·PR 없음) 의 main merge 여부 확인 — 미merge 시 직렬화/수동 resolve**(W5).
5. `spec/1-data-model.md` — **§2.11 `KnowledgeBase` 에 5개 rerank 컬럼 동기화**(W1); **§1 ER 다이어그램 + 신규 §2.N `RerankConfig` 엔티티 등재**(W2).
6. `spec/5-system/10-graph-rag.md` — graph 내부 score 재정렬을 **"centrality-weighted score blending"** 으로 명명, cross-encoder 후처리 reranking 과 disambiguation; **KB-GR-SR-05 설명 동기화**(W4).
7. (마이그레이션 + DTO) `knowledge_base` 컬럼 추가(기존 행 `rerank_mode='off'` backfill); RerankConfig DTO·KB 확장 DTO 에 `swagger.md §1` 패턴(JSDoc 한국어 주석 + class-validator) 적용(I8).

---

## Rationale

- **왜 완전 선택적(off 기본)인가**: 셀프호스팅 배포에서 리랭커 인프라(GPU·외부 API)를 강제하면 진입장벽·운영비가 오른다. `off` 기본은 (a) 하위호환 byte-identical (b) 리랭커 없는 배포에서도 제품 동작 (c) 점진 도입 가능. 리랭킹은 "품질 부가 단계"이지 필수 경로가 아니라는 §7 원칙과 일관.
- **왜 KB 단위인가**: 검색 파이프라인 소유권을 KB 에 둔 기존 결정(`rag_mode`·`embedding_model`·graph 파라미터 KB 단위, [Graph RAG §120])과 일관. KB 마다 도메인·문서 성격이 달라 리랭크 전략도 KB 단위가 자연스럽다. 노드 단위로 빼면 같은 KB 를 여러 노드가 쓸 때 설정이 분산된다.
- **왜 `rag_mode` 는 불변인데 `rerank_mode` 는 가변인가**(I5): `rag_mode`(vector/graph)는 임베딩·entity 추출 등 **적재 산출물의 형태**를 결정해 사후 변경 시 재임베딩·재추출이 필요하다. `rerank_mode` 는 **검색 시점에만** 적용되는 후처리라 적재 산출물에 영향이 없어 재임베딩·마이그레이션 없이 토글 가능하다. 따라서 비대칭이 정당하다.
- **왜 `ragThreshold` 의미를 재해석(이중화)했나**(I4): 별도 신규 필드를 추가하기보다 기존 `ragThreshold` 를 `rerank_mode` 에 따라 분기 해석한다 — off 면 cosine 임계(현행), ≠off 면 rerank 점수 임계 default. 신규 노드 config 필드 증식을 피하고, "최소 관련도 컷" 이라는 사용자 의도가 두 경로에서 동일하기 때문. `ai-agent.md §1` 의 `ragThreshold` 행에 분기 주석을 명시한다.
- **왜 rerank 구성 오류에 전용 에러 enum 을 안 만드나**(I6): rerank 미지원 provider 구성은 **실행 중 실패가 아니라 구성 시점 검증 실패**라 기존 `LLM_CONFIG_INVALID` 계열로 충분하다(`LLM_STREAMING_UNSUPPORTED` 같은 런타임 전용 코드와 성격이 다름). 단 검색 시점 endpoint 호출 실패는 진단 필드(`ragDiagnostics.rerank.error`)에 `RERANK_ENDPOINT_FAILED` 등으로 별도 기록한다(§7·§8).
- **왜 cross-encoder 가 기본, LLM grading 은 escalate 인가** (D2): 심화 리서치상 broad 벤치에서 cross-encoder 가 LLM 리랭커와 동급~우위이면서 지연·비용 1~2 자릿수 낮음. fin.ai(고객지원 도메인) A/B 에서 listwise LLM 은 해결률 이점 0·40% 느림. LLM 의 실익은 정책·지시 판단·근거 인용 → escalate 한정. (출처: plan §5.)
- **왜 동적 점수 컷인가** (D1): 고정 top-k 는 query-의존 최적 k 를 무시 → 의미 청크 누락 + lost-in-the-middle. 점수 임계 동적 컷이 토큰−60%·환각−10% (CAR). 컷 기준을 cosine→rerank 점수로 옮기는 게 핵심.
- **왜 RerankConfig 를 LLMConfig 와 분리(sibling)했나**: 리랭커는 chat/embedding 과 API shape 가 다른 별도 model class. capability flag 로 LLMConfig 에 욱여넣기보다 sibling 리소스가 명확. 단 provider 추상화·SSRF 가드·secret-store 는 재사용 → 신규 인프라 최소.
- **폐기한 대안**:
  - *노드 단위 리랭크 설정*: KB 소유권 원칙 위반·설정 분산. 기각.
  - *항상 리랭크(off 없음)*: 셀프호스팅 강제 의존성. 기각.
  - *cosine 임계 유지한 채 리랭크*: wide 후보를 cosine 으로 미리 굶겨 리랭커 효과 반감. 기각(§3 에서 wide 회수 시 cosine 임계 미적용).
  - *VectorChord/ColBERT 등 in-DB 리랭킹*: 한국어 토크나이저 부재·인프라 복잡. cross-encoder API/TEI 로 충분(plan D7).
- **남은 결정(착수 전)**: ① RerankConfig provider 1차 지원 범위(cohere/jina/tei 최소셋?) ② escalate 조건의 정량 임계(점수 분산·평탄도) — P0 평가셋으로 튜닝 ③ KB "정책 판단 KB" 표시 방법(플래그 vs 휴리스틱).
