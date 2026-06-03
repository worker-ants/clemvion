---
worktree: rag-quality-proposal-0c618c
started: 2026-06-03
owner: 사용자 본인 / planner
---
# AI Agent 지식베이스(RAG) 품질 개선

> 작성일: 2026-06-03
> 성격: 리서치 기반 개선 제안 + 실행 plan. **현 단계는 제안·설계 문서화(백업용 PR)** — spec 본문 개정·구현은 후속 phase 에서 `project-planner`(consistency-check 의무) / `developer` 로 진행.
> 관련 spec: [`spec/5-system/8-embedding-pipeline.md`](../../spec/5-system/8-embedding-pipeline.md) · [`spec/5-system/9-rag-search.md`](../../spec/5-system/9-rag-search.md) · [`spec/5-system/10-graph-rag.md`](../../spec/5-system/10-graph-rag.md) · [`spec/4-nodes/3-ai/1-ai-agent.md`](../../spec/4-nodes/3-ai/1-ai-agent.md) · [`spec/2-navigation/5-knowledge-base.md`](../../spec/2-navigation/5-knowledge-base.md)
> 핵심 코드: `codebase/backend/src/modules/knowledge-base/{embedding,search,chunking,graph}/**`, `codebase/backend/src/nodes/ai/ai-agent/tool-providers/kb-tool-provider.ts`

---

## 1. 배경 / 현재 구조 진단 (실측 기반)

현 RAG 는 **dense-only + 리랭킹 없음 + 정량 평가 없음** 의 1세대 구조.

| 영역 | 현재 | 평가 |
| --- | --- | --- |
| 임베딩 | OpenAI `text-embedding-3-small`(1536d), **KB 단위 UI 선택형** | 🟡 한국어 검색 약함. 단 유저 선택 가능(제품 레벨 해결됨) |
| 벡터스토어 | pgvector, cosine, 차원별 partial HNSW, halfvec | 🟢 견고 |
| 검색 | semantic-only(`vector` 모드). `rag-search.service.ts:253` `ORDER BY score DESC LIMIT topK` | 🔴 정확 용어(SKU·코드·정책ID·고유명사) 취약, 렉시컬 신호 없음 |
| 리랭킹 | **없음**(cosine 직접). graph 모드의 "rerank" 는 centrality 재가중일 뿐 | 🔴 정밀도 최대 미사용 레버 |
| 후처리 컷 | threshold(0.7)/topK(5) **SQL 단계 선차단**, UI 설정 가능 | 🟡 고정 개수 컷 → 의미 청크 누락 위험 |
| 청킹 | 계층 분할, 1000토큰/200오버랩 고정 | 🟡 회수 입도 큼, retrieval≠generation 단위 미분리 |
| Agentic RAG | LLM tool calling + query 분해 | 🟢 최상위 query-side 기법 보유 |
| Graph RAG | entity/relation hybrid(선택 모드) | 🟢 entity 추출 기계 존재 → 재활용 가능 |
| 평가 | 없음(probe + 진행률 stats) | 🔴 개선 효과 증명 수단 부재 |
| input_type/prefix | 없음(원문 직접 임베딩) | 🟡 현재 무해, 모델 교체 시 필수 대응 |

강점: 비동기 파이프라인(BullMQ, idempotent), KB 단위 모델/차원 일관성 강제, graceful degradation, agentic 분해는 잘 설계됨. **개선은 검색 품질 레이어에 집중.**

---

## 2. 설계 결정 (사용자 논의 반영)

본 plan 의 방향을 규정하는 확정 결정. (논의에서 사용자가 직접 교정한 사항 포함)

### D1. "size cut" 문제 = 컷 방식 문제 (모델 선택과 분리)
- 의미 있는 청크가 고정 top-k 에서 잘리는 문제는 리랭커/LLM 선택과 무관.
- **결정**: 고정 개수 컷 → **점수 기반 동적 컷**(관련성 ≥ θ 통과, token-budget 상한). 회수는 넓게(30~50), 컷은 점수로.

