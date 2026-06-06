---
worktree: rag-quality-proposal-0c618c
started: 2026-06-03
owner: 사용자 본인 / planner
---
# AI Agent 지식베이스(RAG) 품질 개선

> 작성일: 2026-06-03 (심화 리서치 5스트림 통합본)
> 성격: 리서치 기반 개선 제안 + 실행 plan. **현 단계는 제안·설계 문서화** — spec 본문 개정·구현은 후속 phase 에서 `project-planner`(consistency-check 의무) / `developer`.
> 관련 spec: [`spec/5-system/8-embedding-pipeline.md`](../../spec/5-system/8-embedding-pipeline.md) · [`spec/5-system/9-rag-search.md`](../../spec/5-system/9-rag-search.md) · [`spec/5-system/10-graph-rag.md`](../../spec/5-system/10-graph-rag.md) · [`spec/4-nodes/3-ai/1-ai-agent.md`](../../spec/4-nodes/3-ai/1-ai-agent.md) · [`spec/2-navigation/5-knowledge-base.md`](../../spec/2-navigation/5-knowledge-base.md)
> 핵심 코드: `codebase/backend/src/modules/knowledge-base/{embedding,search,chunking,graph}/**`, `codebase/backend/src/nodes/ai/ai-agent/tool-providers/kb-tool-provider.ts`
> 증거 강도 표기: **[강]** 1차/벤치/독립재현 · **[중]** 일관된 실무 2차 · **[약]** 단일출처/관례(벤치 없음)

---

