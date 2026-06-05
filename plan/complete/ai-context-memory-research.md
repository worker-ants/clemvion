---
worktree: ai-context-memory-9c7e6e
started: 2026-06-03
owner: planner
kind: research-background
status: complete
related_plan: plan/complete/ai-context-memory-auto.md
---

# 대화 컨텍스트 메모리 자동 관리 — 리서치 보고서

> 본 문서는 [`ai-context-memory-auto.md`](./ai-context-memory-auto.md) 설계의 **근거(evidence base)** 다.
> deep-research 하네스(2026-06-03)로 5각도 fan-out → 23개 소스 fetch → 109개 주장 추출 →
> 25개 적대적 검증(2/3 refute 시 기각) → 6개 핵심 발견으로 수렴. 모든 주장에 출처 표기.
> 검증으로 **기각된 2개 주장**은 ⚠️ 로 별도 표시(설계 결정에 직접 영향).

---

## 0. 문제 정의

AI Agent 노드의 컨텍스트 메모리는 현재 fixed-window 수동 설정
(`contextScope: none|thread|lastN` + `contextScopeN` + `contextInjectionMode`)만 제공한다.
이는 메모리 분류상 **"고정 윈도우" 한 패턴**만 구현한 것으로, 장기 대화(챗봇/어시스턴트)에서
세 가지가 동시에 깨진다:

- **윈도우 안(`thread`)**: 토큰·비용이 턴마다 단조 증가
- **윈도우 밖(`lastN`)**: N턴을 넘어간 초기 정보가 무손실이 아니라 **완전 소실**
- **세션 간**: 장기 기억(사용자 선호·과거 결정)이 전혀 누적되지 않음

핵심 결함은 **트리거가 "턴 수"**라는 점 — 턴 1개의 크기는 한 단어부터 수천 토큰까지
천차만별이라 턴 수 기반은 토큰 예산을 전혀 제어하지 못한다. 업계·논문 공통 결론은
**"턴 수가 아니라 토큰 예산 기반 트리거"**다.

---

## 1. 6가지 메모리 패턴 비교

서베이(arXiv 2505.00675)는 메모리를 parametric/non-parametric로 나누고 6개 연산
(consolidation·indexing·updating·forgetting·retrieval·compression)으로 정식화한다.
실무 관점 6패턴:

| # | 패턴 | 작동 방식 | 토큰/비용 | 장기기억 | 인프라 | 적합 상황 |
|---|------|----------|----------|---------|--------|----------|
| **A** | **Sliding/Recency Window** (현행 `lastN`) | 최근 N턴/토큰만 유지, 나머지 버림 | 상한 고정 ✅ | ❌ 소실 | 없음 | 단발성 Q&A, 짧은 태스크 |
| **B** | **Summary-Buffer (Rolling Summary)** | 최근은 원문 유지 + 오래된 것은 요약으로 압축 누적 | 상한 고정 ✅ | △ 손실 요약 | LLM 1콜 | **대부분의 챗봇/어시스턴트 기본값** |
| **C** | **Retrieval / RAG-as-Memory** | 과거 turn 임베딩→저장, 질의와 의미 유사한 것만 top-k 회수 | 매우 낮음 ✅✅ | ✅ | 벡터 스토어 | 방대한 히스토리, 특정 사실 재호출 |
| **D** | **Hierarchical/Tiered (MemGPT)** | OS 페이징처럼 in-context(working) ↔ external(long-term) 자동 스왑, LLM 이 직접 페이지 인/아웃 | 낮음 ✅ | ✅ | 메모리 매니저+스토어 | 사실상 무한 대화, 에이전트가 메모리 직접 제어 |
| **E** | **Structured Extraction (Mem0/Zep)** | 대화에서 사실·엔티티·관계 추출해 구조화 저장(KG 포함) | 매우 낮음 ✅✅ | ✅✅ | 추출 파이프라인+(그래프)DB | CRM형·개인화·세션 간 영속 |
| **F** | **Reflection / Self-Editing (Generative Agents)** | 주기적으로 관찰을 묶어 고차 통찰 생성, 메모리 자가편집 | 중간 | ✅ | 스케줄러+스토어 | 페르소나 일관성, 자율 에이전트 |

> 출처: 서베이 분류 arXiv 2505.00675(검증 2-1 ✓) · 단기 패턴(window/summary/summary-buffer/token-buffer)
> NirDiamant/Agent_Memory_Techniques(검증 3-0 ✓).

**핵심**: 이 패턴들은 배타적이지 않다. 실무 디폴트는 **B+C 하이브리드**(최근 원문 윈도우 +
오래된 것 요약 + 의미검색 회수) — Anthropic·LangGraph·getmaxim 등 공통.

**우리 채택 (사용자 결정)**: **B(summary_buffer)** + **E(persistent, working-memory 는 B 포함)**.