### D2. 2차 정밀화 = 리랭커와 LLM grading 의 단계 선택 (양자택일 아님)
- **결정**: 후보 수 기반 단계 구성.
  - 후보 多 → cross-encoder 싸게 1차 컷(50→~15) + **listwise LLM relevance grading**(RankGPT/CRAG식, 1콜) 최종 판정.
  - 후보 적음(≤~20) → 리랭커 생략, **LLM grading 단독** 가능.
- 이 코드베이스는 agentic 이라 chat LLM 인프라·한국어 추론력이 이미 있어 LLM grading 적합.
- grader 가 "근거 없음" 반환 시 agent 에 명시 전달(환각 억제). 기존 graceful degradation 출력 구조 활용.
- ⚠️ 미확정: 리랭커 vs LLM grading vs 2-stage 의 우월성은 데이터 의존 → P0 평가셋으로 A/B. (심화 리서치 진행 중)

### D3. 정확 용어 매칭 = 3-신호 + verbatim/동의어 분리
- BM25 만으로 정확 용어 보장 안 됨(특히 한국어 형태소 분할). 사용자 제안(적재 시 LLM 키워드 추출 + 검색 시 가중 OR) 채택하되 분리:
  - **verbatim 식별자(SKU·코드·번호)** → **결정적 regex/pattern 추출**(LLM 환각 없음·재현성 100%).
  - **동의어/별칭/정규 엔티티명** → **LLM 추출**.
- **결정**: `dense + lexical(BM25) + keyword/entity 사이드카` **3-신호 RRF 융합** + keyword 일치 가중.
- **graph 모드 entity-extraction 파이프라인을 vector 모드 KB 로 경량 확장**해 재활용.

### D4. Parent-document (small-to-big) 채택 — 사용자 승인
- 작은 child 색인 → 검색 → coherent parent 주입. 상세 설계 §P3.
- 부수효과: D1 의 "의미 청크 누락" 추가 완화(작게 많이 회수 → merge), 청크 경계 정밀화 필요성 흡수(D6).

### D5. 임베딩 모델 교체는 제품 제안서에서 제외
- KB 단위 UI 선택형이라 유저가 직접 선택. **단** UX 힌트(한국어 추천 프리셋)·모델 교체 시 input_type/prefix 자동 배선·재임베딩 경고는 백로그(§P6).

### D6. Contextual Retrieval > 정확-범위 청크 생성
- 둘은 다른 문제(맥락 보강 vs 경계). 측정 증거는 Contextual Retrieval(Anthropic: 회수실패 −35~67%)이 강하고, 경계 청킹(semantic/LLM)은 약/혼재(Chroma·NVIDIA).
- **P3(parent-document)가 경계 정밀화 효용을 대부분 흡수**하므로 경계 청킹엔 투자 안 함.
- **결정**: 맥락 보강 2단계 — ① 결정적 메타데이터 prepend(헤더경로+제목, 즉시·LLM불요) → ② 잔여 맥락손실이 eval 에 보이면 LLM contextual blurb.
- **적재 1콜 통합**: child 당 cheap-LLM 1콜(prompt-cached)로 `contextual blurb + 동의어/키워드 + 엔티티` 동시 생성 → D3·D6 비용 합산.

### D7. 권하지 않음 (근거 대비 과대평가/부적합)
- semantic/LLM 경계 청킹(증거 약), late chunking(OpenAI 임베딩과 비호환·이득 작음), HyDE(이커머스 SKU/가격 환각 위험·agentic 분해가 대체), ColBERT/multi-vector(VectorChord 필요·리랭커가 대체).

---

## 3. 단계별 작업

> 각 Phase 는 (a) 구현 작업 + (b) 해당 spec 본문 갱신을 **함께** 포함한다(`memory/feedback_plan_must_include_spec_updates.md`). spec 갱신은 `project-planner` + `consistency-check`, 구현은 `developer`.

