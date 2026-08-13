# Cross-Spec 일관성 검토 — spec-draft-eia-notification-payload-contract

## 발견사항

- **[CRITICAL]** Outbound HTTP webhook envelope 의 `payload` 래퍼가 target 개정안에 반영되지 않음 — 개정 후에도 실제 wire 와 다르다
  - target 위치: `plan/in-progress/spec-draft-eia-notification-payload-contract.md` §"무엇을 쓸 것인가" 1~3 (EIA §6.3/§6.4/§6.5 재작성 계획), 그리고 그 근거인 "실측 — 실제 emit" 표의 `fanout 봉투` 행
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md` §6.1(헤더/서명)·§6.2(webhook 전용 wire 라는 기존 caveat) 자체와, 실제 코드 `codebase/backend/src/modules/external-interaction/notification-fanout.service.ts:123-137` · `notification-webhook.processor.ts:120-260`(특히 L224 `const rawBody = JSON.stringify(eventBody)`, `notification-webhook.processor.spec.ts:391-403` 가 pass-through 를 명시적으로 단언) · `websocket.service.ts:453-489`(`emitExecutionEvent` 가 flat wire 를 만들고 그 flat 객체가 `ExecutionChannelEvent.payload` 로 들어감)
  - 상세: target 이 EIA §6.3~§6.5 에 쓰기로 한 JSON 은 여전히 `{ type, executionId, triggerId, workflowId, result, durationMs, timestamp, seq }` 형태로 `result`/`durationMs`/`error` 가 **최상위 형제 필드**다. 그러나 실제 outbound webhook 파이프라인(`NotificationFanout.handle` → `NotificationDispatcher.enqueue` → `NotificationWebhookProcessor.process`)이 만들어 그대로 `JSON.stringify`하는 body 는
    ```json
    { "type": "...", "executionId": "...", "triggerId": "...", "workflowId": "...", "seq": N, "timestamp": "...",
      "payload": { /* WS emitExecutionEvent 가 만든 flat 객체 그대로 — executionId/seq/timestamp/triggerId 중복 포함 */ } }
    ```
    로, 사건별 콘텐츠(`status`/`result`/`error`/`durationMs` 등)가 **`payload` 키 아래 한 단계 더 nest** 된다(`notification-fanout.service.ts` L128-136 의 `eventBody: {..., payload: event.payload, ...}`). 이 `payload` 래퍼 사실은 target 자신의 "실측" 표에 `fanout 봉투 | {type,executionId,triggerId,workflowId,seq,payload,timestamp} | notification-fanout.service.ts L123-137` 로 이미 기록돼 있는데도, "무엇을 쓸 것인가" 절의 개정안에는 반영되지 않았다. 결과적으로 target 을 그대로 적용해도 (developer 후속으로 `durationMs`/`result.outputs` 를 채운 뒤에도) 실제 webhook 수신자는 `body.result`/`body.durationMs` 를 여전히 찾지 못한다 — `body.payload.result`/`body.payload.durationMs` 에 있다. 이는 이 draft 가 고치려는 "문서화된 필드를 외부 고객이 `undefined` 로 받는다" 는 바로 그 결함을, 필드 존재 여부가 아니라 **컨테이너 깊이** 축에서 재생산한다.
    - 대조: 같은 파이프라인에서 SSE 스트림(`interaction-stream.controller.ts` `writeSseFrame` → `data: ${JSON.stringify(event.payload)}`)과 in-process `ChatChannelDispatcher`(`chat-channel.dispatcher.ts` L531-532 `result: (event.payload as {result?:unknown}).result ?? {}`)는 **둘 다 `event.payload` 를 flat 하게** 소비한다 — 이쪽은 target 개정안의 flat 구조와 실제로 합치한다. 즉 문제는 **HTTP `notification.url` webhook 배달 경로 한정**이며, `spec/5-system/14-external-interaction-api.md` §6 은 정확히 그 경로("## 6. API 명세 — Outbound Notification", §6.1 이 `POST <notification.url>` + HMAC 서명을 규정)를 문서화하는 절이다.
    - §6.2 blockquote(target 이 손대지 않는 절)가 이미 "SSE 는 raw fanout wire 그대로, webhook 은 notification envelope 재구성" 이라고 명시하는데, 실제로는 webhook 쪽이 `node`/`interaction`/`context` 재구성이 아니라 **`payload` 키로 한 단계 nest** 하는 것뿐이다 — §6.2 caveat 자체도 부정확하고, target 이 그 부정확한 전제 위에 §6.3~§6.5 를 개정하면서 같은 부정확함을 상속한다.
  - 제안: EIA §6.3~§6.5 JSON 예시를 `{ type, executionId, triggerId, workflowId, seq, timestamp, payload: { status, result?, error?, durationMs?, cancelledBy?, ... } }` 형태로(또는 실제 코드 쪽에서 `payload` 래핑을 제거하고 flat 하게 spread 하도록) 재정합해야 한다 — 어느 쪽을 SoT 로 할지 결정 필요(코드 변경 비용 vs 문서 정확성). target 의 `spec_impact` 에는 이미 EIA 파일이 있으므로 범위 추가 없이 처리 가능하지만, §6.2 blockquote 도 함께 수정 대상에 넣어야 §6 전체가 self-consistent 해진다.

- **[WARNING]** `spec/3-workflow-editor/3-execution.md` §8.1 의 WS 이벤트 요약표가 target 의 `spec_impact` 밖에 있고, 필드명 grep 으로도 걸리지 않아 이번 개정 후 더 벌어진다
  - target 위치: `spec_impact`(frontmatter) — `spec/5-system/14-external-interaction-api.md` / `6-websocket-protocol.md` / `conventions/chat-channel-adapter.md` 3개만 등재
  - 충돌 대상: `spec/3-workflow-editor/3-execution.md` §8.1 "WebSocket 이벤트 (클라이언트 ← 서버)" 표 — `| execution.completed | executionId, status, duration | ... |`, `| execution.failed | executionId, error | ... |`, `| execution.cancelled | executionId | ... |`
  - 상세: 이 표는 "상세 프로토콜은 [WebSocket 프로토콜 상세](../5-system/6-websocket-protocol.md) 참조" 라는 비-authoritative 요약이지만, 같은 이벤트 3종의 필드를 자체 서술한다. target 이 WS §4.1 에서 `duration`→`durationMs` 로 개명하고 `nodeCount`/`failedNodeId` 를 삭제/Planned 표기하며 `cancelled` 를 `result.cancelledBy` nested 로 바꾸는데, 이 파일은 갱신 대상에 없다. 원래도 `nodeCount`/`cancelledBy`/`failedNodeId` 를 생략한 대략적 요약이었지만, 이번 개정으로 SoT(`6-websocket-protocol.md`) 의 필드명이 바뀌면서(`duration`→`durationMs`) 이 파일의 `duration` 표기가 새로 stale 해진다. 1차 draft 가 반려된 사유("필드 전역 grep 으로 범위 재확정")와 같은 클래스의 갭이다 — 이번엔 이 파일이 `finalNodeId|finalPort|nodeCount|failedNodeId` 리터럴을 쓰지 않고 "노드 카운트"처럼 한국어로 풀어써서 grep 에 걸리지 않았다(project 기존 교훈: 필드명 리터럴 grep 은 표현이 다르면 놓친다).
  - 제안: `spec/3-workflow-editor/3-execution.md` §8.1 표의 `execution.completed`/`failed`/`cancelled` 행을 `durationMs` 로 맞추거나(최소), 표 상단에 "필드는 예시일 뿐 상세는 WS §4.1 참조" 식 비-authoritative 표기를 명시해 향후 drift 를 구조적으로 차단. `spec_impact` 에 추가할지, 비고 처리만 할지는 project-planner 판단.

- **[WARNING]** `conventions/chat-channel-adapter.md` 의 `EiaEvent.cancelled` variant · renderNode 소비 표(§3.x)가 `cancelledBy` 를 여전히 필수로 선언 — retry-turn 예외 캐비엇이 EIA §6.5 에만 적히고 이쪽엔 전파되지 않음
  - target 위치: target 문서 "무엇을 쓸 것인가" §3 ("그 캐비엇을 §6.5 에 적는다") · §4 ("`conventions/chat-channel-adapter.md` §1.2 3 variant 를 최종 결정과 맞춘다" — retry-turn 캐비엇 언급 없음) · 체크리스트 (`conventions/chat-channel-adapter.md §1.2 3 variant` 항목에 캐비엇 전파가 명시돼 있지 않음)
  - 충돌 대상: `spec/conventions/chat-channel-adapter.md` §1.2 `EiaEvent` union (`result: { cancelledBy: "user" | "system" | "timeout" }` — non-optional) 및 §3.x 소비 표 (`execution.cancelled | cancelledBy + error?.code | ...`)
  - 상세: target 자신의 실측 표가 `cancelled (예외) | { status } — cancelledBy 없음 | retry-turn.service.ts failRetryExecution L956` 를 이미 적시했다. 이 경로에서 실제 emit 은 `cancelledBy` 자체가 없다(§6.5 개정 후에도 이 경로는 캐비엇으로만 문서화되고 실제로 필드가 빠진 채 나간다). 그런데 chat-channel-adapter.md 의 `EiaEvent` 타입은 `result.cancelledBy` 를 항상 존재하는 필수 필드로 선언하고, §3.x 소비 표도 "`cancelledBy` + `error?.code`" 로 무조건 존재를 전제한다. §4 는 "R3 가 'EIA §6 이 SoT' 라 선언하므로 SoT 를 고치면 여기가 따라와야 한다" 는 원칙을 스스로 세워놓고, 정작 §6.5 에 새로 적을 이 특정 캐비엇은 전파 대상에서 빠져 있다 — draft 가 고치려는 "half-scope 반영" 결함과 같은 모양이 §4 안에서 재발할 위험.
  - 제안: `EiaEvent.cancelled` 의 `result` 를 `{ cancelledBy?: ... }` 로 optional 화하거나, `retry-turn-terminal-guard.md` W1 이 해소되기 전까지는 §1.2/§3.x 에도 "`failRetryExecution` 경로는 `cancelledBy` 부재" caveat 를 명시적으로 동기화. 최소한 체크리스트 항목에 "cancelledBy 캐비엇 전파 여부" 를 명시해 누락을 구조적으로 방지.

- **[INFO]** `durationMs` 통일이 같은 WS §4.1 표 안의 `execution.node.completed`(`duration`, Ms 없음)와의 명명 불일치를 새로 만들지는 않지만 해소도 하지 않음
  - target 위치: target "무엇을 쓸 것인가" §3 필드명 통일 항목 ("`durationMs` 로 통일한다")
  - 충돌 대상: `spec/5-system/6-websocket-protocol.md` §4.1 `execution.node.completed`(`{ executionId, nodeId, nodeExecutionId, nodeName, output, duration }` — Ms 없음) vs 같은 표의 `execution.ai_message`(이미 `durationMs?` 사용) vs `execution.tool_call_completed`(`durationMs`)
  - 상세: target 은 종결 3행(`completed`/`failed`/`cancelled`)만 `durationMs` 로 통일하기로 했고 이는 draft 범위상 타당하다. 다만 같은 §4.1 표 안에 `duration`(node-level)과 `durationMs`(top-level 종결 + ai_message + tool_call)가 계속 혼재하게 된다는 점은 문서 열람자에게 여전히 혼선을 준다. draft 범위 밖이라 blocking 은 아니지만 후속 정리 후보로 기록할 가치가 있다.
  - 제안: 이번 draft 범위에 넣지 않아도 무방. 원한다면 target 의 "비목표" 절에 "`execution.node.completed`/`.node.*` 의 `duration` 명명은 범위 밖(별도 후속)" 을 한 줄 명시해 향후 재지적을 예방.

## 요약

Target 초안은 자체 필드-이름 grep 재조사로 `finalNodeId`/`finalPort`/`nodeCount`/`failedNodeId` 등 개별 필드의 존재 여부 불일치는 견고하게 다잡았고, EIA/WS/chat-channel-adapter 3파일에 걸친 종결 이벤트 필드 목록도 대체로 정합하게 개정한다. 그러나 이번 조사에서 더 근본적인 구조적 결함 하나를 확인했다 — target 이 개정하는 EIA §6.3~§6.5 JSON 예시는 실제 outbound HTTP webhook 배달 파이프라인(`NotificationFanout`→`NotificationDispatcher`→`NotificationWebhookProcessor`)이 만드는 wire body 와 여전히 다르다. 실제 body 는 사건별 콘텐츠를 `payload` 키 아래 한 단계 더 감싸는데, target 은 이를 flat 구조로 유지한다 — target 자신의 실측 표가 이 `payload` 래퍼 존재를 이미 적어두었음에도 개정안에 반영하지 못했다. 이는 이 draft 가 두 차례 반려된 것과 동일한 "half-scope" 패턴(필드 존재 축은 고쳤지만 컨테이너 깊이 축은 놓침)이며, 그대로 채택하면 외부 webhook 고객은 개정 후에도 문서화된 필드를 찾지 못한다. 그 외에 `spec/3-workflow-editor/3-execution.md` 의 자체 요약표가 이번 개명(`duration`→`durationMs`)으로 추가 drift 되는 점, `conventions/chat-channel-adapter.md` 의 `cancelledBy` 비-optional 선언이 retry-turn 예외 캐비엇을 흡수하지 못하는 점이 WARNING 급으로 남아 있다.

## 위험도

HIGH