> **P1(리랭킹) 진행 현황 (2026-06-05)**: cross_encoder(#465)·threshold/진단(#466)·cross_encoder_llm grading + UI + spec 완결성(#478) 머지 완료. provider 확장(jina/voyage/local/builtin)은 DROP, conditional escalate 임계는 P0 의존. P0·P2·P3·P5·P6 는 미착수.

## 1. 배경 / 현재 구조 진단 (실측 기반)

현 RAG 는 **dense-only + 리랭킹 없음 + 정량 평가 없음** 의 1세대 구조.

| 영역 | 현재 | 평가 |
| --- | --- | --- |
| 임베딩 | OpenAI `text-embedding-3-small`(1536d), **KB 단위 UI 선택형** | 🟡 한국어 검색 약함. 단 유저 선택 가능 |
| 벡터스토어 | pgvector, cosine, 차원별 partial HNSW, halfvec | 🟢 견고 |
| 검색 | semantic-only(`vector` 모드). `rag-search.service.ts:253` `ORDER BY score DESC LIMIT topK` | 🔴 정확 용어 취약, 렉시컬 신호 없음 |
| 리랭킹 | **없음**(cosine 직접). graph 모드 "rerank"=centrality 재가중 | 🔴 정밀도 미사용 레버 |
| 후처리 컷 | threshold(0.7)/topK(5) **SQL 단계 선차단**, UI 설정 가능 | 🔴 **고정 개수 컷 = 최우선 문제**(아래 D1) |
| 청킹 | 계층 분할, 1000토큰/200오버랩 고정 | 🟡 회수 입도 큼, retrieval≠generation 미분리 |
| Agentic RAG | LLM tool calling + query 분해 | 🟢 최상위 query-side 기법 보유 |
| Graph RAG | entity/relation hybrid(선택 모드) | 🟢 entity 추출 기계 존재 → 재활용 |
| 평가 | 없음(probe + 진행률 stats) | 🔴 개선 효과 증명 수단 부재 |
| input_type/prefix | 없음(원문 직접 임베딩) | 🟡 현재 무해, 모델 교체 시 필수 대응 |

---

## 2. 설계 결정 (사용자 논의 + 심화 리서치 반영)

### D1. "size cut" 문제 = 컷 방식 문제 — **최대 단일 레버** [강]
- 고정 top-k 컷은 query-의존 최적 k 를 무시 → 의미 청크 누락 + lost-in-the-middle.
- **결정**: 고정 개수 컷 → **점수 기반 동적 컷**(관련성 ≥ θ 통과, token-budget 상한). 회수 넓게(30~50), 컷은 점수로, 생성 주입은 ~8~12개 상한.
- 근거: Cluster-based Adaptive Retrieval(CAR) **토큰 −60%·지연 −22%·환각 −10%** [강]. fin.ai(고객지원) 운영: 5~10 스케일 점수 <5 drop, 지연 ~5s→<1s.
- ⇒ "어떤 리랭커냐"보다 **동적 컷 자체가 측정상 가장 큰 이득**.

### D2. 2차 정밀화 — **cross-encoder 기본 + LLM grading escalate** (직관 수정) [강]
- 심화 리서치가 사용자 초안("리랭커 대신 LLM")을 **부분 수정**: broad 벤치에서 **cross-encoder 가 LLM 리랭커와 동급~우위**, 지연·비용은 1~2 자릿수 낮음(BGE ~12ms/$2per1k vs LLM listwise ~420ms/$18~27). LLM listwise 우위는 TREC-DL/GPT-4 에서 2~4 nDCG 점, broad BEIR 에선 열세도.
- fin.ai(우리 도메인) A/B: listwise 가 pointwise 대비 해결률 이점 0·40% 느림·15% 비쌈. 단 LLM 리랭커가 cross-encoder 대비 **근거 인용(+63% KB 인용)·정책 판단**은 개선.
- **결정**:
  - **기본(~95%)**: pgvector top-50 → **cross-encoder 리랭크**(`dragonkue/bge-reranker-v2-m3-ko`, 한국어 0.91 F1 [강]) → **D1 동적 점수 컷**. 별도 LLM hop 없음.
  - **escalate(소수)**: ① cross-encoder 상위 점수 평탄/모호 ② 정책·지시 기반 판단 필요(예 "현 정책상 환불 대상인가") ③ 지연 감당 가능 → **listwise LLM grading 1콜**(survivors ~15개, pointwise 금지) + 점수컷. fin.ai 레시피.
  - grader "근거 없음" → agent 명시 전달(환각 억제, ASQA 인용정밀도 Self-RAG 5.5→66.9 [강]).
- ⚠️ LLM listwise **한국어 reranking 품질 미검증** → P0 평가셋으로 cross-encoder vs LLM-grade A/B 후 escalate 임계 확정.

### D3. 정확 용어 = 3-신호 + verbatim/동의어 분업 [강]
- BM25 만으로 정확 용어 보장 안 됨(한국어 형태소 분할). 분업:
  - **verbatim 식별자(SKU·코드·번호)** → **결정적 regex 추출** → 정규화 keyword 색인 + `pg_trgm`(부분/오타). LLM 전사 금지(전사 오류).
  - **동의어/별칭/정규 엔티티명** → **LLM 추출**(IterKey 등 [중]). 한국어 CS 의 "고객 호칭 ≠ 정식명" 해소.
- **결정**: `dense + lexical(BM25/형태소) + keyword/entity` **3-신호 RRF 융합**(k=60, dense w1.0·lexical w0.9·**entity w1.5**), 각 CTE 에 tenant/doc-type 필터 복제.
- **graph 모드 entity-extraction 을 vector 모드 KB 로 경량 확장**해 재활용 → 신규 비용은 동의어 확장뿐.

### D4. Parent-document — 채택하되 "큰 parent 주입"은 A/B 필수 [중]
- **"작게 검색"은 증거 있음**(Chroma: 200토큰이 400대비 정밀도 ~2배, recall −1.4pp) [강]. **"큰 parent 주입"은 관례(ablation 없음)** [약] — 자족 factoid 엔 오히려 노이즈.
- **결정**: children(~300토큰, overlap ~0)만 임베딩·색인 / 검색 후 조건부 parent merge. 단 **읽기시점 3안 A/B**: ⓐ child only ⓑ child+contextual-prefix ⓒ parent merge. (Anthropic contextual 이 더 저토큰으로 이길 수 있음.)
- auto-merge 임계 0.5(LlamaIndex 기본), **리랭크는 children 단계 → 그 뒤 merge**.

### D5. 임베딩 모델 교체 = UI 선택형 → 제품 제안서 제외 [강]
- KB 단위 UI 선택. **단** UX 힌트(한국어 추천 프리셋)·교체 시 input_type/prefix 자동 배선·재임베딩 경고만 백로그(§P6).
- 한국어 리더보드: KURE-v1/arctic-ko > BGE-M3 > text-embedding-3(최하위권). 단 유저 선택이라 코드 강제 아님.

### D6. Contextual Retrieval > 경계 청킹, 단 blurb 는 cheap add-on [강]
- 둘은 다른 문제(맥락 보강 vs 경계). Anthropic: contextual embedding −35%, +BM25 −49%, +rerank −67% [강]. **단 독립재현(arXiv 2604.01733): blurb 단독은 +2~3pp recall, 큰 레버는 BM25+reranking(+12.1pp)** [강].
- 경계 청킹(semantic/LLM)은 약/혼재 [중], P3 가 경계 효용 흡수 → 경계 청킹 투자 안 함.
- **결정**: ① 결정적 **메타데이터 prepend**(헤더경로+제목, CCH, 즉시·LLM불요) 먼저 → ② 잔여 맥락손실이 eval 에 보이면 LLM contextual blurb.
- **적재 1콜 통합**(MDKeyChunker 패턴 [중]): child 당 cheap-LLM(prompt-cached, Anthropic ~$1.02/M doc-tok)로 `blurb + 키워드/동의어 + 엔티티` 동시 생성 → D3·D6 비용 합산. 한국어는 blurb 가 핵심 명사 **verbatim echo**(약한 모델도 lexical leg 에 토큰 공급).

### D7. 권하지 않음 [중]
- semantic/LLM 경계 청킹(증거 약), late chunking(OpenAI 임베딩 비호환), HyDE(SKU/가격 환각 위험), ColBERT/VectorChord-bm25(**한국어 토크나이저 없음**), pointwise LLM grading(N콜·이점 0).

---

## 3. 단계별 작업

> 각 Phase 는 구현 + 해당 spec 본문 갱신을 **함께** 포함(`memory/feedback_plan_must_include_spec_updates.md`). spec 갱신=`project-planner`+`consistency-check`, 구현=`developer`.

### P0 — 평가 하베스 (모든 것의 전제) ⭐
- [ ] 응답 로깅: `(query, 회수 chunk_id+score, 최종답변, 인용, thumbs, "답변없음")` 구조화. 기존 `ragSources`/`ragDiagnostics` 재활용.
- [x] 골든셋(KO+EN) — **자동 합성 경로 구현** ([`rag-eval-harness.md`](../complete/rag-eval-harness.md), 2026-06-06). 청크 역방향 생성(gold 라벨 공짜)+SME 스팟검수. CS 티켓 마이닝은 후속. `eval/golden.json` gitignore(고객 데이터), example 만 커밋.
- [x] **검색 지표(순수 TS, LLM비용 0)** — 구현 완료: Recall@k/Precision@k/MRR/nDCG@k/hit-rate, 결정적 tie-break(chunkId 2차 정렬), `--fail-under` CLI 게이트. ([`rag-eval-harness.md`](../complete/rag-eval-harness.md)) _(CI yaml 자동 게이트는 미착수 — 수동 `--fail-under` CLI 제공, PR 자동화는 후속)_
- [ ] **생성 지표(LLM-judge)**: `autoevals`(npm, RAG context 메트릭) + `@arizeai/phoenix-evals`(native multi-provider via ai-sdk, **tool-call evaluator**). retrieval/prompt 경로 PR 트리거만(매커밋 아님). temp=0, position swap, **한국어는 ensemble ≥2 judge·느슨 게이트**.
- [ ] **agentic 지표**: tool-call accuracy, whether-to-retrieve accuracy, decomposition overlap, citation coverage.
- [ ] 한국어 judge κ≈0.3 [강] → retrieval 지표·reference 기반 우선, raw 한국어 judge 점수는 hard gate 금지. promptfoo 쓰면 `llm-rubric`(string-match `context-recall` 금지).
- [x] **spec 갱신**: 신규 `spec/conventions/rag-evaluation.md` 또는 `spec/5-system/9-rag-search.md`. (완료: rag-eval-harness 참조)

### P1 — 검색 후처리 재설계 ⭐ (D1+D2)
- [ ] **점수 기반 동적 컷**(D1) — 최우선. 회수 폭 30~50, token-budget 상한, 생성 주입 ~8~12.
- [ ] cross-encoder 리랭크 기본(`bge-reranker-v2-m3-ko`). NestJS 서비스(ONNX/Triton local 또는 rerank API).
- [ ] listwise LLM grading **escalate 경로**(D2 escalate 조건) — `RagSearchService.search()` 내부, tool 인터페이스 불변.
- [ ] "근거 없음" → agent 명시 전달.
- [x] **spec 갱신** (2026-06-06, `rag-dynamic-cut` PR): `spec/5-system/9-rag-search.md` §3.1·§3.3·신규 §3.4·§4.2·§6·Rationale, `spec/4-nodes/3-ai/1-ai-agent.md`·`0-common.md` ragTopK optional, `17-agent-memory.md`·`10-graph-rag.md`·`1-data-model.md` 정합. consistency `--spec 14_53_44` BLOCK:NO.

### P2 — 3-신호 하이브리드 검색 (D3) — **배포 환경 선결**
- [ ] **선결 결정**: Postgres 배포 환경 → lexical 스택 분기(§아래 표).
- [ ] verbatim 식별자 결정적 추출(regex) → `chunk_keywords`(b-tree exact + `gin_trgm_ops`).
- [ ] LLM 동의어/엔티티 사이드카(graph 추출 재활용) → 같은 테이블.
- [ ] **RRF 3-list 융합** SQL(`UNION ALL`+`GROUP BY SUM(1/(60+rank))`, dense w1.0·lexical w0.9·entity w1.5), 각 leg 필터 복제, leg당 ~50 후보.
- [ ] **spec 갱신**: `spec/5-system/9-rag-search.md` 하이브리드, `spec/5-system/8-embedding-pipeline.md` 색인.

| 배포 | 한국어 lexical leg | 비고 |
| --- | --- | --- |
| RDS/Aurora/Cloud SQL | **pg_bigm**(지원 [강]) + 형태소(Kiwi/Okt)를 **NestJS 앱 레이어**에서 토큰화→컬럼 | in-DB BM25·형태소 없음 |
| Supabase | **PGroonga + TokenMecab(mecab-ko)** | 유일 in-DB CJK 형태소 |
| self-host/replica | **ParadeDB `pg_search` korean_lindera**(KoDic, 유일 in-DB 한국어 BM25) | ops 비용↑ |
| (공통) | `pgvector`·`pg_trgm` 전 매니지드 지원 — 코드 매칭 | VectorChord-bm25 = 한국어 토크나이저 없음 **제외** |

### P3 — Parent-document + 메타데이터 prepend (D4+D6①)
- [ ] 스키마: 2-table `documents / parents / children`. **children 만 임베딩**(HNSW), `children.char_start/char_end`(parent 내 offset, **char 단위** — KO/EN tokenizer 차이).
- [ ] 적재: parent=섹션/마크다운 헤더 경계(≤~1500토큰), child=~300토큰 overlap ~0. 마이그레이션: 현 1000토큰 블록=parent, ~3개 child 재분할(저위험).
- [ ] 검색: child hybrid 검색+리랭크 → distinct parent dedup(`max(child score)`) → **auto-merge ratio>0.5 → parent, 아니면 top child** → token-budget(~6~8k) 컷.
- [ ] 메타데이터 prepend(결정적): child 앞 헤더경로+제목(CCH).
- [ ] 인용: matched=child(`uri, heading, char_start..end`), context=parent, UI 하이라이트.
- [ ] config(KB): `child_size`/`parent_size`/`child_overlap`/`auto_merge_threshold`.
- [ ] **A/B(D4)**: child only vs child+contextual-prefix vs parent merge — P0 평가셋으로.
- [ ] 테이블=atomic parent(행 중간분할 금지), CSV 행=child.
- [ ] **spec 갱신**: `spec/5-system/8-embedding-pipeline.md` 청킹·스키마, `spec/5-system/9-rag-search.md` parent 주입.

### P5 — 맥락 보강 LLM blurb (D6②, P3 A/B 결과 따라)
- [ ] P3 ⓑ가 ⓐ·ⓒ 대비 우위면 도입. 적재 1콜 통합(blurb+키워드+엔티티, prompt-cached).
- [ ] **spec 갱신**: `spec/5-system/8-embedding-pipeline.md` enrichment 단계.

### P6 — 임베딩 모델 UX 보강 (백로그)

> **구현 완료 (2026-06-06, [`embedding-model-ux.md`](../complete/embedding-model-ux.md), PR #492 머지)**. 아래 3항목 모두 반영.

- [x] 모델 선택 UI 한국어 추천 프리셋/힌트 — combobox option 라벨에 비강제 "한국어 추천" 배지(select-only 유지).
- [x] 교체=전면 재임베딩 경고+진행률(기존 버튼) — 기존 구현 검증 + spec 명문화.
- [x] input_type/prefix(query vs passage) 자동 배선 — silent bug 방지. **e5 계열 prefix + Google Gemini taskType** 자동 배선(voyage/cohere 는 client 부재로 OUT — provider 신규 추가는 별도 작업).
- [x] **spec 갱신**: `spec/5-system/{7-llm-client §8.3·§3.3·Rationale, 8-embedding-pipeline §5.4, 9-rag-search §5, 17-agent-memory §4}`, `spec/2-navigation/5-knowledge-base.md §2.2`.

---

## 4. 우선순위 / 의존

```
P0(평가) ──선행── 모든 Phase 효과검증·임계튜닝 (특히 D2 escalate, D4 A/B)
P1(후처리: 동적컷+리랭커) ── 재임베딩 불요, 즉시 효과·최대 ROI. 단독 가능
P2(3-신호 하이브리드) ── 배포 환경 선결 → lexical 스택 분기
P3(parent-doc) ── 재청킹+재임베딩 (모델교체 사이클과 묶기). 리랭크는 children 단계
P5(contextual) ── P3 A/B 결과 의존, 적재 1콜에 P2 키워드 통합
P6(UX) ── 독립 백로그
```
권장 착수: **P0 → P1 → P2 → P3 → P5**, P6 병렬.

---

## 5. 근거 (심화 리서치 핵심 출처)

- 동적 컷/lost-in-the-middle: [CAR arXiv 2511.14769](https://arxiv.org/pdf/2511.14769), [Found-in-the-Middle 2406.16008](https://arxiv.org/pdf/2406.16008)
- cross-encoder vs LLM rerank: [ZeroEntropy deep-dive](https://www.zeroentropy.dev/articles/should-you-use-llms-for-reranking-a-deep-dive-into-pointwise-listwise-and-cross-encoders), [fin.ai 고객지원 A/B](https://fin.ai/research/using-llms-as-a-reranker-for-rag-a-practical-guide/), [empirical 2508.16757](https://arxiv.org/html/2508.16757v1)
- CRAG/Self-RAG: [CRAG 2401.15884](https://arxiv.org/html/2401.15884v2), [Self-RAG 2310.11511](https://ar5iv.labs.arxiv.org/html/2310.11511)
- 한국어 리랭커: [HF dragonkue/bge-reranker-v2-m3-ko](https://huggingface.co/dragonkue/bge-reranker-v2-m3-ko)
- 한국어 하이브리드: [pg_bigm](https://github.com/pgbigm/pg_bigm), [PGroonga](https://pgroonga.github.io/), [ParadeDB tokenizers](https://docs.paradedb.com/legacy/indexing/tokenizers), [한국어 BM25 토크나이저 벤치](https://medium.com/@autorag/making-benchmark-of-different-tokenizer-in-bm25-134f2f0e72f8), [RRF in SQL](https://www.paradedb.com/blog/hybrid-search-in-postgresql-the-missing-manual)
- parent-doc: [LlamaIndex auto-merge(ratio 0.5 source)](https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/retrievers/auto_merging_retriever.py), [Chroma 청킹](https://www.trychroma.com/research/evaluating-chunking)
- Contextual Retrieval: [Anthropic](https://www.anthropic.com/news/contextual-retrieval), [독립재현 2604.01733](https://arxiv.org/html/2604.01733v1), [MDKeyChunker 2603.23533](https://arxiv.org/pdf/2603.23533)
- 평가(TS): [autoevals](https://github.com/braintrustdata/autoevals), [phoenix-evals](https://github.com/Arize-ai/phoenix/tree/main/js/packages/phoenix-evals), [promptfoo RAG](https://www.promptfoo.dev/docs/guides/evaluate-rag/), 한국어 judge κ≈0.3 [arXiv 2505.12201](https://arxiv.org/abs/2505.12201)

---

## 6. 남은 결정 (착수 전 확정 필요)

- [ ] **Postgres 배포 환경**(RDS/Aurora·Cloud SQL·Supabase·self-host) → P2 lexical 스택 분기. **P2 최선결**.
- [x] **P1 리랭커 provider/호스팅 — 2026-06-04 확정**: 1차 `tei`(자가호스팅 HF TEI, Node thin HTTP client) + `cohere`(API). jina/voyage/local/builtin(Transformers.js 인프로세스) Planned.
- [x] **P1 cross_encoder_llm escalate — 2026-06-06 재결정**: conditional escalate **메커니즘**(상위 점수 평탄/모호 시에만 listwise grading)을 `rag-dynamic-cut` PR(D2)에서 도입(기존 2026-06-04 "항상 grading(v1)" 대체 — 그 결정은 비용 보호용 단순화였고 escalate 미발생 시 cross-encoder 결과 사용=v1 부분집합이라 회귀 안전). escalate 진입 **정량 임계**는 합리적 default 로 시작, P0 골든셋 A/B 확정은 후속.
- [x] **"정책 판단 KB" 표시 — 2026-06-04 확정**: 별도 플래그 없음, `rerank_mode = cross_encoder_llm` 자체가 표시자.
- [ ] P3 읽기시점 3안(child / child+prefix / parent) A/B 결과 → P5 도입 여부.
- [ ] 평가셋 규모·합성 비율(수동 50 + 합성 확장) 확정.
- [ ] (선택) 형태소 분석기 Kiwi vs Okt(앱 레이어) — 한국어 BM25 벤치 Kiwi/Okt 상위.

> 리랭킹 상세 설계는 [`spec-draft-rag-reranking.md`](./spec-draft-rag-reranking.md)(P1 구체화, consistency-check `00_02_05` BLOCK:NO 통과 + 2026-06-04 결정 확정·spec 반영) 로 분기.

> 심화 리서치 5스트림(2026-06-03) 통합 완료. 다음 단계: 특정 Phase 의 spec 본문화(project-planner+consistency-check) 또는 P1 PoC 구현(developer).

---

## 7. 후속 작업 추적 (P0 Phase 0+1 first-cut 완료 후, 2026-06-06)

> 평가 하베스 [`rag-eval-harness.md`](../complete/rag-eval-harness.md)(PR #488 머지) 완료 후 남은 작업. 우선순위 **B → C → D**, E 는 비차단 백로그. (A=plan 위생은 본 갱신으로 처리.)

### B. 하베스 실사용 — baseline 생성 ⭐ (다음 우선순위)
- [ ] 대상 workspace/KB 지정 → `npm run eval:golden:generate -- --workspace-id .. --kb-id .. --sample N` 으로 실 골든셋 생성.
- [ ] SME 스팟검수(20~30%) → `reviewed:true` 승격.
- [ ] `npm run eval:retrieval` baseline 산출 → `rerank_mode` off↔cross_encoder delta 비교.
- [ ] 결정: 실 `golden.json` repo 커밋 여부(고객 데이터 민감도), 적정 `--sample` 규모·KB 선정.

### C. 하베스가 unblock 한 downstream (로드맵 본체)
- [~] **D2 conditional escalate** — **메커니즘 구현 완료**(`rag-dynamic-cut` PR: 상위 점수 평탄/모호 시 escalate + '근거 없음' 전달). **정량 임계 튜닝**(cross_encoder vs cross_encoder_llm A/B)은 P0 baseline(§7.B) 실 골든셋 확보 후. §6 "P1 escalate 정량 임계" 와 연결.
- [ ] P2 3-신호 하이브리드 / P3 parent-document / P5 contextual — 각 §3 Phase, 평가셋으로 A/B.

### D. 평가 하베스 확장 (Phase 2+, §P0 잔여)
- [ ] 생성 지표 LLM-judge(autoevals/phoenix, 한국어 ensemble·느슨 게이트).
- [ ] agentic 지표, 실 CS 로그 마이닝, **CI yaml 자동 게이트**(현재 수동 `--fail-under` CLI).

### E. 리뷰 backlog (비차단, ai-review RESOLUTION 기록)
- [ ] `EVAL_CLI_ENTITIES` 최소 집합 분리, `eval-cli.module` DI 회귀 스펙.
- [ ] `eval-retrieval.ts main()` 단계 함수 분리, 기존 마이그레이션 스크립트 `parseCliFlag` → `cli-utils` 통합.
- [ ] perf 마이크로 최적화(ndcg log2 테이블·resolveWorkspace 배치 조회), `rag-evaluation.md` Rationale 에 D-E7(`root-entities.ts` 분리) 추가.
- [ ] **pgvector ANN 파라미터 조정 (D1 wide 회수 후속)** — D1 동적 컷이 회수 폭을 `LIMIT 5→50`(`RAG_RECALL_K`)으로 넓혀 ANN 스캔 대상 증가. `hnsw.ef_search`(기본 40, `≥ 회수 폭` 권장)·`ivfflat.probes`(기본 1) 가 재현율 유지에 적합한지 프로덕션 부하 측정 후 조정 (필요 시 DB 세션 파라미터/KB config 노출). SoT: `spec/5-system/9-rag-search.md §3.4` follow-up 노트. (ai-review `16_08_38` I1 / `16_05_34` INFO8)