### P0 — 평가 하베스 (모든 것의 전제) ⭐
- [ ] 응답 로깅: `(query, 회수 chunk_id+score, 최종답변, 인용, thumbs, "답변없음" 플래그)` 구조화. (기존 `ragSources`/`ragDiagnostics` 출력 절반 재활용)
- [ ] 한국어+영어 골든셋 ~50~150건(질문→정답→관련 chunk_id). CS 로그 마이닝 + 합성 생성.
- [ ] 검색 지표(순수 TS, LLM비용 0): Recall@k / Precision@k / MRR / nDCG@k / hit-rate. CI 회귀 게이트.
- [ ] 생성 지표(`autoevals` npm, TS-native): faithfulness / answer relevancy / context relevance. PR 트리거(매커밋 아님).
- [ ] LLM-judge 편향 완화: temp=0, position swap, 인간 라벨 슬라이스 보정.
- [ ] **spec 갱신**: `spec/5-system/9-rag-search.md` 또는 신규 `spec/conventions/rag-evaluation.md` 에 평가 체계 정의.

### P1 — 검색 후처리 재설계 ⭐
- [ ] 고정 top-k → **점수 기반 동적 컷**(D1). 회수 폭 확대(30~50), token-budget 상한.
- [ ] **listwise LLM relevance grading**(D2) 단계 삽입. `RagSearchService.search()` 내부 — tool 인터페이스(top_k/threshold) 불변.
- [ ] (옵션) 후보 多 시 cross-encoder 1차 컷. 한국어 리랭커(`bge-reranker-v2-m3-ko` 등) 후보.
- [ ] "근거 없음" → agent 명시 전달.
- [ ] **spec 갱신**: `spec/5-system/9-rag-search.md` 검색 흐름·컷 정책, `spec/4-nodes/3-ai/1-ai-agent.md` ragTopK/threshold 의미 변화.

### P2 — 3-신호 하이브리드 검색
- [ ] lexical 색인: 한국어 토크나이저(`pgroonga`/`pg_bigm` 등 — 리서치 진행 중) + `tsvector`/GIN.
- [ ] verbatim 식별자 결정적 추출(regex) → 전용 keyword 색인.
- [ ] LLM 동의어/엔티티 사이드카(graph 추출 재활용·확장) → `chunk_keyword`(또는 entity 테이블 재사용).
- [ ] **RRF 3-list 융합**(dense+lexical+keyword) + keyword 일치 가중. (k 상수·가중치 튜닝)
- [ ] **spec 갱신**: `spec/5-system/9-rag-search.md` 하이브리드 흐름, `spec/5-system/8-embedding-pipeline.md` 색인 단계.

### P3 — Parent-document (small-to-big) + 메타데이터 prepend
- [ ] 스키마: `document_chunk` 에 `level SMALLINT`(0=child/1=parent) + `parent_chunk_id UUID` 추가. HNSW partial index 를 `level=0` 한정.
- [ ] 적재: parent(~1000~2000토큰, 섹션 경계) / child(~250~400토큰, overlap 10%). child 만 임베딩·색인.
- [ ] 검색 흐름: child 검색 → distinct parent dedup → **auto-merge 휴리스틱**(임계 이상 sibling 생존 시 parent 반환) → token-budget 컷.
- [ ] 인용: matched=child(정밀), context=parent. `ragSources[]` 에 `contextContent` 추가, `chunkId`=child 유지.
- [ ] 메타데이터 prepend(결정적): child 앞에 헤더경로+문서제목.
- [ ] config(KB 단위): `child_size`/`parent_size`/`child_overlap`/`auto_merge_threshold`.
- [ ] 마이그레이션: 재청킹+재임베딩(기존 KB 재임베딩 메커니즘 활용; 모델 교체 사이클과 병행 권장).
- [ ] **spec 갱신**: `spec/5-system/8-embedding-pipeline.md` 청킹·스키마, `spec/5-system/9-rag-search.md` parent 주입.

### P5 — 맥락 보강 (LLM contextual blurb)
- [ ] (P3 메타데이터 prepend 후) 잔여 맥락손실이 eval 에 보이면 도입.
- [ ] 적재 1콜 통합(D6): child 당 cheap-LLM(prompt-cached) → `blurb + 키워드/동의어 + 엔티티` 동시 생성. → P2·P5 비용 합산.
- [ ] **spec 갱신**: `spec/5-system/8-embedding-pipeline.md` 적재 enrichment 단계.