---

## 2. 산업 프레임워크/제품 디폴트

| 제품/프레임워크 | 기본 전략 | 트리거 | 비고 (출처) |
|---|---|---|---|
| **LangChain** `ConversationSummaryBufferMemory` | B (summary-buffer) | **토큰 max** 초과 시 오래된 것 요약 | 윈도우+요약 결합이 표준 레시피 (langchain api docs, 검증 ✓) |
| **LangGraph** | checkpointer(단기 thread) + store(장기) + `trim_messages` | 토큰/메시지 수 | 단기/장기 저장소 분리가 핵심 설계 |
| **LlamaIndex** `ChatSummaryMemoryBuffer` | B | 토큰 한도 초과 시 요약 | ⚠️ "기본 `token_limit=40000`" 주장은 검증에서 **기각(1-2 ✗)** — 특정 디폴트값 그대로 인용 금지 |
| **OpenAI** Assistants/Threads · ChatGPT Memory | 서버측 thread 영속 + 메모리(추출형 사실) | 자동 | 사용자 facts 추출·주입 (E 계열) |
| **Anthropic** Context Editing + Memory Tool + **Compaction** | B(compaction) + 도구기반 메모리 | **토큰 임계치** 자동 | 트리거/정책 가장 명확 (platform.claude.com/compaction·context-editing, 검증 ✓) |
| **MemGPT/Letta** | D (tiered self-editing) | LLM 이 직접 판단 | OS 가상메모리 비유 원형 (arXiv 2310.08560, 검증 3-0 ✓) |
| **Mem0** | E (extraction) | 자동 | 풀컨텍스트 대비 **토큰 90%+ 절감**, 정확도 ~6pt 트레이드 (arXiv 2504.19413, 검증 3-0 ✓) |
| **Zep / Graphiti** | E + temporal KG | 자동 | LongMemEval 에서 baseline 대비 **지연 90% 감소**(검증 2-1 ✓), DMR 벤치마크 우위(검증 3-0 ✓) |

> 수렴점: 거의 모두 **토큰 임계치 기반 자동 요약/압축을 기본**으로 두고, 장기 영속이
> 필요하면 추출/검색을 얹는다. 트리거는 일관되게 토큰 예산.

---

## 3. 논문·벤치마크 — 무엇이 실증되었나

- **MemGPT** (Packer 2023, arXiv 2310.08560, 검증 3-0 ✓): 고정 컨텍스트 한계를 OS 가상메모리식
  계층 스왑 + LLM 자가편집으로 극복. tiered/self-editing 메모리의 학술 원형.
- **Generative Agents** (Park 2023, arXiv 2304.03442, 검증 3-0 ✓): 전체 경험 기록 + reflection
  통합. **ablation 에서 3개 메모리 계층(retrieval·reflection·planning) 각각이 유의미하게 기여**
  — "계층화가 실제로 효과 있다"는 직접 증거.
- **LongMemEval** (ICLR, arXiv 2410.10813, 검증 3-0 ✓): 장기기억을 indexing·retrieval·reading
  등 5개 능력으로 분해 평가. **상용 어시스턴트도 장기 상호작용에서 정확도 ~30% 하락** —
  "그냥 다 넣으면 된다"가 깨지는 지점.
- **LOCOMO** (snap-research, 검증 ✓): 장기 대화 표준 벤치마크. Mem0/Zep 비교 공통 기준.
- **Mem0** (arXiv 2504.19413, 검증 3-0 ✓): 추출/검색 방식이 풀컨텍스트 대비 토큰 90%+ 절감하면서
  정확도는 소폭(~6pt) 트레이드.

> ⚠️ **caveat**: Mem0/Zep 의 "90% 절감·지연 90% 감소" 수치는 **벤더 자기보고이며 경쟁 벤치마크에서
> 논쟁 중**(검증 confidence: medium). 방향성(추출/검색이 싸다)은 신뢰하되, 절대 수치는 우리
> 워크로드로 재측정해야 한다.

---

## 4. 비용·지연·캐시 트레이드오프 (핵심 엔지니어링)

적대적 검증으로 **기각된 주장**이 설계 결정에 직접적이다:

> ⚠️ **기각 (0-3, 만장일치 refute)**: *"요약/압축은 prompt cache 를 깨므로 캐시 효율 면에서 역효과다"*
> — **거짓으로 판정.** (출처 arXiv 2601.06007v2 의 주장이 검증에서 무너짐)

해석: 요약/compaction 은 편집 지점 이후 캐시를 무효화하는 것은 맞지만, **그 자체가 "역효과"는
아니다.** 압축으로 줄어든 토큰의 비용 절감이 캐시 재구축 비용을 상회한다. 즉
**"캐시 깨질까 봐 요약 안 한다"는 잘못된 절약**이다.

