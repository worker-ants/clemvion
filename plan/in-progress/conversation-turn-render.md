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

## Phase 2 — Backend: LLM payload prefix 분리

> `ai-thread-source-mark` Phase 2 의 source 마커 부여와 한 commit/PR 에 묶어 처리.

- [ ] `/consistency-check --impl-prep codebase/backend/src/modules/execution-engine/conversation-thread/`
- [ ] `codebase/backend/src/modules/execution-engine/conversation-thread/thread-service.ts` (또는 push 진입점):
  - `appendInternal` 등 push 시점에 `text` 에 `[from <nodeLabel>]` prefix 가 박혀 들어오면 strip 하거나, push 시점부터 raw 본문만 받도록 보장.
  - 기존 thread snapshot (Redis / in-memory) 에 prefix 가 박혀있다면 한 번에 strip 마이그레이션 (또는 lazy strip on read — TTL 짧으니 마이그레이션 불필요할 수 있음).
- [ ] `codebase/backend/src/modules/execution-engine/conversation-thread/thread-renderer.ts` (또는 동등 위치):
  - messages 모드 매핑 (`mapTurnsToChatMessages`) 에서만 `[from <nodeLabel>] ` prefix prepend.
  - system_text 모드 매핑도 동일 — turn.text 에는 prefix 박지 않고 builder 가 wrap 헤더 부여.
- [ ] `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts`:
  - `processMultiTurnMessageInner` 가 push 하는 user/assistant/tool 메시지는 raw 본문 — `ai-thread-source-mark` Phase 2 의 `source: 'live'` 마커와 함께 정리.
- [ ] `output.messages` DB 영속:
  - **결정 필요 (i6)**: `output.messages[].content` 에 prefix 미포함 (§1.5) 으로 통일. 기존 DB 데이터에 prefix 가 박혀있는지 grep + 필요시 일회성 strip 마이그레이션.
  - `source: 'live'/'injected'` 마커 영속 여부는 `ai-thread-source-mark` Phase 2 와 동일 결정.
- [ ] Unit test:
  - `thread-renderer.spec.ts`: messages 모드 매핑이 prefix 를 정확히 prepend.
  - `ai-agent.handler.spec.ts`: push 된 turn.text 에 prefix 없음 (회귀).
  - `output.messages` 영속 형태 검증.

## Phase 3 — Backend: 인라인 마커 제거

- [ ] `codebase/backend/src/nodes/presentation/template/` (또는 Template 노드 핸들러 위치):
  - `output.interaction.data.buttonLabel` 만 emit. `[user-input]…[/user-input]` 마커 박는 코드 제거.
- [ ] `codebase/backend/src/nodes/presentation/{carousel,table,chart,form}/` 동일 점검 (마커 박는 코드 존재 시 제거).
- [ ] grep 으로 코드베이스 전체에서 `[user-input]`, `\\[from ` 박는 위치 색출 후 정리.
- [ ] Unit test:
  - presentation 핸들러 output 에 인라인 마커가 박히지 않음 (회귀).

## Phase 4 — 코드 리뷰 & 마이그레이션 점검

- [ ] dev server 통합 시나리오 재현:
  - Template → AI Agent (Multi-turn) → 사용자 입력: Preview 탭이 시스템 카드 + chat bubble 로 시각 구분.
  - Form → AI Agent: form fields 가 카드 본문에 표로 표시.
  - 옛 실행 이력 (DB 에 prefix/marker 가 박혀 있을 수 있음): §9.5 strip 정규식이 동작해 raw 노출 없음.
- [ ] `/ai-review` 실행 → `review/code/<...>/SUMMARY.md` 검토.
- [ ] CHANGELOG / README 영향 검토.
- [ ] plan 완료 처리 (`git mv plan/in-progress/conversation-turn-render.md plan/complete/`) + chore commit (`chore(plan): mark conversation-turn-render complete`).

## 영향 범위 / Side Effects

- WebSocket payload shape 변경 없음 (additive). `conversationThread` snapshot 은 §4.4.5 에서 이미 emit 중.
- DB 영속 데이터의 `[from …]` prefix / 인라인 marker 잔존 — Phase 1 의 §9.5 strip 정규식으로 호환. Phase 2 의 일회성 strip 마이그레이션 필요 여부는 grep 결과로 판단.
- LLM 호출 결과 자체는 무영향 (LLM 으로 가는 형태는 builder 단계에서 동일하게 prefix prepend 유지).

## Open Questions

- (Phase 1·Phase 2 분리 vs 통합) Phase 1 (frontend) 만 먼저 PR 으로 내도 사용자 오인 문제는 해소됨 (UI 가 더 이상 raw text 노출 X). Phase 2 (backend prefix 분리) 는 시각적으로는 무영향이라 별도 PR 또는 후속 plan 으로 분리 가능. **잠정 결정**: Phase 1 단독 PR 우선 → Phase 2/3 는 `ai-thread-source-mark` Phase 2 와 묶어 두 번째 PR.
- (Phase 2 영속 정책) `output.messages[].content` 의 prefix 미포함을 신규 데이터에만 적용하고 기존 데이터는 §9.5 strip 으로 처리할지, 일회성 마이그레이션을 돌릴지. **잠정 결정**: strip 만으로 충분 (실행 이력은 시점 기록 성격, retroactive 정합성 부담 낮음).
- (`system` source) v1 자동 push 없음. UI 컴포넌트 (`SystemNoteRow`) 를 미리 구현하지 않고 placeholder 만 둘지. **잠정 결정**: 미리 구현. spec §9.1 가 "UI 는 본 행 형식을 미리 구현해 두기만 한다" 명시.
