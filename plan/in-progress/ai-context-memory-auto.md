---
worktree: ai-context-memory-9c7e6e
started: 2026-06-03
owner: planner → developer
---

# AI Agent 노드 — 자동 컨텍스트 메모리 관리 (summary_buffer + persistent)

## 0. 배경 / 목표

AI Agent 노드의 대화 컨텍스트 메모리가 현재는 fixed-window 수동 설정
(`contextScope: none|thread|lastN` + `contextScopeN` + `contextInjectionMode`)
만 제공한다. 장기 대화(챗봇/어시스턴트)에서 (1) 토큰·비용 단조 증가, (2) 윈도우
밖 초기 정보 완전 소실, (3) 세션 간 장기 기억 부재의 세 문제가 동시에 발생한다.

**목표**: 기존 수동 옵션을 하위호환으로 유지하면서, 사용자가 노드 설정에서
**자동 메모리 전략 2종을 선택**할 수 있게 한다.

1. **`summary_buffer`** — 단일 실행(세션) 내 롤링 요약 압축. 토큰 예산 기반.
2. **`persistent`** — 세션 간 사실/선호 추출 영속 메모리(Mem0/Zep 형). 추출+의미검색 회수.
   working-memory 는 summary_buffer 동작을 포함(superset)한다.

> **리서치 근거**: [`ai-context-memory-research.md`](./ai-context-memory-research.md) — 6 패턴 비교·산업
> 디폴트·논문/벤치마크·캐시 트레이드오프·설계 매핑(23개 검증 소스, 기각된 2주장 포함).

## 1. 확정된 설계 결정 (사용자 + 리서치)

### 1.1 트리거 — 턴 수 → 토큰 예산 (리서치 근거)
- 자동 전략의 압축/회수 트리거는 **"턴 수"가 아니라 "토큰 예산"** 기반.
  - 근거: LangChain `ConversationSummaryBufferMemory`(max_token_limit), Anthropic
    compaction docs 등 업계·논문 공통. 턴 크기 분산이 커서 턴 수는 예산을 제어 못 함.
  - 기존 `conversation-thread.md §7 v2 로드맵`의 "Token-aware cap" 항목과 정합 —
    이 작업이 그 로드맵을 실현한다.

### 1.2 요약은 net-positive (캐시 오해 기각)
- "요약이 prompt cache 를 깨서 역효과"는 deep-research 적대적 검증에서 **기각(0-3)**.
  압축의 비용절감이 캐시 재구축을 상회. 단 **안정 프리픽스(system+요약)/휘발성
  꼬리(최근 원문) 분리**로 캐시를 보호한다. 요약은 매 턴이 아니라 **임계치 도달
  시에만 갱신**.

### 1.3 요약만으로 부족 → persistent 은 검색 회수 병행
- LongMemEval(arXiv 2410.10813): 장기 대화 정확도 ~30% 하락. 요약 압축은 디테일
  손실. persistent 은 **추출 사실의 의미검색 회수**를 병행해 보완.

### 1.4 메모리 스코프 키 (사용자 결정)
- **`(workspace_id, memoryKey ?? execution_id)`**.
  - `memoryKey`(표현식 필드) 주입 시 → 세션 간 영속(개인화).
  - 미주입 시 → `execution_id` 로 **세션 단위 격리** (사용자간 누수 방지. cross-session
    누적은 안 됨 — 안전 디폴트).
  - 근거: 현재 제품에 최종사용자 식별자 부재(웹채팅 v1 익명, `Execution.executed_by`
    는 로그인 빌더). Mem0/Zep 의 caller-supplied `user_id` 패턴.

### 1.5 저장소 — pgvector 재사용, 신규 테이블
- 기존 KB/RAG 인프라(PostgreSQL pgvector, `EmbeddingService`, `RagSearchService`)
  재사용. KB 와 **분리된 신규 테이블** `agent_memory` 신설.
- `workspace_id` 격리 의무(전 엔티티 공통 패턴).

### 1.6 추출 시점 — 비동기(hot path 비차단)
- **회수(retrieval)**: LLM 호출 **전 동기** top-k 검색(필수).
- **추출(extraction)**: 턴 경계에서 **비동기**(background, 기존 `scheduleBackgroundBody`
  계열 패턴) — LLM latency 에 추출 LLM 콜을 얹지 않는다.

