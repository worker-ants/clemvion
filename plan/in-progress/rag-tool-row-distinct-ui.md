---
worktree: rag-tool-row-distinct-ui-e39447
started: 2026-07-17
owner: developer
---

# RAG 검색(retrieval) 행 신설 + 도구 행과 시각 구분 (Slice A+B)

> 작성일: 2026-07-17
> 트리거: 사용자 요청 — "RAG 및 도구에 대한 행은 구분되는 UI로 표시가 필요"
> 선행: PR #959 (`12ceee587`) — Inv-8 대화 도달성 복구. 그 과정에서 옛 `rag` 행을 제거했고 본 작업이 **데이터 출처를 바꿔 되살린다**
> 관련 spec (SoT 책임 경계별):
> - **conversation 시각 매핑·source·불변량·회귀 시나리오**: `spec/conventions/conversation-thread.md` (§1.1.1·§9.1·§9.2·§9.6·§9.3·§9.10·§9.11)
> - **RAG 검색 결과 데이터·Preview chip 승인**: `spec/5-system/9-rag-search.md` §4.1 — **이미 chip 을 `meta.turnDebug[].ragSources` 출처로 문서화**. 상호 참조 0건이 이번 drift 의 근본 원인 (개정 대상 C)
> - **wire 필드**: `spec/5-system/6-websocket-protocol.md` §4.4 (`nodeOutput.meta.turnDebug` 미문서화 — 개정 대상 B)
> - **turnDebug 존재 목적 서술**: `spec/4-nodes/3-ai/1-ai-agent.md` L732 (개정 대상 D)
> - **탭 구성**: `spec/3-workflow-editor/3-execution.md` §10.6.1 (References 탭 — 본 작업은 변경 없음, 참조만)

## 배경

KB 검색은 **두 경로**로 일어나는데 UI 표현이 비대칭이다:

| 경로 | 데이터 | 현재 표시 |
|---|---|---|
| **도구 호출** (`kb_search` 등) | `ai_tool` turn (§1.1) | 🔧 도구 카드 (`includeToolTurns: true` opt-in 시) |
| **자동 KB 검색**(엔진이 LLM 호출 전 수행) | `meta.turnDebug[].ragSources` | **행 없음** — assistant 버블의 📚 chip + References 탭뿐 |

사용자는 두 경로 모두 **구분되는 행**으로 보이길 요청했다.

### PR #959 에서 제거한 옛 `rag` 행과의 관계

#959 는 `conversation-inspector.tsx` 의 인라인 재파싱(§9.11 계약에 없는 4번째 변환 경로)을 삭제했고, 그 파서가 합성하던 `🔎 KB Reference` 행이 함께 사라졌다. 근거는 [`review/code/2026/07/17/08_05_31/SUMMARY.md`](../../review/code/2026/07/17/08_05_31/SUMMARY.md) §RAG 판단(정정)에 기록.

**본 작업은 그 행을 "복원" 하지 않는다 — 데이터 출처를 바꿔 신설한다**:

