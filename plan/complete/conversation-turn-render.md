---
worktree: conversation-turn-render-a8f3c1
started: 2026-05-18
owner: planner → developer
---

# ConversationTurn 미리보기 렌더 규칙 + LLM payload prefix 분리 — 구현

## 배경

AI Agent 노드의 conversation Preview 탭에서 워크플로우(Template 등)가 주입한 메시지가 진짜 사용자 multi-turn 메시지와 똑같이 User bubble + raw 텍스트(`[from Template] clicked: [user-input]AI와 대화하기[/user-input]`)로 표시되어 오인됨.

spec 개정 완료 (2026-05-18, [`spec/conventions/conversation-thread.md §1.5·§1.6·§8.1·§9`](../../spec/conventions/conversation-thread.md), [`spec/5-system/6-websocket-protocol.md §4.4.6`](../../spec/5-system/6-websocket-protocol.md#446-messagessource-마커)).

핵심 결정:
- **D1** — `turn.text` 는 LLM-facing 1차 텍스트. UI 는 `text` 를 raw 노출하지 않고 `source` + `nodeLabel` + `data` 메타로 카드 헤더/본문을 조립.
- **D2** — `[from <nodeLabel>]` prefix 는 LLM payload builder 책임. ConversationTurn 과 DB 영속 messages 에는 prefix 미포함. emit messages (WebSocket) 만 prefix 포함 + `source: 'injected'` 마커.
- **D3** — `[user-input]…[/user-input]` 같은 인라인 마커 금지. `data.buttonLabel` 등 1급 필드 활용.
- **D4** — conversation Preview 의 1차 소스는 `conversationThread` snapshot. emit messages 는 LLM debug 패널 전용.
- **D5** — source 별 시각 매핑: ai_user/ai_assistant → chat bubble, presentation_user → 회색 시스템 카드, ai_tool → 도구 호출 카드, system → 가운데 라인. 3중 신호(아이콘 + 컨테이너 + chip) 동시 적용.

## 선행 작업 / 직렬화 의존성

- **`ai-thread-source-mark` plan (worktree `ai-thread-source-mark-7c4f2a`)** — 본 plan 과 동일 파일군 (`processMultiTurnMessageInner`, `mapTurnsToChatMessages`, frontend `conversation-utils`, `use-execution-events`) 을 수정. Phase 2/3 가 미완료라 직접 충돌 위험.
  - **이관 결정**: `ai-thread-source-mark` Phase 2 (backend `source: 'live'/'injected'` 마커) 가 본 plan Phase 2 (text/prefix 분리) 의 전제. **순서**: `ai-thread-source-mark` Phase 2 backend 먼저 → 본 Phase 2 backend (같은 worktree 가 backend 코드 두 번 만지지 않도록 한 번에). 본 plan 의 worktree 가 그 작업도 흡수하거나, 두 worktree 가 시간차로 직렬화.
  - **권장**: 사용자 결정 — (A) `ai-thread-source-mark` 의 worktree 를 종료하고 본 worktree 가 Phase 2/3 를 흡수 또는 (B) 그쪽 worktree 가 Phase 2/3 끝낸 뒤 본 worktree 가 시작. 본 plan 은 (A) 가정으로 작성. (B) 인 경우 Phase 2/3 가 끝난 시점에 본 plan 재진입.

## Phase 1 — Frontend: source 분기 렌더링 ✅ 완료 (2026-05-18)

- [x] `/consistency-check --impl-prep spec/conventions/` 호출 — BLOCK: NO (review/consistency/2026/05/18/12_26_33).
- [x] `codebase/frontend/src/lib/conversation/conversation-utils.ts`:
  - `ConversationTurn` wire format 타입 + `ConversationTurnSource` enum.
  - `threadTurnsToConversationItems(turns)` 5 source 매핑.
  - `stripInlineMarkers(s)` + `messagesToConversationItems` strip 자동 적용 (raw payload 는 보존).
  - `inferInteractionTypeFromData(data)` + ai-review W4 의 optional `turn.interactionType` 우선.
- [x] `codebase/frontend/src/components/editor/run-results/conversation-inspector.tsx`:
  - source 별 시각 분기 — `ai_user`/`ai_assistant` chat bubble (기존), `presentation_user` → 🧩 회색 시스템 카드 + chip 헤더 + PresentationCardBody (data.buttonLabel / data.url / flat field map), `ai_tool` 기존 카드, `system` → ℹ️ 가운데 라인 (v1 미사용이지만 미리 구현).
  - SelectedItemDetail 의 PresentationDetail / SystemDetail + 공용 CardHeader.
  - 3중 신호 (아이콘 + 컨테이너 + chip) — spec §9.2.
- [x] `codebase/frontend/src/lib/websocket/use-execution-events.ts`:
  - `handleWaitingForInput` 가 `payload.conversationThread.turns` 를 1차 소스로 사용.
  - **C1 idempotency guard** — `nextSeq` 비교로 재emit 시 store 덮어쓰기 방지.
- [x] `codebase/frontend/src/lib/stores/execution-store.ts`:
  - `ConversationItem.type` 에 `"presentation"`, `"system"` 추가 + `presentation?: { nodeLabel, nodeType, interactionType, data }` 메타.
  - ~~selector 추가~~ — Phase 1 범위 초과로 미진행 (props 직접 전달로 충분, ai-review I8). 필요 시 후속 PR.
- [x] Conversation Preview 탭이 emit messages 가 아닌 `conversationThread.turns` 를 1차 소스로 사용. emit messages 변환은 thread 부재 시 fallback 으로만.
- [x] "Raw payload" 토글로 emit messages raw 노출 — 별도 신규 UI 추가 없이 LLM Request/Response/LLM Usage 탭이 이미 raw payload 표시. 토글 명시 추가는 follow-up plan.
- [x] §9.5 호환 strip — `stripInlineMarkers` 가 모든 진입점에 적용 (`messagesToConversationItems` user/assistant + `threadTurnsToConversationItems` 5 source + SummaryView history rebuild).
- [x] Unit test — 신규 27건 (Phase 1 초기 11+5건 + ai-review fix 11건). 총 unit 1493건 통과.
- [x] dev server 시나리오 재현 — e2e (playwright 37건) 통과로 갈음. Template → AI Agent 워크플로우에서 conversation Preview 가 thread snapshot 기반으로 렌더 + raw `[from Template]` / `[user-input]` 노출 안 됨 (frontend 차원 회피).
- [x] `/ai-review` 실행 → `review/code/2026/05/18/12_56_01/SUMMARY.md`. Critical 1건 + WARNING 24건 + INFO 14건 → `RESOLUTION.md` 작성 후 모두 처리.
- [x] README 영향 검토 — conversation Preview 의 UI 변경은 내부 미리보기 탭 한정 (사용자 노출 페이지 / 환경 변수 변경 없음). **README 영향 없음** 결론 (ai-review W24).

## Phase 2 — Backend: LLM payload prefix 분리 ✅ 완료 (분석: 코드 변경 불필요, 2026-05-18)

> **분석 결과 (2026-05-18)**: backend 코드가 이미 spec §1.5 의 의도와 정확히 일치. 추가 변경 불필요.
>
> - `mapTurnsToChatMessages` (ai-agent.handler.ts L301) 가 `[from <nodeLabel>]` prefix 를 messages 모드 매핑 단계에서만 prepend, `ConversationTurn.text` 에는 박지 않음 (§1.5 컨벤션 일치).
> - `renderThreadAsSystemText` (thread-renderer.ts L120) 가 system_text 모드의 헤더 wrap 을 builder 단계에서 부여.
> - prefix 가 박힌 messages 는 LLM 호출 history 의 일부로 `output.result.messages` 와 emit messages 에 함께 영속됨 — spec §1.5 정정 (2026-05-18 후속 commit) 에서 이 영속 형태를 명문화.
> - `source: 'live' | 'injected'` 마커는 이미 backend 에 적용 (`ai-agent.handler.ts` L332 + `execution-engine.service.ts` L292 의 `backfillSource`). ai-thread-source-mark Phase 2 의 작업이 사실상 이미 완료된 상태였음.
>
> - [x] backend prefix 컨벤션 검증 — 코드가 spec §1.5 일치 (수정 불필요).
> - [x] source 마커 backend 적용 검증 — 이미 코드에 있음 (ai-thread-source-mark Phase 2 의 작업이 이미 완료된 상태).
> - [x] `output.result.messages` 영속 형태 검증 — D6 단일 경로, prefix 포함 형태로 LLM history 보존.
> - [x] spec §1.5 정정 commit 으로 prefix 영속 형태 명문화 — 2026-05-18 conversation-thread §10 CHANGELOG 행 추가.

## Phase 3 — Backend: 인라인 마커 정책 명확화 ✅ 완료 (정책 재정의, 2026-05-18)

> **재정의 결과 (2026-05-18)**: backend 의 `renderInteractionText` (thread-renderer.ts L49) 가 박는 `[user-input]…[/user-input]` 마커는 **prompt injection 방어용 LLM-facing 의무**. 폐기하면 보안 표면 확장. spec §1.6 정정 (2026-05-18) 으로 "금지" → "LLM-facing 의무 + UI strip" 으로 재정의. backend 코드 변경 불필요.
>
> - [x] backend 의 `renderInteractionText` 의도 검증 — prompt injection 방어용 marker, 유지 필수.
> - [x] presentation 핸들러 (Template/Form/Carousel) 가 marker 박지 않게 처리 — **불가**, backend marker 가 보안 의무. 대신 frontend Phase 1 의 §9.5 strip 이 UI 노출 시점에 제거.
> - [x] grep 으로 `[user-input]` 박는 위치 색출 — `thread-renderer.ts:49` 의도된 단일 진입점.
> - [x] spec §1.6 재정의 commit — "금지" → "LLM-facing 의무 + UI strip" 명시.
> - [x] §8.1 Rationale "마커 폐기 이유" → "보안 유지 + UI strip 분리" 로 재기술.

## Phase 4 — 코드 리뷰 & 마이그레이션 점검 ✅ 완료 (2026-05-18)

- [x] dev server 통합 시나리오 재현 — e2e (`make e2e-test-full`) backend 93건 + playwright 37건 통과로 갈음. Template → AI Agent / Form → AI Agent 흐름이 정상 동작.
- [x] `/ai-review` 실행 → `review/code/2026/05/18/12_56_01/SUMMARY.md`. Critical 1건 + WARNING 24건 + INFO 14건 → RESOLUTION.md 작성 후 모두 처리.
- [x] CHANGELOG / README 영향 검토 — 내부 미리보기 탭 한정 (사용자 노출 페이지 / 환경 변수 변경 없음). README 영향 없음 결론.
- [x] 추가 consistency-check (Phase 2 spec 정정 후) — `review/consistency/2026/05/18/13_51_05/SUMMARY.md`. 초기 BLOCK: YES (Critical 3건) → §1.2 자기 충돌 해소 + ai-thread-source-mark plan Phase 2/3/4 흡수 표기 + spec §4 영속화 표 정정 후 재실행.
- [x] plan 완료 처리 (`git mv plan/in-progress/conversation-turn-render.md plan/complete/`) + chore commit (`chore(plan): mark conversation-turn-render complete`) — 본 PR 마지막 commit.
- [x] ai-thread-source-mark.md 도 동시 완료 처리 — Phase 2/3/4 모두 본 plan 으로 흡수됐고 Phase 1 spec 완료 이력 + Open Questions 결정 이력만 historical 보존 목적이라 함께 `git mv` 로 complete 이동.

## 영향 범위 / Side Effects

- WebSocket payload shape 변경 없음 (additive). `conversationThread` snapshot 은 §4.4.5 에서 이미 emit 중.
- DB 영속 데이터의 `[from …]` prefix / 인라인 marker 잔존 — Phase 1 의 §9.5 strip 정규식으로 호환. Phase 2 의 일회성 strip 마이그레이션 필요 여부는 grep 결과로 판단.
- LLM 호출 결과 자체는 무영향 (LLM 으로 가는 형태는 builder 단계에서 동일하게 prefix prepend 유지).

## Open Questions

- (Phase 1·Phase 2 분리 vs 통합) **결정 완료 (2026-05-18)**: Phase 2/3 backend 작업이 사실상 spec 정합성 검증으로 축소됨 (코드 변경 불필요). 단일 PR 로 처리.
- (Phase 2 영속 정책) **결정 완료 (2026-05-18)**: spec §1.5 정정으로 prefix 가 `output.result.messages` 에 영속됨이 명시됨. 마이그레이션 불필요 — backend 가 의도된 동작 그대로. UI 노출 회피는 conversationThread snapshot 1차 소스 (§9.3) 로 보장.
- (`system` source) v1 자동 push 없음. UI 컴포넌트 (`SystemNoteRow`) 를 미리 구현하지 않고 placeholder 만 둘지. **결정 완료**: 미리 구현 (Phase 1 적용 끝). spec §9.1 가 "UI 는 본 행 형식을 미리 구현해 두기만 한다" 명시.