### P6 — 임베딩 모델 UX 보강 (백로그, 코드작업 소)
- [ ] 모델 선택 UI 한국어 추천 프리셋/힌트.
- [ ] 모델 교체 = 전면 재임베딩 경고 + 진행률 연결(기존 버튼 활용).
- [ ] e5/voyage/cohere 계열 선택 시 input_type/prefix(query vs passage) 자동 배선 — silent bug 방지.
- [ ] **spec 갱신**: `spec/2-navigation/5-knowledge-base.md` / `spec/5-system/8-embedding-pipeline.md`.

---

## 4. 우선순위 / 의존

```
P0(평가) ──선행── 모든 Phase 의 효과검증·임계튜닝
P1(후처리) ── 재임베딩 불요, 즉시 효과. 단독 가능
P2(하이브리드) ── lexical 색인 추가
P3(parent-doc) ── 재임베딩 동반 (모델교체 사이클과 묶기)
P5(contextual) ── P3 이후, 적재 1콜에 P2 키워드 통합
P6(UX) ── 독립 백로그
```
권장 착수 순서: **P0 → P1 → P2 → P3 → P5** (P6 병렬).

---

## 5. 근거 (1차 리서치 출처)

- 하이브리드 베이스라인·RRF(k=60): [supabase hybrid](https://supabase.com/docs/guides/ai/hybrid-search), [paradedb](https://www.paradedb.com/blog/hybrid-search-in-postgresql-the-missing-manual)
- 리랭킹 +nDCG 15~30%·컷 이전: [vectorize.io](https://vectorize.io/blog/why-you-should-always-use-a-reranker-when-doing-rag), [towardsdatascience](https://towardsdatascience.com/advanced-rag-retrieval-cross-encoders-reranking/)
- 한국어 리랭커: [HF dragonkue/bge-reranker-v2-m3-ko](https://huggingface.co/dragonkue/bge-reranker-v2-m3-ko)
- Contextual Retrieval(−35~67%): [Anthropic](https://www.anthropic.com/news/contextual-retrieval)
- 청킹 평가(~200토큰 최적, 800/400 저조): [Chroma](https://www.trychroma.com/research/evaluating-chunking), [NVIDIA](https://developer.nvidia.com/blog/finding-the-best-chunking-strategy-for-accurate-ai-responses/)
- parent-document/auto-merge: [LlamaIndex](https://developers.llamaindex.ai/python/examples/retrievers/auto_merging_retriever/)
- 한국어 임베딩 리더보드: [KURE](https://github.com/nlpai-lab/KURE), OpenAI MIRACL 44.0 [pinecone](https://www.pinecone.io/learn/openai-embeddings-v3/)
- 평가(TS): [autoevals npm](https://www.npmjs.com/package/autoevals), [RAGAS](https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/)
- asymmetric prefix 버그: [Pinecone E5](https://www.pinecone.io/learn/the-practitioners-guide-to-e5/)

---

## 6. 미해결 결정 / 심화 리서치 진행 중

2026-06-03 백그라운드 심화 리서치 5스트림 진행 중 — 완료 시 본 plan §2·§3 갱신:
1. LLM grading(CRAG/Self-RAG/RankGPT) vs cross-encoder head-to-head — 단계 선택 결정 규칙 확정.
2. PostgreSQL 한국어 하이브리드(pgroonga/pg_bigm/mecab) + 3-list RRF + verbatim 매칭 — P2 구현 스택 확정.
3. parent-document/auto-merge 프로덕션 파라미터(child/parent size, merge threshold, rerank 위치) — P3 파라미터 확정.
4. 적재 LLM enrichment(contextual + keyword 통합 1콜) 비용/효과 — P5·P2 통합 검증.
5. TS/NestJS 평가 하베스 + 한국어 합성 QA 생성 — P0 구현 스택 확정.

남은 결정:
- [ ] P1 단계 구성(리랭커 도입 여부, 한국어 리랭커 self-host vs API) — 리서치#1 + P0 A/B 후.
- [ ] P2 한국어 토크나이저/확장 선택(managed Postgres 제약 고려) — 리서치#2 후.
- [ ] P3 스키마 옵션(단일 테이블 level 판별 vs 별도 parent 테이블) 확정 — 리서치#3 후.
- [ ] 평가셋 규모·합성 생성 방식 — 리서치#5 후.