| | 옛 행 (#959 에서 제거) | 본 작업 |
|---|---|---|
| 출처 | `role:'system'` + `### Relevant Knowledge` 마커 | `meta.turnDebug[].ragSources` |
| 생성 주체 | frontend 인라인 파서 (§9.11 위반 경로) | 정규 변환 함수 (§9.11 등재) |
| 프로덕션 유효성 | ❌ `RagSearchService.buildContext` **호출부 전무** → 신규 실행에 미생성 | ✅ 현재 실제로 흐르는 데이터 |
| live 동작 | ❌ history 전용 (live 는 store pass-through) | ✅ **live·history 양쪽** |

옛 마커 경로를 되살리는 안은 **기각** — 죽은 경로 부활 + §9.11 다중 정의 금지 위반.

### live/history 대칭 실측 (2026-07-17)

본 설계의 전제(turnDebug 가 양 표면에 존재)를 코드로 확인했다 — #959 의 근본 원인이 live/history 비대칭이었으므로 같은 함정을 피하는 것이 중요:

- **live**: `ai-turn-orchestrator.service.ts:485` 가 `waiting_for_input` 의 `nodeOutput.meta` 에 `buildConversationMetaFromResumeState(resumeState)` 를 실어 emit — 주석 그대로 *"run-results UI 의 References / LLM Usage 탭이 진행 중에도 동작하도록"*. 그 helper (`ai-conversation-helpers.ts:82-97`) 가 `turnDebug: state.turnDebugHistory` 를 반환.
- **history**: `meta` 는 `outputData` 의 일부이므로 DB 영속 → REST 스냅샷으로 복원.

→ 양 표면 동일 소스. **Inv-5 정신(양 surface 동일 결과)에 정합.**

## 스코프

**포함 (Slice A)**: `rag` frontend 합성 source 신설 + 🔎 행 렌더 + 🔧 도구 행과 시각 구분 + 📚 chip 병존.

**포함 (Slice B — PR #959 가 남긴 저비용 후속, 각 20~30줄)**:

> **근거 정정** (plan_coherence WARNING): 초안은 둘 다 "동일 파일" 로 묶었으나 **#1 에는 부정확**하다 — #7 은 Slice A 가 편집하는 `conversation-inspector.test.tsx` 와 같은 파일이지만, #1 은 `use-execution-events.ts`/`.test.ts` 대상으로 Phase 2 의 편집 파일 5개 어디에도 없다. 정확한 근거는 **"같은 조사 세션(#959)에서 발견된 별개 파일의 회귀 갭 — 저비용 부수 수정으로 편입"**.
- **#7** `conversation-inspector.test.tsx` 의 "History 모드 (isLive=false) 에서도 tool 메시지가 표시된다" 테스트 **명칭·주석 정정** — #959 로 `items = conversationMessages` 가 되어 `isLive` 가 items 계산에서 빠졌으므로 "History 모드 전용" 이라는 명칭이 실제 검증(= `parseHistoryMessages` 출력 pass-through)과 어긋난다.
- **#1** 비AI 실패 노드의 `outputData` 전달 테스트 — #959 의 `outputData: payload.output ?? null` 이 error-port 라우팅 8종 전체에 적용되는데 비AI 실패+실제 output 조합 전용 테스트가 없다.

**제외**: References 탭·📚 chip 의 기존 동작 (참조만). 백로그 C(`cancelled` 표면)·D(redaction 정책)·E(`isConversationOutput` 구조) — 각 독립 PR.

## 설계 (사용자 결정 반영, 2026-07-17)

**결정 1 — 데이터 출처: `turnDebug[].ragSources`** (사용자 선택). 옛 마커 복원·양쪽 병행 안은 기각.
**결정 2 — 📚 chip 유지** (사용자 선택). 역할이 다르다 — **행**은 "이 턴에 KB 검색이 일어났다"는 시간축 이벤트, **chip**은 "이 응답이 무엇을 참조했다"는 출처 표시 + References 탭 진입점.

### 시각 구분 (§9.2 3중 신호 강제)

| | 아이콘 | 컨테이너 | chip | 의미 |
|---|---|---|---|---|
| **`rag`** (신규) | 🔎 | 점선 테두리 라인 (full-width, chat bubble 아님) | `KB · N chunk(s)` | 엔진이 LLM 호출 **전** 자동 검색해 컨텍스트에 붙임 |
| **`ai_tool`** (기존) | 🔧 | 실선 카드 + status badge (pending/success/error) | tool name | LLM 이 도구를 **호출**함 |

§9.2 가 "한 신호만으로 구분하지 않는다" 를 강제하므로 아이콘·컨테이너·chip 3중이 모두 다르다.

### 위치

KB 자동 검색은 그 턴의 LLM 호출 **직전**에 일어나므로, 행은 **같은 `turnIndex` 의 첫 assistant turn 앞**에 삽입한다. `system_error`(thread 마지막 APPEND)와 달리 **턴 내부 위치**를 갖는다.

## ⚠️ 1회차 consistency-check BLOCK: YES — CRITICAL 해소 (2026-07-17)

산출물: [`review/consistency/2026/07/17/11_32_25/`](../../review/consistency/2026/07/17/11_32_25/SUMMARY.md)

**Cross-Spec CRITICAL**: `meta.turnDebug` 를 conversation Preview 의 소스로 쓰는 것이 **§8.1 D4 · §9.3 · `6-websocket-protocol.md` §4.4** 세 곳이 반복 명문화한 *"Preview 1차 소스 = `conversationThread` snapshot, turnDebug 계열은 디버그 탭 전용"* 경계와 충돌한다. checker 는 초안의 `system_error` 유비도 논파했다 — `system_error` 는 `output.error` 에서 합성되고 §9.3 이 store/이력을 "**동일 thread 의 서로 다른 매체**"로 규정해 D4 를 유지한 채의 예외인 반면, `turnDebug` 는 conversationThread 와 무관한 별도 구조(`output_data.meta`)다. 초안의 "Inv-5 정신" 인용도 오용 (Inv-5 는 `groupToolCallItems` 의 양 surface 동일 결과 불변량이지 live/history 소스 대칭 일반론이 아니다).

### 실측 반증 — 경계는 이미 넘어져 있다

호출자가 코드로 검증한 결과, **`meta.turnDebug` 는 오늘 이미 conversation Preview 의 데이터 소스다**:

| 실측 | 위치 |
|---|---|
| `turnRefIndex` 가 `aiMetadata.turnDebug` 에서 생성 | [`result-detail.tsx:1026-1032`](../../codebase/frontend/src/components/editor/run-results/result-detail.tsx) |
| `ConversationInspector` 로 전달 (live·history 양 분기) | `:1093`, `:1116` |
| **`SummaryView`(= Preview 타임라인) assistant 버블 안에서 📚 `ReferencesChip` 렌더** | [`conversation-inspector.tsx:1206`](../../codebase/frontend/src/components/editor/run-results/conversation-inspector.tsx) (+ SelectedItemDetail `:417`) |

→ 본 작업은 **신규 경계 위반이 아니라 기존 관행의 확장**이다.

**진짜 근본 원인 (2회차 cross_spec 이 새로 발견)**: 이 관행은 **미문서화가 아니었다** — [`spec/5-system/9-rag-search.md` §4.1](../../spec/5-system/9-rag-search.md) 이 **이미** Preview 탭의 📚 chip 을 `meta.turnDebug[].ragSources` 출처로 문서화하고 있다. 문제는 그 문서와 `conversation-thread.md` 사이에 **상호 참조가 0건**(양방향 grep)이라 §9.3·D4 가 그 사실을 모른 채 서술됐다는 것이다. → **상호 링크 신설이 drift 의 근본 원인을 닫는 조치**다 (Phase 1 항목 15).

### 해소 방향 — **기존 관행 정식화** (사용자 결정, 2026-07-17)

D4 를 **번복하지 않고 적용 범위를 명확화**한다:

- **불변**: 대화 **turn** 의 1차 소스 = `conversationThread` snapshot (D4 원칙 유지)
- **명문화**: **보조 관찰성 레인** = **`meta.turnDebug[].ragSources` 한정** — 📚 chip(기존) + 🔎 행(신설). turn 을 **대체하지 않고 추가**되는 별개 레인

  > **스코프를 `ragSources` 로 좁히는 이유** (rationale WARNING 1): `meta.turnDebug` **전체**를 Preview 허용 소스로 명문화하면 형제 필드 `llmCalls` 까지 열린다. 그런데 `llmCalls` 는 `6-websocket-protocol.md` L506 이 **"raw debug payload, editor-only"** 로 못박은 필드로, D4 가 막으려던 바로 그 raw LLM payload 다. 전체를 열면 **D4 보호가 다른 경로로 재도입**된다 — 명문화 대상을 `ragSources`(마커 없는 구조화 데이터) 한정으로 못박는다.

**D4 의 원래 우려가 여기 해당하지 않는 이유** (§8.6 Rationale 핵심): D4 가 막으려던 것은 *emit messages 의 raw 노출* — `[from <nodeLabel>]` prefix 와 `[user-input]` 마커가 박힌 LLM payload 를 Preview 가 그대로 표시해 **사용자 오인 + 매 렌더 strip 부담**이 생기는 것이다. `turnDebug[].ragSources` 는 **구조화 관찰성 데이터**(`chunkId`/`documentName`/`score`/`content` preview)로 마커도 prefix 도 없다 — D4 의 위험 요인이 구조적으로 부재한다. 또한 D4 의 대립 축은 "thread vs emit messages" 즉 **무엇이 대화 turn 을 표현하는가**이지 "Preview 가 thread 외 데이터를 일절 못 읽는다"가 아니다 (그 해석은 이미 출하된 📚 chip 이 반증).

**기각한 대안** (사용자 검토 후 기각):
- *backend 가 `rag` turn 을 thread 에 push*: 아키텍처적으로는 D4 무손이나 (a) backend enum 5→6값 확장 → 위젯 wire 영향 (b) **이력 화면 비대칭 재발** — thread turn 은 `output.result.messages` 에 없어 §9.3 이력 복원 경로가 재구성 불가 → EH-DETAIL-12(v2) 영역. **#959 의 근본 원인과 같은 함정**.
- *Preview 밖으로 (행 포기)*: D4 무손이나 사용자 요청("RAG 및 도구를 구분되는 **행**으로")을 충족 못함 — 도구 행이 Preview 타임라인에 있으므로 비교 자체가 성립 안 함.

## Phase 1 — spec 개정

착수 전 `/consistency-check --spec` **2회차** 의무 (1회차 BLOCK 해소 확인).

### A. `spec/conventions/conversation-thread.md`

1. **§1.1.2 신설** — `rag` frontend 합성 source. §1.1.1(`system_error`)과 **동일 패턴**: backend enum 5값 불변, frontend 6값 → **7값**. `conversation-utils.ts` 의 `ConversationTurnSource` 확장.
2. **§1.2.2 신설** — `rag` 한정 `data?` shape: **`sources: RagSource[]` 만**. §1.2.1 과 평행.

   > **`turnIndex` 를 payload 에 넣지 않는다** (naming_collision WARNING 1): `ConversationItem` 은 이미 top-level 필수 필드 `turnIndex: number` 를 갖는다 ([`execution-store.ts:161`](../../codebase/frontend/src/lib/stores/execution-store.ts)). payload 에 중복 선언하면 두 값이 갈릴 때 어느 쪽이 SoT 인지 모호해진다 — top-level 을 단일 진실로 쓴다.
3. **§9.1 매핑표** 행 추가 — 위 시각 구분표. **`ai_tool` 행과의 구분 근거 명시**.
4. **§9.2 3중 신호 강제 열거 갱신** (convention WARNING 1) — §9.2 는 아이콘·컨테이너·chip 을 **열거**로 명시한다 (`👤/🤖/🧩/🔧/ℹ️/❌`). `rag` 신설 시 이 열거에 🔎 를 추가하지 않으면 "서로 겹치지 않는 글리프" 강제가 새 source 를 덮지 못한다.
5. **§9.6 그룹 분류 제외** — `system_error` 와 동일하게 `groupToolCallItems` 가 `rag` 를 unclaim 으로 두고 indent tree 에 흡수하지 않으며, **`isAssistantContentBlank` 평가도 미적용** (convention INFO 1 — `system_error` 문구와 완전 대칭). Inv-2("그룹 단위로만 줄어든다") 정합.
6. **§9.3 데이터 소스 표** — `rag` 행의 1차 소스 = `meta.turnDebug[].ragSources` (live·history 동일).

   > **기존 1행("conversation Preview 탭 = `conversationThread.turns` snapshot")과의 관계 명시 의무** (convention WARNING 3 + rationale WARNING 2): `turnDebug` 는 thread 도 emit messages 도 아닌 **제3의 소스**다. §8.1 **D4**("conversation Preview 의 1차 소스를 `conversationThread` snapshot 으로 두고 emit messages 는 debug 패널 전용으로 격리")가 막으려던 것은 **emit messages 의 raw 노출로 인한 사용자 오인**이지 meta 파생 데이터의 병용이 아니다. `rag` 행은 (a) 대화 turn 을 대체하지 않고 **추가**되는 별개 레인이며 (b) `meta.turnDebug` 는 References 탭이 이미 쓰는 1급 관찰성 데이터다. → §9.3 표에 `rag` 행을 **1행의 대체가 아닌 보완**으로 서술하고, **§8.1 D4 서술도 "thread snapshot = 대화 turn 의 1차 소스" 로 범위를 명확히 갱신**한다 (D4 번복 아님 — 적용 범위 명확화).
6. **§9.11 변환 contract 표** — 신규 함수 **`mergeRagRetrievalItems(items, turnDebug)`** 등재 + 등가성 서술 (§9.11 "신규 변환 path 도입 시 contract 표 갱신 + 등가성 정의 만족 여부 검토 의무" 이행). **§9.11 서두의 "두 1차 변환 함수"·"세 변환 path" 서수 표현도 함께 갱신** (convention WARNING 2).

   > **명명 근거** (naming_collision INFO): 초안의 `injectRagItems` 는 backend `injectConversationContext()` (§2.3 — LLM 호출 전 **컨텍스트 주입**) 와 "inject" 어휘가 겹치는데 의미가 다르다 (이쪽은 **UI items 병합**). 기존 `mergeOrphanToolItems` 와 같은 `merge*Items` 패턴을 따라 `mergeRagRetrievalItems` 로 명명한다.
7. **§8.1 D4 서술 범위 명확화** (CRITICAL 해소 핵심) — "conversation Preview 의 1차 소스 = `conversationThread` snapshot" 을 **"대화 turn 의 1차 소스"** 로 범위 명확화하고, `meta.turnDebug` 를 **보조 관찰성 레인**(turn 을 대체하지 않는 별개 레인)으로 명문화. **번복이 아니라 범위 명확화 + 기존 drift(📚 chip) 정리**임을 명시.
8. **`Inv-9` 신설** (§9.9, Cross-Spec WARNING 2) — 🔎 행과 References 탭은 **같은 `meta.turnDebug` 를 소비하는 두 렌더 경로**이므로, 동일 `turnIndex` 에 대해 **동일 `sources[]`** 를 보여야 한다. 어긋나면 "References 엔 chunk 가 있는데 Preview 행엔 없음" 류 혼동 발생. 구현은 `turnRefIndex` 와 **동일 소스 함수 재사용**으로 보장.
9. **§9.12 요소별 시각 표 행 추가** (Cross-Spec INFO) — §9.12 는 "**모든** conversation 요소"의 발생 시각 노출을 **강제**하는데 `RagSource` 스키마에 timestamp 가 없다. `rag` 행은 **부모 assistant turn 의 `llmCalls[0].startedAt`(동일 turnIndex)을 대리**로 쓰고 소요시간은 표시하지 않는다 (즉시 주입) — 이 매핑을 표에 명시.
10. **§9.10 CT-S18 / CT-S19 / CT-S20** + 충족 테스트 매핑.
11. **§8.6 Rationale** — 위 §해소 방향 + 아래 §Rationale 초안.

### B. `spec/5-system/6-websocket-protocol.md` (Cross-Spec WARNING 1)

12. **§4.4 개정** — `waiting_for_input`(ai_conversation) payload 의 **`nodeOutput.meta.turnDebug` 필드를 공식 문서화**. 현재 wire 필드로 문서화된 것은 `conversationConfig`(+선택적 `conversationThread`, §4.4.5)뿐이라, draft 의 live 소스 근거가 **코드 실측뿐이고 spec 텍스트 근거가 없다**. 다른 소비자(EIA/위젯 파서)가 이 필드의 존재/부재를 예측할 수 있어야 한다.
13. **§4.4 의 "대화 UI 는 thread snapshot 을 1차 소스로 사용" 문구** — §8.1 D4 와 동일하게 "대화 turn 의" 로 범위 명확화 (세 곳 동시 정합).

### C. `spec/5-system/9-rag-search.md`

14. **§4.1 갱신** — 현재 "Preview UI = chip-only" 로 서술돼 있어 🔎 행 신설과 drift 발생.
15. **상호 링크 신설 (근본 원인 차단)** — `9-rag-search.md §4.1` ↔ `conversation-thread.md §9.1/§9.3` 양방향 cross-ref. **현재 상호 참조 0건**이 이번 drift 를 낳았다 (한쪽은 chip 을 승인해 두고 다른 쪽은 그 사실을 모른 채 "Preview 1차 소스 = thread" 를 서술). 링크가 없으면 **같은 drift 가 또 생긴다**.

### D. `spec/4-nodes/3-ai/1-ai-agent.md` (2회차 cross_spec WARNING)

16. **L732 갱신** — *"진행 중 누적치를 노출해 **References / LLM Usage 탭이 동작**"* 이 turnDebug 의 존재 목적을 **디버그류 탭으로 한정**해 서술한다. 1회차 CRITICAL 이 명시 지목한 **4번째 충돌 지점**인데 Phase 1 편집 목록에서 누락됐다 — `ragSources` 한정으로 conversation Preview 의 보조 레인도 소비처임을 추가.

### 카운트 drift 동반 정정 (convention WARNING 2~4)

17. **§9.9 서두 "다음 8가지 불변량"** → **9가지** (Inv-9 추가). *#959 에서 "6가지"(실제 7행) 오기를 고쳤는데 같은 클래스가 재발하지 않도록 이번에 반드시 동반 갱신.*
18. **§9.1 표 행수 인용** — §9 서두 위젯 스코프 예외 blockquote 의 "§9.1 표는 6행이지만…" 문구가 `rag` 추가로 7행이 된다.
19. **§9.11 서수 표현** — "두 1차 변환 함수"/"세 변환 path" 가 `mergeRagRetrievalItems` 추가로 바뀐다. **단 `mergeRagRetrievalItems` 는 `messagesToConversationItems`/`threadTurnsToConversationItems` 같은 *1차 변환*이 아니라 `mergeOrphanToolItems` 계열 *후처리 병합*이므로**, "두 1차 변환 함수" 는 **그대로 두고** "세 변환 path" 표만 확장한다 (convention WARNING 2 — 과도한 갱신 회피).

### CT 시나리오

| ID | 시나리오 | 검증 |
|---|---|---|
| CT-S18 | 한 턴에 자동 KB 검색(`turnDebug[].ragSources` 비어있지 않음) + KB **도구 호출**(`ai_tool`)이 **동시** 발생 | (a) 🔎 RAG 행과 🔧 도구 행이 **각각 별도 row** 로 노출 (b) §9.2 3중 신호가 모두 다름 (c) `groupToolCallItems` 가 `rag` 를 claim 하지 않음 (§9.6) (d) 📚 chip 병존 (e) **conversation Preview 와 실행 트리 timeline 양 surface 동시 노출** (§9.6 적용 surface) (f) **`Inv-9`** — 같은 turnIndex 에 대해 References 탭과 🔎 행의 `sources[]` 동일 |
| CT-S19 | `turnDebug` 부재 (구형 실행 / legacy payload) | RAG 행 **생략**, 레이아웃 무손상 — §9.12 "결측 내성" 정합 |
| CT-S20 | **cross-node 공유 thread** — presentation 노드 turn 이나 타 AI 노드 turn 이 섞인 thread 에서 `turnDebug` 는 **선택된 노드의 `outputData.meta`** 에서만 온다 (thread 는 execution 스코프 공유, meta 는 노드 스코프) | 선택 노드가 발생시키지 않은 turn 앞에는 🔎 행이 **붙지 않는다** — 두 데이터의 스코프가 다름을 pin (Rationale WARNING 3) |

## Phase 2 — 구현

착수 전 `/consistency-check --impl-prep` 의무. TDD.

0. **타입 레이어 이동 (선행)** — `RagSource` / `TurnRagDelta` 를 `components/editor/run-results/output-shape.ts` → **`lib/conversation/`** 으로 옮기고 `output-shape.ts` 는 **re-export** 로 남긴다.

   > **레이어 역전 회피** (impl-prep WARNING): `mergeRagRetrievalItems` 는 §9.11 계약상 `lib/conversation/conversation-utils.ts` 에 산다. 그 함수가 `TurnRagDelta` 를 `components/` 에서 import 하면 **`lib/` → `components/` 역전**이 된다 — 실측 결과 저장소에 그런 import 는 **한 건도 없어** 최초 위반이 된다. 기존 선례가 정확히 이 문제를 같은 방법으로 풀었다: [`components/editor/run-results/conversation-utils.ts:1-4`](../../codebase/frontend/src/components/editor/run-results/conversation-utils.ts) — *"conversation utility 는 `@/lib/conversation/` 에 둬서 `@/lib/websocket/` 이 레이어 역전 없이 소비하게 하고, 이 디렉터리의 컴포넌트·테스트는 안정성을 위해 로컬 경로 import 를 유지"*. 동일 패턴 적용.

1. `conversation-utils.ts` — `ConversationTurnSource` 에 `rag` 추가 (6→7값), `mergeRagRetrievalItems(items, ragDeltas: TurnRagDelta[])` 신설·export (§9.11 등재분).

   > **exhaustive switch case 의무**: `rag` 를 유니온에 넣으면 `threadTurnsToConversationItems` 의 `const _exhaustive: never = turn.source` ([`conversation-utils.ts:322`](../../codebase/frontend/src/lib/conversation/conversation-utils.ts)) 가 **컴파일 타임에 `rag` case 를 강제**한다. wire 에 `rag` 가 실려오지 않아도 방어 case 를 둔다 — `system_error` 가 같은 구조 (`interaction-type-registry.md` §2 주석).
2. `execution-store.ts` — `ConversationItem.type` 유니온에 `rag` + `rag?: { sources: RagSource[] }` 필드 (**`turnIndex` 는 top-level 재사용** — 위 §1.2.2 참조).
3. `conversation-inspector.tsx` — **`RagRetrievalRow`** (SummaryView) — SelectedItemDetail 도 같은 컴포넌트 재사용.

   > **`RagDetail`/`RagBubbleSummary` 이름을 재사용하지 않는다** (naming_collision WARNING 2): 그 이름들은 **바로 직전 커밋 `12ceee587`(PR #959)에서 삭제**됐다. 같은 이름을 다른 데이터 출처로 되살리면 git 이력상 "되돌림(revert)" 으로 오인된다. `RagRetrieval*` 은 이름 자체가 "도구 호출이 아니라 주입 이벤트" 라는 본 작업의 핵심 구분을 담는다.

4. `result-detail.tsx` — `aiMetadata.turnDebug` → `mergeRagRetrievalItems` 배선 (turnRefIndex 와 **동일 소스**).
5. **AST exhaustiveness guard 계승** (Rationale INFO) — §8.3 이 `system_error` 신설 시 [`interaction-type-exhaustiveness.test.ts`](../../codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts) 가 "모든 처리 분기 위치 등록을 강제" 하도록 한 선례를 `rag` 에도 적용 — 새 source 가 어느 분기에서 누락되면 테스트가 잡는다. 이번 #959 회귀(분기 누락으로 조용히 소실)의 재발 방지 장치.
6. **`conversation-timeline-item.tsx` — 실행 트리 timeline 의 `rag` 분기** (impl-prep CRITICAL 2). `result-timeline.tsx` 는 이 컴포넌트에 **위임만** 하고 자체 source 분기가 없다 (`interaction-type-registry.md` §2 매트릭스가 명시). 여기를 빠뜨리면 §9.6 이 강제하는 양 surface 중 **한쪽에서 🔎 행 시각이 깨진다**.
7. `result-timeline.tsx` — **Inv-5 동시 적용 의무 이행** (convention WARNING 4): §9.6 "적용 surface" 가 conversation Preview(`SummaryView`)와 실행 트리 timeline(`ResultTimeline`) **양쪽 동시 적용**을 강제한다. "확인" 이 아니라 `rag` 행을 timeline 에도 한 줄 컴팩트 형태로 **렌더**하고, CT-S18 에 양 surface 검증을 포함한다.

## Phase 3 — 테스트

- CT-S18 / CT-S19 (`conversation-utils.test.ts` + `result-detail.test.tsx`)
- fixture `conversation-scenarios.ts` 추가
- **Slice B**: #7 명칭 정정, #1 비AI 실패 노드 테스트
- frontend unit 전체 (plan frontmatter 가드가 frontend vitest)

## Phase 4 — 리뷰

`/ai-review` + Critical/Warning fix. **코드 동결 후 마지막 라운드**를 돌려 게이트 재무장 루프를 피한다 ([#959 교훈](../../review/code/2026/07/17/08_22_45/SUMMARY.md) — 리뷰 done-time 은 세션 디렉토리 타임스탬프이므로 그 이후 코드 변경은 미리뷰 상태가 된다).

## Rationale 초안 (§8.6)

**`rag` 를 7번째 frontend 합성 source 로 신설한 이유**: RAG 주입은 backend thread 에 turn 으로 누적되지 않는다 (§1.1 의 5값 enum 은 발화·응답·도구결과만 다룸). 그러나 사용자에게는 "이 턴에 KB 가 주입됐다"가 시간축 위의 1급 이벤트다. `system_error`(§8.3)가 같은 이유로 frontend 합성 6번째 source 가 된 선례를 그대로 따른다 — backend enum 을 오염시키지 않고 렌더 층에서 합성.

**`ai_tool` 재사용을 기각한 이유**: 자동 RAG 주입은 **LLM 이 호출한 도구가 아니다** — 엔진이 LLM 호출 전에 컨텍스트를 주입한 것이다. `ai_tool` 로 표현하면 (a) `toolCallId` 매칭 대상이 없고 (b) §9.6 그룹 분류가 부모 assistant 의 `toolCalls.length` 로 child 를 sequence-claim 하는데 RAG 는 그 카운트에 없어 claim 불가 (c) 사용자에게 "LLM 이 KB 를 호출했다"는 **잘못된 인과**를 전달한다. 사용자 요청("RAG 및 도구는 구분되는 UI")의 핵심이 바로 이 구분이다.

**📚 chip 을 병존시키는 이유**: 행과 chip 은 답하는 질문이 다르다 — 행은 "언제 무엇이 주입됐나"(시간축), chip 은 "이 응답이 무엇에 근거했나"(출처 귀속) + References 탭 진입점. chip 을 없애면 응답↔출처 연결이 끊기고 §9.1 `ai_assistant` 행의 기존 규약도 바뀐다.

**`turnDebug` 를 소스로 택한 이유**: 옛 인라인 파서의 `### Relevant Knowledge` 마커는 `RagSearchService.buildContext` 의 프로덕션 호출부가 없어 신규 실행에 생성되지 않는다 (#959 리뷰에서 requirement-reviewer 가 독립 확인). `turnDebug` 는 References/LLM Usage 탭이 이미 쓰는 현행 데이터이고 live(waiting `nodeOutput.meta`)·history(영속 `outputData.meta`) **양쪽에 존재**해 Inv-5 대칭을 만족한다.

**구형 데이터 한계**: `turnDebug` 가 없던 시절 실행은 RAG 행이 생기지 않는다. §9.12 "결측 내성" 규약대로 생략하며 (CT-S19), 옛 마커까지 덮는 이중 변환 경로는 §9.11 다중 정의 금지 위반이라 도입하지 않는다.

## 결정 기록

- **데이터 출처 = `turnDebug[].ragSources`** (사용자 결정, 2026-07-17). 대안(옛 마커 복원 / 둘 다)은 각각 죽은 경로 부활·§9.11 위반으로 기각.
- **📚 chip 병존** (사용자 결정). 대안(행으로 대체)은 응답↔출처 귀속과 References 진입점 손실.
- **`rag` 를 별도 source 로** (vs `ai_tool` 재사용 / `system` + discriminator): 위 Rationale. `system` + `data.kind` 안은 §8.3 이 `system_error` 에 대해 이미 기각한 논리(1:1 시각 매핑을 1:N 으로 분기)가 그대로 적용.