### 1.7 회수 정책 디폴트 (기존 RAG 정합)
- `memoryTopK` 기본 `5` (KB `ragTopK` 와 동일), `memoryThreshold` 기본 `0.7`
  (`ragThreshold` 와 동일).

### 1.8 망각/만료
- v1: scope 당 최신 N건 보존(예 `1000`) FIFO/LRU evict (conversation-thread
  `STORAGE_MAX_TURNS` 패턴 동형). optional TTL 은 v2 로드맵.

## 2. 스키마 확장 형태 결정 — 별도 `memoryStrategy` 필드

기존 `contextScope`(none/thread/lastN)는 "어느 **범위**의 turn 을 주입할지"를 뜻하고,
새 전략은 "메모리를 **어떻게 관리**할지"라 의미 축이 다르다. enum 에 `auto` 를
끼워넣으면 범위·관리 두 축이 한 필드에 섞여 하위호환 echo·UI visibleWhen 규칙이
얽힌다. 따라서 **별도 `memoryStrategy` 필드**를 1급으로 도입한다.

| 필드 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `memoryStrategy` | `manual` / `summary_buffer` / `persistent` | `manual` | 메모리 관리 전략 |
| `memoryTokenBudget` | Integer | `8000` | `summary_buffer`/`persistent` 시 working-memory 토큰 예산. 초과분을 오래된 turn 부터 롤링 요약 압축 |
| `memoryKey` | String (Expression) | — | `persistent` 시 메모리 스코프 키. 미설정 시 `execution_id` fallback |
| `memoryTopK` | Integer | `5` | `persistent` 회수 청크 수 |
| `memoryThreshold` | Float | `0.7` | `persistent` 회수 최소 유사도 |

- `memoryStrategy: 'manual'`(기본) → 기존 `contextScope`/`contextScopeN`/
  `contextInjectionMode`/`includeToolTurns` 동작 **완전 무변경**(하위호환).
- `'summary_buffer'` → 토큰예산 롤링 요약. 최근 원문은 `contextInjectionMode` 따라
  주입, **요약 블록은 항상 system_text** 안정 프리픽스에 배치.
- `'persistent'` → summary_buffer working-memory **+** 세션 간 추출 메모리 회수 레이어.
- UI `visibleWhen`: `memoryTokenBudget` 은 strategy ∈ {summary_buffer, persistent},
  `memoryKey`/`memoryTopK`/`memoryThreshold` 는 strategy == persistent 일 때만.
- `manual` 일 때 `contextScope` 등 기존 필드 표시(현행 유지). strategy ≠ manual 이면
  기존 contextScope 필드는 숨김(자동 전략이 대체).

## 3. 영향 문서 (spec 갱신 — Phase A)

- `spec/4-nodes/3-ai/1-ai-agent.md` §1(설정 표 5필드 추가), §6.1/§6.2(실행 로직 —
  주입 전 회수, 턴 후 비동기 추출, 요약 갱신 트리거), §7(meta echo:
  `meta.memory.{strategy, summarized, recalledCount, tokenBudgetUsed}`), §12 Rationale.
- `spec/4-nodes/3-ai/0-common.md` §10(Conversation Context 표에 memoryStrategy 축 추가
  + manual/auto 관계 명시).
- `spec/conventions/conversation-thread.md` §1.3(ConversationThread 에 요약 보관 필드
  `runningSummary?`, `summarizedUpToSeq?`), §4(영속화 — 요약/추출 저장 경로), §5.3(cap
  → token-aware), §7(v2 로드맵에서 token-aware cap 항목 → 본 작업으로 실현 표기).
- **신규** `spec/5-system/<N>-agent-memory.md` — persistent 메모리 저장소 SoT
  (테이블 `agent_memory`, 스코프 키, 추출/회수 파이프라인, pgvector 재사용,
  forgetting). RAG/embedding 문서와 cross-link.
- `spec/1-data-model.md` — `agent_memory` 엔티티 추가(`id, workspace_id, scope_key,
  content, embedding vector, metadata jsonb, created_at, updated_at`).
- 요구사항 ID: `ND-AG-*` 신규(설정/실행), 메모리 저장소는 `SYS-MEM-*` 신설 검토.

## 3.1 consistency-check 결과 (2026-06-03)

