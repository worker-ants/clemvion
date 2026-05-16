---
worktree: ai-thread-source-mark-7c4f2a
started: 2026-05-16
owner: planner → developer
---

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

### Phase 2 — Backend 구현 (developer)

- [ ] `backend/src/nodes/ai/ai-agent/ai-agent.handler.ts`
  - `mapTurnsToChatMessages` 가 반환하는 메시지에 `source: 'injected'` 부여 (ChatMessage 타입 확장 필요).
  - `processMultiTurnMessageInner` 가 push 하는 사용자/어시스턴트/툴 메시지에 `source: 'live'` 부여.
  - `executeMultiTurn` (single-turn 의 첫 진입) 의 system message 도 emit 대상이 아니므로 마커 부여는 옵션 — 일관성을 위해 system 에도 `'live'` 부여 검토.
- [ ] `backend/src/nodes/ai/information-extractor/information-extractor.handler.ts`
  - multi-turn 모드 처리 경로에 동일 마커 부여 (스펙 일관성).
- [ ] `backend/src/modules/execution-engine/execution-engine.service.ts`
  - `buildConversationConfigFromOutput` 가 `messages` 를 필터링할 때 `source` 필드를 그대로 통과시키도록 확인 (현재는 spread 이므로 자동 통과되겠지만, 타입 시그니처 보강).
  - `handleAiMessageTurn` 의 `ai_message` emit 분기 (waiting/terminal 둘 다) 에서 `condMessages` 가 source 를 보존하도록 확인.
- [ ] `backend/src/shared/conversation-thread/thread-renderer.ts` 등 messages 모드 매핑 코드 위치 확인 후 동일 적용.
- [ ] Unit test:
  - `ai-agent.handler.spec.ts`: injection 이 있는 multi-turn 케이스에서 emit 되는 messages 각 항목의 `source` 값 검증.
  - `execution-engine.service.spec.ts`: `buildConversationConfigFromOutput` 의 source 보존 확인.
- [ ] `/consistency-check --impl-prep` 후 구현 착수.

### Phase 3 — Frontend 구현 (developer)

- [ ] `frontend/src/lib/conversation/conversation-utils.ts`
  - `RawMessage` 타입에 `source?: 'live' | 'injected'` 필드 추가.
  - `messagesToConversationItems` 의 user 분기에서 `msg.source === 'injected'` 이면 `currentTurn++` 를 건너뛰고 별도 item 으로만 push (또는 push 자체 생략 — UI 표시 정책은 추가 결정 필요).
- [ ] `frontend/src/lib/websocket/use-execution-events.ts`
  - `payload.messages[]` 타입에 `source` 필드 추가.
  - `convConfig.messages` 동일 처리.
- [ ] `frontend/src/lib/stores/execution-store.ts`
  - `ConversationItem` 에 `isInjected?: boolean` (또는 동등) 마커 추가 검토 — UI 가 inspector 에서 injection chip 등을 구분 표시할 수 있도록.
- [ ] `frontend/src/components/editor/run-results/conversation-utils.ts` (`parseHistoryMessages`) — DB 에서 복원한 완료 노드의 messages 에도 source 가 들어있도록 backend 의 `output.messages` 영속화 형태도 확인 + 일관 처리.
- [ ] Unit test:
  - `conversation-utils.test.ts` (또는 신규): injection user 메시지가 turn 카운팅에서 제외되는지 회귀 테스트.
  - assistant 메시지가 backend `turnCount` 와 같은 `turnIndex` 를 얻는지 검증.

### Phase 4 — UI 점검 & 코드 리뷰

- [ ] dev server 띄워 시나리오 재현 (Template → AI Agent 워크플로우) — Response/Request/LLM Usage 탭이 정상 동작 확인.
- [ ] `/ai-review` 실행 → `review/code/<...>/SUMMARY.md` 검토.
- [ ] CHANGELOG / README 영향 없음 확인.

## 영향 범위 / Side Effects

- WebSocket 페이로드 shape 변경 (additive — `source` 필드 추가). 기존 client 가 이 필드를 무시해도 동작에는 영향 없음.
- `output.messages` 가 DB 에 영속화될 때 source 가 함께 저장되는지 결정 필요 — frontend 의 `parseHistoryMessages` 가 완료된 노드 복원 시에도 같은 변환을 거치므로 일관성 차원에서 영속화 권장.
- Information Extractor multi-turn 도 동일 핸들러 패턴 → 함께 갱신.

## Open Questions

- (Phase 3) injection 메시지를 UI conversation timeline 에 보여줄 것인지(현재 보여주고 있음) vs 숨길 것인지. **잠정 결정**: 보여주되 turn 카운팅에서만 제외. inspector 에서 chip 으로 구분 표시는 추후 결정.
- (Phase 2) source 마커를 `output.messages` (DB 영속화) 까지 보존할 것인지. **잠정 결정**: 보존. parseHistoryMessages 도 같은 컨버터를 거치므로 일관성 확보 효과. spec §4.4.6 의 "필드 누락 시 `'live'` 로 간주" 폴백 규약이 있으므로 미보존도 동작 가능 — 영속 결정은 backend 구현 시점에 최종 확정.
- (참고) ai-agent-tool-connection-rewrite plan 에서 `tool_call` source 신설이 결정되면 §4.4.6 매핑 표의 `ai_tool` 항목이 정확히 동작하는지 재검증 필요 (consistency SUMMARY INFO #10).
- (참고) 향후 DB 컬럼 신설 plan (`Execution.conversation_thread jsonb`, conversation-thread §7 v2 로드맵) 작성 시 `output.messages[].source` 영속 정책을 명시 항목으로 포함 (consistency SUMMARY INFO #9).