캐시 친화적으로 설계하면 둘 다 가진다:

1. **안정 프리픽스 분리**: `system prompt + 누적 요약 + 회수 메모리`는 앞쪽 고정 블록. **휘발성
   최근 turn 은 뒤쪽.** → 요약 갱신 시에만 그 경계 이후 캐시가 깨짐.
2. **요약은 임계치에서만 드물게 갱신** (매 턴 X). 그 사이 다수 턴은 캐시 적중.
3. 우리 `contextInjectionMode`와 자연 연동 — **요약/회수→system_text 안정 프리픽스, 최근 turn→messages**.

> 출처: Anthropic prompt-caching·compaction·context-editing docs(검증 ✓) +
> effective-context-engineering(anthropic.com).

---

## 5. 리서치 → 우리 설계 결정 매핑

| 리서치 발견 | 우리 설계 반영 |
|---|---|
| 트리거는 턴 수 아닌 **토큰 예산** (LangChain·Anthropic 공통) | `memoryTokenBudget`(기본 8000) 기반 압축 트리거. 기존 `contextScopeN`(턴 수)은 manual 하위호환에만 |
| **요약은 net-positive**, 캐시는 안정 프리픽스/휘발성 꼬리 분리로 보호 (기각된 오해) | 요약/회수 블록 = system_text 안정 프리픽스([5a/5b]), 최근 원문 = 휘발성 꼬리([6]). 갱신은 임계치 도달 시에만 |
| 요약만으론 장기대화 정확도 ~30% 하락 → **검색 회수 병행 필요** (LongMemEval) | `persistent` = summary_buffer + 의미검색 회수(top-k). 요약 단독이 아니라 추출 사실 회수 병행 |
| 추출/검색은 토큰 대폭 절감하나 정확도 일부 트레이드, **벤더 수치 재측정 필요** | persistent 채택하되 절대 수치는 우리 데이터로 검증 예정. forgetting 으로 메모리 규모 통제 |
| **계층 구성이 실효적** (Generative Agents ablation) | working-memory(요약) + 세션간(추출 회수) 2계층 구성 |
| caller-supplied 식별자 패턴 (Mem0/Zep `user_id`) | `memoryKey` 표현식 필드. 미주입 시 execution_id 격리 |
| pgvector 단일 스택 재사용 가능 (별도 벡터DB 불요 — 규모 ≤1000/scope) | `agent_memory` 신규 테이블 + 기존 `EmbeddingService`/pgvector 재사용 |

---

## 6. 권장 디폴트 (실무 수렴값) — 채택본

- **트리거**: 조립 컨텍스트가 `memoryTokenBudget`(기본 8000) 초과 시 압축. *(턴 수 아님)*
- **summary_buffer**: 최근 원문 유지 → 초과분 오래된 쪽부터 rolling summary 로 압축(system_text
  안정 프리픽스). 요약 갱신은 임계치 도달 시에만(캐시 보호). 요약 LLM 콜은 노드 `model` 재사용.
- **persistent 회수**: top-k=5, threshold=0.7 (KB `ragTopK`/`ragThreshold` 와 동일 디폴트, 단 독립 필드).
- **persistent 추출**: 턴 경계 **비동기**(hot path 비차단). 회수만 동기.
- **forgetting**: scope 당 최신 1000건 FIFO/LRU evict. TTL 은 v2.

---

## 7. 출처 목록 (검증 통과 primary 중심)

- 서베이/분류: arXiv 2505.00675 · github NirDiamant/Agent_Memory_Techniques
- MemGPT/Letta: arXiv 2310.08560 · docs.letta.com/concepts/memgpt
- Generative Agents: arXiv 2304.03442
- 벤치마크: LongMemEval arXiv 2410.10813(ICLR) · LOCOMO snap-research.github.io/locomo ·
  Mem0 arXiv 2504.19413 · arXiv 2501.13956
- 엔지니어링/디폴트: platform.claude.com (compaction·context-editing·prompt-caching) ·
  anthropic.com/engineering/effective-context-engineering ·
  langchain ConversationSummaryBufferMemory api docs ·
  llamaindex ChatSummaryMemoryBuffer · getmaxim.ai context-window-management
- 벤더 랜드스케이프: agentmarketcap.ai (Letta/Zep/Mem0/LangMem 2026)

### 기각된 주장 (적대적 검증)
- ⚠️ LlamaIndex `token_limit=40000` 고정 디폴트 — **기각(1-2)**. 특정 상수 인용 금지.
- ⚠️ "요약이 prompt cache 를 깨 역효과" — **기각(0-3 만장일치)**. 요약은 net-positive.

### 통계
- 5각도 fan-out · 23 소스 fetch · 109 주장 추출 · 25 검증 · 23 confirmed · 2 killed · 6 종합.
