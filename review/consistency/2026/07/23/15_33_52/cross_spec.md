# Cross-Spec 일관성 검토 — spec/4-nodes/6-presentation

## 검토 방법

target(`spec/4-nodes/6-presentation/0-common.md` §1~§10.9 + Rationale, `1-carousel.md`, `2-table.md` 일부)이 명시적으로 교차 참조하는 다른 영역 spec 을 실제 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/resumable-handler-generic-typing-3918dd`)에서 직접 열람해 대조했다: `spec/1-data-model.md`(§2.14 NodeExecution), `spec/conventions/node-output.md`(§4.5), `spec/conventions/interaction-type-registry.md`, `spec/conventions/conversation-thread.md`(§1.2), `spec/5-system/6-websocket-protocol.md`(§4.2/§4.4), `spec/5-system/4-execution-engine.md`(§7.4/§7.5/§7.5.1/§9.3), `spec/5-system/14-external-interaction-api.md`, `spec/4-nodes/3-ai/1-ai-agent.md`(§4.1/§6.2/§7.4/§12.4~§12.7). 대부분 항목(WS `submit_form` payload shape, `presentations[]` vs `data?` 분리, `data.via` sentinel, `WaitingInteractionType` 4값, EIA 409 `STATE_MISMATCH` 매핑, §7.5.1 표면 매트릭스, `pendingFormToolCall` 1:1 invariant 등)은 **정확히 일치**했다. 아래는 불일치가 확인된 항목만 기록한다.

## 발견사항

- **[WARNING]** Continuation Bus 메시지 타입 개수 불일치 (5종 vs 실제 6종, `retry_last_turn` 누락)
  - target 위치: `0-common.md` §10.9 본문("`processAiResumeTurn` dispatch 4 케이스 명시 매칭" 절 직전 단락) · Rationale "form submission wire format wrap" 절("왜 internal bus layer 한정") · §10.9 "4-layer SSOT 정렬" 목록(마지막 항목)
  - 충돌 대상: `spec/5-system/4-execution-engine.md` §7.4 "Continuation Bus" 표(라인 893) 및 §9.3 큐 목록(라인 1162)
  - 상세: target 은 세 곳에서 동일하게 "Continuation Bus 메시지 타입 **5종** (`continue / cancel / button_click / ai_message / ai_end_conversation`) 표는 **변경 없음**" 이라고 명시한다. 그러나 execution-engine.md 는 §7.4 표에서 "메시지 타입 | `continue` / `cancel` / `button_click` / `ai_message` / `ai_end_conversation` / `retry_last_turn` (`ContinuationType`, ...)" 로 **6종**을 정의하고, §9.3 에서도 "메시지 타입 **6종** ... `retry_last_turn` (§7.4)" 로 재확인한다. `retry_last_turn` 은 이미 별도 spec 절(§1.1/§1.3, WS §4.2 `execution.retry_last_turn`)로 확립된 기존 기능이며 이번 target 작업 이전부터 존재했다. 즉 target 의 "5종/변경 없음" 서술은 현재 SoT 와 직접 모순되는 stale 한 카운트다. 기능적으로는 `retry_last_turn` 이 WAITING 이 아닌 spawn 된 RUNNING row 대상이라 `processAiResumeTurn` 의 `action.type` 매칭 경로(§10.9 표)와 겹치지 않는 것으로 보이나(별도 `RetryTurnService`/`_retryState` seed 경로), target 문서가 세 번 반복해서 "5종" 을 단언하고 있어 향후 편집자가 이 표를 신뢰해 `retry_last_turn` 존재를 놓치거나, 반대로 "6종으로 고쳐야 한다"며 실제로는 무관한 §10.9 dispatch 로직에 `retry_last_turn` 을 잘못 편입시킬 위험이 있다.
  - 제안: target §10.9 본문·Rationale·"4-layer SSOT 정렬" 세 곳 모두 "5종" → "6종" 으로 정정하고, `retry_last_turn` 은 WAITING 대상이 아니라 `processAiResumeTurn` dispatch 범위 밖임을 한 줄 명시("본 절의 4-case 매칭은 `retry_last_turn` 을 다루지 않는다 — 별도 `RetryTurnService` 경로") 해 혼동을 원천 차단.

- **[WARNING]** Rationale 절이 재개 dispatch 함수를 `processAiResumeTurn` 대신 `waitForAiConversation` 으로 잘못 지칭 + "loop 재진입" 표현이 full B3 아키텍처와 불일치
  - target 위치: `0-common.md` Rationale "form submission wire format wrap" 절의 소제목 "**`waitForAiConversation` dispatch 의 graceful degradation**" 및 해당 단락("미매칭 케이스... 처리는 silent skip 이 아닌 warn log + loop 재진입")
  - 충돌 대상: (a) target 자신의 §10.9 본문("`processAiResumeTurn` dispatch 4 케이스 명시 매칭" 표, 마지막 행 "그 외... warn log + 현 turn **no-op park**") (b) `spec/5-system/4-execution-engine.md` — PR-B2a/B2b 서술("`waitForAiConversation('release')`(첫 turn park) + `processAiResumeTurn`(재개 시 단발 turn 처리 + re-park)"), full B3 서술("`runAiConversationLoop` 장수 루프... **완전 제거(full B3)**", "재개는 §7.5 rehydration 단일 경로로 일원화")
  - 상세: execution-engine.md 는 `waitForAiConversation`(최초 진입/park) 과 `processAiResumeTurn`(재개 turn 처리기)을 명확히 별개 함수로 구분하며, target 의 §10.9 본문도 이 구분을 정확히 따라 dispatch 표를 `processAiResumeTurn` 명의로 서술한다. 그런데 같은 문서의 Rationale 절은 **동일한 degradation 동작**을 설명하면서 함수명을 `waitForAiConversation` 으로 바꿔 부르고, "loop 재진입"이라는 표현을 쓴다. execution-engine.md 는 in-process 장수 루프(`runAiConversationLoop`)가 full B3 에서 완전 제거되었고 매 재개가 rehydration 을 통한 단발 turn 처리(park=세그먼트 종료)라고 명시적으로 서술하므로, "loop 재진입"이라는 프레이밍은 이 아키텍처와 어긋난다(§10.9 본문 자신도 "> 재개 모델 (full B3): ... 코루틴을 즉시 해제(park=세그먼트 종료)... 위 graceful degradation(`else` 분기 = warn + 현 turn **no-op park**)도 이 rehydration 모델 기준이다"라고 정확히 서술하고 있어 Rationale 과 본문이 같은 문서 안에서 서로 다른 모델을 전제한다).
  - 제안: Rationale 절의 소제목·본문에서 `waitForAiConversation` → `processAiResumeTurn` 으로 정정하고 "loop 재진입" → "no-op park(재파킹)" 등 본문·execution-engine.md 와 일관된 표현으로 통일.

- **[INFO]** `output.interaction.type` "4값 중" 언급이 3값만 나열해 다소 혼란
  - target 위치: `0-common.md` §10.9 layer 표 (3)행 — "`'form_submitted'` enum 값 (`button_click` / `button_continue` / `form_submitted` **4값 중 하나**)"
  - 충돌 대상: `spec/conventions/node-output.md` §4.5 (`output.interaction.type` 실제 enum: `"form_submitted" | "button_click" | "button_continue" | "message_received"`, 4값)
  - 상세: 카운트("4값") 자체는 node-output.md 와 일치하나, 괄호 안에는 presentation 관련 3값만 나열되고 4번째 값인 `message_received`(AI Agent 일반 채팅용, `ai-agent.md` §6.2/§7.5 에서 사용)는 생략되어 있다. presentation 문서 스코프상 의도적 생략으로 보이나 "4값 중 하나"라는 표현과 나열된 개수(3개)가 불일치해 독자가 혼란을 겪을 수 있다.
  - 제안: "(presentation 관련 3값 — 나머지 1값 `message_received` 는 AI Agent 일반 채팅 전용, [AI Agent §7.5](../3-ai/1-ai-agent.md#75-multi-turn-모드--사용자-메시지-수신-status-resumed-transient) 참조)" 등으로 스코프를 명시하거나 "4값 중" 표현을 제거.

## 요약

target(`spec/4-nodes/6-presentation` §1~§10.9)이 교차 참조하는 대부분의 다른 영역 spec — 데이터 모델(`NodeExecution.interaction_data` 3값 enum), node-output 컨벤션(`output.interaction` 규격·`data.via` sentinel), interaction-type-registry(`WaitingInteractionType` 4값), conversation-thread(`presentations[]` 필드 분리), WebSocket 프로토콜(`submit_form` payload shape), EIA(`409 STATE_MISMATCH` 매핑), AI Agent spec(§4.1/§6.2/§7.4/§12.4~§12.7 각 절 존재·내용) — 와는 정확히 정합했다. 다만 execution-engine.md §7.4/§9.3 의 Continuation Bus 메시지 타입이 실제로는 6종(`retry_last_turn` 포함)임에도 target 이 세 곳에서 반복적으로 "5종·변경 없음"이라 잘못 단언하는 점, 그리고 Rationale 절이 재개 dispatch 함수를 본문과 다른 이름(`waitForAiConversation`)·다른 아키텍처 모델("loop 재진입")로 서술해 execution-engine.md 의 full B3(park=세그먼트 종료, 루프 완전 제거) 서술과 어긋나는 점은 실제 코드 동작에 영향을 주지는 않을 것으로 보이나 문서 SoT 로서의 정확성을 해치므로 반드시 정정이 필요하다.

## 위험도

MEDIUM
