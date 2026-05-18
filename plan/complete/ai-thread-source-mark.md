---
worktree: ai-thread-source-mark-7c4f2a → conversation-turn-render-a8f3c1 (Phase 2/3 흡수, 2026-05-18)
started: 2026-05-16
owner: planner → developer
---

> **Worktree 흡수 메모 (2026-05-18)**: 원래 worktree `ai-thread-source-mark-7c4f2a` 는 Phase 1 (spec) 완료 후 cleanup 됨. Phase 2 (Backend) · Phase 3 (Frontend) 의 미완료 체크박스는 `plan/in-progress/conversation-turn-render.md` 의 Phase 2 (LLM payload builder 분리) / Phase 3 (인라인 마커 제거) 가 흡수해 worktree `conversation-turn-render-a8f3c1` 에서 함께 진행한다. 본 plan 은 Phase 1 완료 기록 + Open Questions 결정 이력 보존 목적으로 in-progress 에 남겨두며, conversation-turn-render plan 의 Phase 2/3 완료 시 본 plan 의 Phase 2/3 도 동시에 `[x]` 처리하고 본 plan 을 complete 로 이동한다.

# AI 대화 메시지 source 마커 도입

## 배경

AI Agent 노드의 multi-turn 대화에서 사용자가 어시스턴트 응답을 클릭했을 때 run-results 패널의 Response / Request / LLM Usage 탭이 항상 "해당 턴에 대한 LLM 호출 정보가 저장되어 있지 않습니다." 만 보여주는 회귀가 발견됨.

### 원인

- 백엔드 `ConversationThread` 가 업스트림 노드(Template / Buttons / 다른 AI Agent)의 출력을 AI Agent 의 messages 배열 앞에 `role: 'user'` 로 prepend 한다 (presentation_user → `[from <nodeLabel>] ...`).
- WebSocket `execution.ai_message` 페이로드의 `messages` 는 system 만 필터링하고 injection 결과를 그대로 포함한다.
- frontend `messagesToConversationItems` 가 `role: 'user'` 메시지마다 `currentTurn++` 한다. 그 결과 injection 의 user 메시지도 turn 으로 계산되어, 실제 어시스턴트의 `turnIndex` 가 backend `turnCount` 보다 N 만큼 커진다.
- frontend 가 `debugByTurn.get(turn)` 로 LLM 호출 디버그를 매칭하는데, 키가 어긋나 `requestPayload`/`responsePayload` 가 attach 되지 않는다. fallback (`fromConversationMessages`) 도 둘 다 null 이라 skip → 빈 trace.

### 해결 방향

WebSocket `execution.ai_message` 와 `execution.waiting_for_input` 의 `messages[]` 항목에 `source: 'live' | 'injected'` 마커를 부여한다. frontend 변환기가 `source === 'injected'` 인 user 메시지는 `currentTurn` 증가에서 제외한다. 추후 다른 origin 도입 시 마커 값을 확장만 하면 되므로 확장성을 우선시한 차선책.

## Phase

### Phase 1 — Spec 갱신 (project-planner) ✅ 완료 (2026-05-16)

- [x] `spec/5-system/6-websocket-protocol.md` — §4.1 표 갱신, §4.4 JSON 예시 두 곳, 페이로드 필드표, §4.4.6 신규 절(ConversationTurnSource→source 매핑 표 포함), Rationale 신규 항목.
- [x] `spec/conventions/conversation-thread.md` — §5.1 보강 문단, §9 CHANGELOG 항목.
- [x] `spec/3-workflow-editor/3-execution.md` — §8.1 `execution.ai_message` 행 동기화.
- [x] `/consistency-check --spec` → `review/consistency/2026/05/16/09_42_54/SUMMARY.md` (BLOCK: NO, WARNING 1건 → §4.4.6 명확화 문장으로 해소).

### Phase 2 — Backend 구현 (developer) → conversation-turn-render plan 으로 이관 (2026-05-18)

> **2026-05-18 conversation-turn-render plan 으로 흡수**: 본 Phase 의 모든 backend 작업 (`mapTurnsToChatMessages` source 마커 부여, `processMultiTurnMessageInner` push 메시지에 마커, `buildConversationConfigFromOutput` 보존, information-extractor multi-turn 동일 적용, unit test) 은 `plan/in-progress/conversation-turn-render.md` 의 Phase 2 로 통합되어 worktree `conversation-turn-render-a8f3c1` 에서 진행한다. spec §1.5 정정 (2026-05-18) 후 prefix 가 `output.result.messages` 에도 영속됨이 명시 — backend 의 push/emit 경로가 spec 의도와 정합함을 conversation-turn-render Phase 2 가 검증한다.

- [x] `mapTurnsToChatMessages` 가 source: 'injected' 마커 부여 — conversation-turn-render Phase 2 에서 진행
- [x] `processMultiTurnMessageInner` push 메시지에 source: 'live' — conversation-turn-render Phase 2 에서 진행
- [x] `buildConversationConfigFromOutput` source 보존 — conversation-turn-render Phase 2 에서 진행
- [x] information-extractor multi-turn 동일 적용 — conversation-turn-render Phase 2 에서 진행
- [x] Unit test — conversation-turn-render Phase 2 에서 진행