`review/consistency/2026/06/03/21_01_04/SUMMARY.md` — **BLOCK: NO** (Critical 0).
WARNING 13 + INFO 15 전부 Phase A 에서 해소. 확정 채택:
- 신규 파일 = `spec/5-system/17-agent-memory.md` (다음 가용 번호 17). `spec/0-overview.md §8` 등재.
- 요구사항 ID: 노드측 `ND-AG-27`~ 순차, 메모리 저장소측 `AGM-*` (단층 약어; `SYS-MEM-*` 기각).
- `memoryStrategy: 'manual'` 유지 (Trigger.type 와 namespace 분리, 의미 명료성 우선).
- 요약 LLM 콜 모델 = v1 노드 `model`/`llmConfigId` 재사용 (scope-freeze, 신규 필드 없음).
- `1-data-model.md` 는 spec-impl-evidence frontmatter 제외 대상.

## 4. Phase 계획

- [x] **Phase A — Spec 개정 (planner)** ✅ 2026-06-03: §3 영향 문서 전체 갱신 완료. **DoD (consistency WARNING 해소)**:
  - [x] 3개 implemented 파일 frontmatter → `status: partial` + `pending_plans` (W#9)
  - [x] 신규 `17-agent-memory.md` frontmatter `id`/`status: spec-only`/`code: []` (W#10)
  - [x] `0-common.md §10` + `1-ai-agent.md §1`: `memoryStrategy ≠ manual` 시 5필드 유효/무효 (W#1)
  - [x] `conversation-thread.md §4`: `runningSummary`/`summarizedUpToSeq` Redis 직렬화/rehydration + `agent_memory` 별도 테이블 (W#2)
  - [x] `conversation-thread.md §7`/§5.3: token-budget 부분 실현(tokenizer-exact v3) + manual char-cap 유지 (W#3, W#12)
  - [x] `1-data-model.md §1` 관계도 `AgentMemory` + §2.23 엔티티 + §3 인덱스 (W#4)
  - [x] `ND-AG-27~30` 채번 + 두 `_product-overview.md` 동시 + `AGM-01~07` (W#5)
  - [x] `1-ai-agent.md §12.9/12.10/12.11` Rationale 3항 (W#6,7,8)
  - [x] `0-common.md §11.4` ordering 표 5a/5b/5c + 휘발성 꼬리 (W#8)
  - [x] spec write 직전 `/consistency-check --spec` 의무 — 완료(BLOCK NO). 산출: `review/consistency/2026/06/03/21_01_04/`
  - [x] build 가드 검증: frontmatter(spec-only/code:[]) + status-lifecycle(implemented→partial+pending_plans) 직접 확인 (frontend node_modules 미설치로 vitest 대신 수동 검증)
- [ ] **Phase B — 데이터 모델 / 마이그레이션 (developer)**: `agent_memory` 테이블
      마이그레이션. workspace_id 격리, pgvector 컬럼·인덱스.
- [ ] **Phase C — summary_buffer 구현 (developer, TDD)**: token 추정 유틸, 롤링 요약
      빌더(요약 LLM 콜), 임계치 트리거, thread `runningSummary` 보관, 안정 프리픽스
      배치. unit + integration.
- [ ] **Phase D — persistent 구현 (developer, TDD)**: `AgentMemoryService`(추출
      파이프라인 비동기, 회수 동기), 스코프 키 resolve(memoryKey ?? execution_id),
      pgvector 재사용, top-k/threshold/forgetting. unit + integration.
- [ ] **Phase E — 스키마/핸들러/UI (developer)**: `ai-agent.schema.ts` 5필드 +
      visibleWhen, `ai-agent.handler.ts` `injectConversationContext` 확장, meta echo.
      frontend 자동 생성 UI 확인.
- [ ] **Phase F — e2e + 회귀 (developer)**: 장기 대화 시나리오(예산 초과 압축, 세션 간
      회수), 하위호환(manual 무변경) 회귀.
- [ ] **Phase G — REVIEW**: `/ai-review` + critical/warning fix (강제). `/spec-coverage`
      로 갭 확인.

## 5. 미해결 / 결정 필요
- [ ] persistent 추출 스키마(fact/preference/entity 분류 깊이) — Phase A 에서 확정.
- [ ] 신규 system spec 문서 번호(`spec/5-system/<N>`) — Phase A 에서 채번.
- [ ] 요약 LLM 콜이 쓰는 모델 — 노드 `model`/`llmConfigId` 재사용 vs 저비용 모델 분리.
