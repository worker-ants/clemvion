# Security Review — conversation_thread 공개 표면 secret 마스킹 (HEAD 748d3813d)

리뷰 대상: `git show HEAD` — EIA `getStatus`(REST) + SSE `waiting_for_input` 의 `conversationThread` egress 마스킹 도입.

## 발견사항

### [CRITICAL] `execution.ai_message` 이벤트는 동일 turn 텍스트를 마스킹 없이 그대로 공개 노출 — SSE stream + 아웃바운드 webhook + chat-channel(Telegram 등) 3개 경로 전부

- 위치:
  - `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:723-745` (multi-turn 진행 중 `AI_MESSAGE` emit, `message: nextConv.message`, `messages: nextConv.messages`)
  - `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:842-865` (턴 종료 `AI_MESSAGE` emit, `message: responseText`, `messages: condMessages`)
  - `codebase/backend/src/modules/external-interaction/sse-adapter.service.ts:196-225` (`handleEvent` — `websocketService.executionEvents$` 를 이벤트 타입 필터 없이 그대로 buffer+fanout)
  - `codebase/backend/src/modules/external-interaction/interaction-stream.controller.ts:110-140` (`writeSseFrame` — `event.payload` 를 그대로 `JSON.stringify` 해 SSE `data:` 로 write, 필드 단위 필터 없음)
  - `codebase/backend/src/modules/external-interaction/notification-fanout.service.ts:28` (`FANOUT_EVENTS` 에 `'execution.ai_message'` 포함 — 아웃바운드 webhook 화이트리스트 5종 중 하나, `spec/5-system/14-external-interaction-api.md:55`)
  - `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:495-520` (`toChatChannelEvent` — `event.payload.message` 를 그대로 `message` 필드로 전달, 어댑터가 이를 텔레그램 등 외부 채널에 실제로 발송)

- 상세: 이번 커밋은 `redactThreadForPublic`/`redactSecrets` 를 REST `getStatus` 와 SSE `waiting_for_input` 두 emit 경로에만 적용했다. 그러나 **동일한 AI turn 텍스트**(assistant 응답 전체, `newResult.response` / `nextConv.message` — 곧 `conversationThread.turns[]` 에 append 될 그 텍스트 자체)가 완전히 별도의 공개 이벤트 `execution.ai_message` 로도 emit 된다. 이 이벤트는
  1. `spec/5-system/14-external-interaction-api.md:55`(EIA-NX-02) 에 명시된 아웃바운드 webhook 화이트리스트 5종 중 하나이고,
  2. `GET /api/external/executions/:id/stream` SSE 스트림은 `websocketService.executionEvents$` 를 이벤트 타입 필터 없이 그대로 client 에 전달하므로(`sse-adapter.service.ts` + `interaction-stream.controller.ts`) 별도 구독 설정 없이 항상 흘러가며,
  3. Chat Channel 어댑터가 `message` 필드를 그대로 텔레그램 등 외부 대화 채널에 **능동 발송**한다(수신자가 별도로 pull 하지 않아도 즉시 도달).

  `emitExecutionEvent` 내부의 기존 방어(`sanitizePayloadForWs` / `CREDENTIAL_KEY_PATTERN`, `websocket.service.ts:224-283`)는 **키 이름** 기반 마스킹(`password`/`token`/`secret`/... 키 매치 시 값 전체를 `[REDACTED]`)이라, `message`/`messages` 처럼 값 자체(자유 텍스트) 안에 `Bearer sk-...` 같은 시크릿-형 문자열이 섞여 들어간 경우를 잡지 못한다. 이는 정확히 이번 커밋이 `SECRET_LEAK_PATTERNS`(값-내용 정규식 매칭)로 새로 막으려던 시나리오다.

  실패 시나리오: 노드 핸들러(또는 handler 가 그대로 echo 하는 업스트림 API 에러/응답, 커밋 메시지가 언급한 "provider errors occasionally echo back tokens" 케이스, 혹은 prompt injection 으로 LLM 이 이전 컨텍스트의 시크릿을 되풀이하는 케이스)가 turn 텍스트에 API 키/Bearer 토큰을 남기면:
  - `getStatus`/`waiting_for_input.conversationThread` 는 이제 마스킹되어 안전하지만,
  - 같은 turn 이 완료되는 순간 발사되는 `execution.ai_message` 는 SSE stream 으로 즉시 평문 유출되고, 워크스페이스가 outbound webhook 또는 Chat Channel(텔레그램 등)을 구독해 두었다면 시크릿이 **외부 서드파티 플랫폼에 자동 전달**된다.

  spec 변경분(`spec/5-system/14-external-interaction-api.md`, `spec/conventions/conversation-thread.md`)도 이 갭을 인지하지 못하고 있다 — 문서화된 잔여 항목은 "outputData/nodeOutput 키 allowlist" 와 "DB-at-rest 최소화(append-time redaction)" 뿐이며, `execution.ai_message` 우회 경로는 언급이 없다. 즉 의도적으로 수용된 리스크가 아니라 커버리지 누락이다.

