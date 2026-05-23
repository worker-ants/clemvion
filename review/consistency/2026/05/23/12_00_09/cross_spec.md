# Cross-Spec 일관성 — `ButtonDef.userMessage` 신설 + `render_*` user message 합성 규칙

## 결론
**위험도: NONE / INFO 1건** — 다른 영역 spec 의 데이터 모델·API·요구사항·상태 전이와 충돌 없음.

## 점검 매트릭스

| 관점 | 결과 | 근거 |
|---|---|---|
| 1. 데이터 모델 충돌 | NONE | `ButtonDef` 는 `spec/4-nodes/6-presentation/0-common.md §1` 의 유일 정의. 다른 영역에 동명 엔티티 없음. 신규 필드 `userMessage` 는 옵션 (`✗ 필수`) 이라 기존 페이로드 호환. backend `_shared/button.types.ts` (SSOT 상수 `MAX_BUTTONS_PER_NODE`) 도 필드 cap 만 정의 — 필드 목록은 schema 가 단일 진실. |
| 2. API 계약 충돌 | NONE | `userMessage` 는 신규 옵션 필드라 WS payload (`waiting_for_input.buttonConfig`, `execution.click_button` 명령) shape 에 추가만 됨. `spec/5-system/6-websocket-protocol.md §4.4` 의 `buttonConfig` 구조와 호환 (옵션 필드 신설은 protocol level breaking 아님). REST endpoint 영향 없음 (그래프 form/button 클릭은 WS 전용). |
| 3. 요구사항 ID 충돌 | NONE | 본 작업은 신규 ID 부여 없음 — §1 ButtonDef 표에 1행 추가 + §9 CHANGELOG 1줄. |
| 4. 상태 전이 충돌 | NONE | `userMessage` 는 텍스트 합성에만 영향. presentation 노드 본체의 blocking state machine (`waiting_for_input → resumed`, §3) 미사용 (AI Agent `render_*` 의 클릭은 frontend 가 `onSendMessage` 로 ai_user 메시지를 chat input 에 흘려보내는 별개 경로 — `spec/4-nodes/3-ai/1-ai-agent.md §4.1` 본문 "다음 LLM turn 의 user 메시지로 흡수" 가 SoT). |
| 5. 권한·RBAC 충돌 | NONE | RBAC 변경 없음. |
| 6. 계층 책임 충돌 | INFO 1 | render_* 클릭 user-message 합성 책임이 **frontend** (`AssistantPresentationsBlock.handlePortButtonClick`) 에 있음. backend `renderInteractionText` (`thread-renderer.ts`, `presentation_user` source 한정) 와는 별개 경로. plan 의 (3) (ai-agent.md cross-ref) 가 이 경계를 명문화하면 4-layer SSOT (spec §1 / 합성 규칙 §X / frontend / backend schema) 가 합의됨. |

## 영향받지 않는 cross-cutting spec (확인 완료)

- `spec/conventions/conversation-thread.md` §1.4 / §1.6 — `text` 변환 규칙 (`clicked: <buttonLabel>`) + LLM-facing marker (`[user-input]`) 는 **graph presentation 노드 본체 → backend `renderInteractionText` → `presentation_user` source** 경로 한정. `render_*` AI tool 클릭은 frontend `onSendMessage` → ai_user 메시지로 chat input 에 흘러가는 경로 (§1.4 비고 "ai_user 는 marker wrap 적용 안 함"). 본 작업 변경과 직교.
- `spec/conventions/node-output.md §4.5` `interaction.data` payload 규격 — graph 노드의 `output.interaction` 전용. `render_*` 클릭은 다음 LLM turn user 메시지로 흡수되어 `output.interaction` 발화 자체가 없음 (`spec/4-nodes/3-ai/1-ai-agent.md §4.1` SoT). 충돌 없음.
- `spec/5-system/4-execution-engine.md §1.3` — 블로킹/재개 컨트랙트는 graph 노드 본체 한정. `render_*` 는 AI Agent 내부 dispatcher 가 처리. 충돌 없음.
- `spec/5-system/6-websocket-protocol.md §4.4` — `buttonConfig` 의 옵션 필드 신설로 protocol 호환.

## INFO 사항

- **INFO-1 (계층 책임 명문화)**: ai-agent.md §4.1 의 cross-ref 1줄 추가로 "render_* 의 user-message 합성은 frontend 책임이며 합성 규칙은 Presentation 공통 §X SoT" 를 명시하면 사후 drift 차단 — plan (3) 항목에 이미 명시되어 있어 추가 조치 불필요.

## STATUS
ISSUES=1 (INFO 1, CRITICAL/WARNING 0)