### Phase 3 — Frontend 구현 (developer) → conversation-turn-render Phase 1 에서 완료 (2026-05-18)

> **2026-05-18 conversation-turn-render Phase 1 (frontend) 가 흡수 + 격상**: spec §9 정식 규약 (3중 신호: 아이콘 + 컨테이너 + chip 동시 적용) 채택으로 Phase 3 의 "isInjected chip 만 추가" 보다 강화된 source 별 시각 분기 (presentation_user → 회색 시스템 카드, system → 가운데 라인) 가 이미 구현·테스트 완료. 본 Phase 의 모든 frontend 작업이 conversation-turn-render Phase 1 commit 들에 포함됨.

- [x] `RawMessage.source` 필드 + `ConversationItem.isInjected` — conversation-turn-render Phase 1 commit b5ddb4d 에 포함
- [x] `messagesToConversationItems` source 처리 — 이미 적용 (turn 카운팅에서 injected user 제외)
- [x] `payload.messages[].source` 타입 — 이미 적용
- [x] `parseHistoryMessages` 일관 처리 — 이미 적용 + §9.5 strip 추가 적용 (spec 정정 후 의무)
- [x] Unit test — conversation-turn-render Phase 1 의 27건 (Phase 1 자체 16건 + ai-review fix 11건) 통과

### Phase 4 — UI 점검 & 코드 리뷰 → conversation-turn-render Phase 1 에서 완료 (2026-05-18)

> **2026-05-18 conversation-turn-render Phase 1 의 review/code/2026/05/18/12_56_01 세션 + RESOLUTION 으로 흡수**.

- [x] dev server 시나리오 재현 — e2e (playwright 37건) 통과로 갈음 (conversation-turn-render Phase 1)
- [x] `/ai-review` 실행 — `review/code/2026/05/18/12_56_01/SUMMARY.md` + RESOLUTION 처리 완료
- [x] CHANGELOG / README 영향 없음 확인 — RESOLUTION 의 W24 에서 "내부 미리보기 탭 한정, 사용자 노출 페이지 변경 없음" 결론

## 영향 범위 / Side Effects

- WebSocket 페이로드 shape 변경 (additive — `source` 필드 추가). 기존 client 가 이 필드를 무시해도 동작에는 영향 없음.
- `output.result.messages` 가 DB 에 영속화될 때 source 가 함께 저장되는지 결정 필요 — frontend 의 `parseHistoryMessages` 가 완료된 노드 복원 시에도 같은 변환을 거치므로 일관성 차원에서 영속화 권장. (옛 `output.messages` 표기는 D6 2026-05-17 로 `output.result.messages` 로 단일화됨, conversation-thread §4 영속화 표 참조.)
- Information Extractor multi-turn 도 동일 핸들러 패턴 → 함께 갱신.

## Follow-up (별도 PR)

- **UI: "injected context" 시각 구분** — **정식 spec 화 완료 (2026-05-18)**: chip 한 가지가 아니라 ① 아이콘 ② 컨테이너 형식 (bubble vs 회색 카드) ③ chip 의 3중 신호 동시 적용으로 격상. 또한 conversation Preview 의 1차 데이터 소스를 `conversationThread` snapshot 으로 교체해 emit messages 의 `[from <nodeLabel>]` prefix raw 노출 자체를 회피. 규약: [Spec Conversation Thread §9](../../spec/conventions/conversation-thread.md#9-미리보기-ui-렌더-규칙). 구현은 `plan/in-progress/conversation-turn-render.md` 에서 진행 (worktree `conversation-turn-render-a8f3c1`).

## Open Questions

- (Phase 3) injection 메시지를 UI conversation timeline 에 보여줄 것인지(현재 보여주고 있음) vs 숨길 것인지. **결정 완료 (2026-05-18)**: conversation Preview 의 1차 소스를 `conversationThread` snapshot 으로 교체 — emit messages 는 LLM debug 패널 전용으로 격리. presentation_user 등은 회색 시스템 카드로 격하 표시 ([Spec Conversation Thread §9.1](../../spec/conventions/conversation-thread.md#91-source-별-시각-매핑-강제)). 구현은 `plan/in-progress/conversation-turn-render.md` 에서 진행.
- (Phase 2) source 마커를 `output.messages` (DB 영속화) 까지 보존할 것인지. **잠정 결정**: 보존. parseHistoryMessages 도 같은 컨버터를 거치므로 일관성 확보 효과. spec §4.4.6 의 "필드 누락 시 `'live'` 로 간주" 폴백 규약이 있으므로 미보존도 동작 가능 — 영속 결정은 backend 구현 시점에 최종 확정.
- (참고) ai-agent-tool-connection-rewrite plan 에서 `tool_call` source 신설이 결정되면 §4.4.6 매핑 표의 `ai_tool` 항목이 정확히 동작하는지 재검증 필요 (consistency SUMMARY INFO #10).
- (참고) 향후 DB 컬럼 신설 plan (`Execution.conversation_thread jsonb`, conversation-thread §7 v2 로드맵) 작성 시 `output.messages[].source` 영속 정책을 명시 항목으로 포함 (consistency SUMMARY INFO #9).