- 제안: `redactSecrets`(또는 그 상위 helper)를 `ai-turn-orchestrator.service.ts` 의 두 `AI_MESSAGE` emit 지점의 `message`/`messages[].content` 필드에도 적용. `messages` 는 배열이므로 각 원소의 텍스트 필드를 순회 마스킹하는 별도 헬퍼(예: `redactMessagesForPublic`)가 필요할 수 있다. 근본적으로는 `emitExecutionEvent`/`emitNodeEvent` fanout 경계(즉 `websocket.service.ts` 의 `stripExternalOnlyFields` 인접 지점, 모든 공개 egress 가 공통으로 거치는 단일 seam) 에서 알려진 자유 텍스트 필드(`message`, `messages[].content`, `conversationThread` 등)를 일괄 스크럽하는 편이, 매 emit 호출부마다 개별 패치하는 현재 방식보다 "새 emit 추가 시 또 빠뜨리는" 재발을 구조적으로 막는다.

### [INFO] 패턴 커버리지의 구조적 한계 (기존 SoT 상속, 이번 diff 신규 아님)

- 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:20-29` (`SECRET_LEAK_PATTERNS`)
- 상세: `Bearer ...` / `key=value` 형태의 키워드-인접 시크릿만 매칭한다. 다음은 이번 SoT 로는 잡히지 않는다: (a) 키워드 없이 단독으로 등장하는 raw JWT(`eyJ...`)나 AWS access key(`AKIA...`), (b) `Cookie:` / `X-Api-Key:` 헤더 스타일(`Authorization:` 만 커버), (c) 공백 없는 `key="value"` 조합은 커버되나 멀티라인 JSON pretty-print 안의 값은 케이스에 따라 놓칠 수 있음. 다만 이는 프로젝트 SoT(`SECRET_LEAK_PATTERNS`)의 기존 한계를 그대로 재사용한 결과이며, 사용자 메모리 규약("새로 구현 금지, 특수 케이스만 얇게 추가")과 정합하는 선택이라 이번 diff 자체의 결함으로 보지 않는다. 다만 위 CRITICAL 항목과 별개로, "완전한 방어"라는 인상을 주지 않도록 spec 문서에 이 정규식 기반 마스킹의 best-effort 한계를 한 줄 명시하면 좋다.

### [INFO] egress-only 설계(내부 경로 raw 유지)는 근거가 명확하고 문서화 충분

- 위치: `codebase/backend/src/shared/conversation-thread/thread-renderer.ts:23-40` (JSDoc), `execution-engine.service.ts:7574`(durable park commit), `execution-engine.service.ts:6514-6526`(Background job snapshot)
- 상세: durable DB 컬럼(`Execution.conversation_thread`)과 LLM 컨텍스트 주입 경로는 의도적으로 raw 유지 — "보수적 `Bearer\s+\S+` 패턴이 정상 대화 prose 를 오탐해 LLM 컨텍스트를 조용히 손상시킬 위험"이라는 근거가 타당하고, spec 양쪽 문서(`14-external-interaction-api.md` §R17, `conventions/conversation-thread.md`)에 잔여 항목으로 명확히 기록되어 있다. DB 컬럼 자체는 별도 공개 컨트롤러로 노출되지 않음을 확인했다(`grep conversationThread codebase/backend/src/modules/executions` — entity 정의 외 매치 없음). 문제 없음.

### [INFO] `redactThreadForPublic` copy-on-change 구현 정확성

- 위치: `codebase/backend/src/shared/conversation-thread/thread-renderer.ts:42-68`
- 상세: `text === turn.text` / `args === tc.arguments` 는 문자열 값 비교(원시타입이라 참조가 아닌 내용 비교)라 안전하고, `toolCalls.some((tc, i) => tc !== turn.toolCalls?.[i])` 는 객체 참조 비교로 올바른 copy-on-change다. 입력 미변형(새 tests `thread-renderer.spec.ts` "does not mutate the input thread or its turns" 로 검증됨). `redactSecrets` 의 `g`-flag 정규식 재사용은 `String.prototype.replace` 가 매 호출 시 `lastIndex` 를 사용하지 않는(stateless) 사실과 정합해 안전하다는 JSDoc 설명도 정확하다. 로직 결함 없음.

### 마스킹되지 않는 구조화 필드(`turns[].data`, `presentations[]`)

- 위치: `codebase/backend/src/shared/conversation-thread/conversation-thread.types.ts:134-154`
- 상세: 지시사항대로 문서화된 non-goal(구조화 데이터는 스캔 대상 아님)이며, 이번 리뷰에서 이 필드들을 통한 현실적인 시크릿 유출 경로(즉 이 필드에 handler 가 raw 토큰을 실제로 담는 기존 코드)는 발견하지 못했다. 별도 지적 없음.

## 요약

이번 커밋은 `getStatus`(REST)·SSE `waiting_for_input` 두 경로에 한해 `conversationThread` 의 turn 텍스트/toolCall 인자/runningSummary 를 견고하게 마스킹하며, 해당 두 경로 자체의 구현(copy-on-change, 미변형, 테스트 커버리지)은 정확하다. 그러나 커밋이 표방하는 "공개 EIA 표면에서 turn 텍스트 secret 을 런타임 강제로 막는다"는 목표는 **`execution.ai_message` 이벤트를 통해 완전히 우회 가능**하다 — 같은 턴의 동일한 텍스트가 SSE stream, 아웃바운드 webhook, Chat Channel(텔레그램 등 외부 발송)까지 세 경로 모두 마스킹 없이 그대로 흘러간다. 이는 spec 문서에도 인지되지 않은 커버리지 누락으로, 이번 하드닝의 실질적 보안 효과를 크게 제한한다. 나머지(egress-only 내부 경로 유지, 패턴 SoT 재사용, 구현 정확성)는 적절하다.

## 위험도

**HIGH** — 신규 도입한 방어 자체에는 결함이 없으나, 동일 공개 표면 안의 인접 이벤트(`execution.ai_message`, 아웃바운드 webhook 화이트리스트 5종 중 하나이자 SSE 무필터 통과)가 방어를 완전히 우회하므로 "공개 표면 secret 유출 방지"라는 커밋의 핵심 목표가 부분적으로만 달성됨. CRITICAL 급 시나리오(외부 서드파티 채널로 시크릿 자동 발송)가 가능하나, 발동 전제(handler 가 실제로 turn 텍스트에 시크릿을 남기는 선행 결함)가 필요해 조건부이므로 CRITICAL 이 아닌 HIGH 로 평가.
