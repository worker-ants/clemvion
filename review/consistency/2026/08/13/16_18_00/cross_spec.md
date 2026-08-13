# Cross-Spec 일관성 검토 — spec-draft-eia-notification-payload-contract

## 발견사항

- **[CRITICAL]** "두 wire 는 실제로 다르다" 전제가 실제로는 **세 wire** 다 — SSE 를 webhook 과 잘못 합쳤다
  - target 위치: target 문서 `## 두 wire 는 실제로 다르다 — 이걸 먼저 못 박는다` 절 (표: `WS` vs `fanout → webhook/SSE`), 그리고 이를 그대로 반영하는 `## 결정` (2) `EIA §6 도입부 — webhook/SSE 봉투: {type, executionId, triggerId, workflowId, seq, timestamp, payload:{…}}`
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md` §6.2 자체의 기존 blockquote (line 615-623):
    > "**SSE 스트림 wire 형태 주의**: 위 형태는 **outbound notification(webhook)** payload 다. **SSE 스트림**(`GET /api/external/executions/:id/stream`, §5.2)은 notification envelope 재구성 없이 execution-engine 의 fanout wire 를 그대로 전송하므로 필드명이 다르다…"
  - 상세: target 은 코드 근거로 `websocket.service.ts` `emitExecutionEvent`(L453-489, `executionEventSubject.next({...payload: fanoutEnvelope})`)와 `notification-fanout.service.ts`(L123-137, webhook body 를 `{type, executionId, triggerId, workflowId, seq, payload: event.payload, timestamp}` 로 **wrap**)만 인용해 "fanout → webhook/SSE" 를 **한 shape** 으로 묶었다. 그러나 실제 SSE 송신 코드(`interaction-stream.controller.ts` `writeSseFrame`, L159-169)는 `data: ${JSON.stringify(event.payload)}` 로 **`event.payload`(= flat `fanoutEnvelope`)를 그대로** 쓴다 — webhook 처럼 `{type, triggerId, workflowId, seq, timestamp, payload:{...}}` 로 **재-wrap 하지 않는다**. 즉:
    - WS: `{executionId, ...spread, seq, timestamp}` (flat, `type`/`triggerId`/`workflowId` 없음)
    - **SSE**: `{executionId, ...spread(result/error/cancelledBy 등), seq, timestamp, triggerId, workflowId}` (flat, `type` 없음 — SSE `event:` 라인이 대신함, `payload` 로 재-wrap 되지 않음)
    - **webhook**: `{type, executionId, triggerId, workflowId, seq, timestamp, payload: {...SSE 와 동일한 flat 객체...}}` (webhook 만 이중 wrap)
    target 이 SSE 를 webhook 과 같은 그룹으로 묶어 §6 도입부에 "webhook/SSE 봉투"로 서술하면, **같은 파일 안에서** §6.2 가 이미 명시한 "SSE 는 notification envelope 재구성 없이 fanout wire 를 그대로 보낸다"는 사실과 직접 모순된다. 이 draft 가 고치려는 원래 CRITICAL("문서화된 payload 가 실제와 다르다")을 **§6.3~§6.5·§5.2 관계에서 새로 재현**하는 셈이다.
  - 제안: "두 wire" 표를 "**세 wire**"(WS flat / SSE flat / webhook wrapped)로 정정하고, (2)의 "봉투는 채널별로 각 한 번만" 을 3분기로 다시 쓴다. §6.2 가 이미 쓴 caveat 패턴(notification 추상 JSON + "SSE 는 재구성 없이 fanout wire 그대로" blockquote)을 §6.3~§6.5 에도 그대로 적용하는 편이 안전 — §6 도입부의 "공유 필드 집합" 은 논리 구조로 유지하고, "webhook 은 이걸 `payload` 키로 wrap, SSE 는 이 flat 객체를 그대로 전송(+ `triggerId`/`workflowId` 부가, `type` 은 SSE `event:` 라인이 대신)" 두 갈래로 명시해야 한다. §5.2 도 이 정정에 맞춰 "이벤트 종류" 문단(§6 이벤트 페이로드 = fanout flat 객체, 디버깅 이벤트 = WS §4.1/§4.4 그대로)을 한 줄 caveat 로 명확화하는 편이 좋다.

- **[WARNING]** `chat-channel-adapter.md` §1.2 의 hard-coded 줄 번호 참조가 이미 stale
  - target 위치: 체크리스트 `chat-channel-adapter.md §1.2 → 참조로 축약` (target 이 이 블록을 직접 편집할 예정)
  - 충돌 대상: `spec/conventions/chat-channel-adapter.md` §1.2 `EiaEvent` union 내 `execution.ai_message` variant 주석 — `[EIA §6.5 line 536]`
  - 상세: 현재 `spec/5-system/14-external-interaction-api.md` 의 line 536 은 §6.5 가 아니라 §5.4/§5.5 근방(`410`/`400`/`401` 관련 refresh-token 서술, `> **410 은 미존재도 포함한다**…`)이다 — §6.5 는 실제로 line 675 부근. 최근 EIA 파일에 다른 편집(예: §5.5 401→410/400 정정, PR #1149)이 들어가며 줄 번호가 drift 된 것으로 보인다. target 의 §1.2 축약 편집에서 이 죽은 줄-번호 인용을 그대로 들고 가면(참조 축약 후에도) 잘못된 위치를 계속 가리키게 된다.
  - 제안: §1.2 를 참조로 축약할 때 이 `line 536` 인용을 절 번호만으로 교체(`[EIA §6.5](../5-system/14-external-interaction-api.md#65-...)` )하거나 제거한다. 일반적으로 spec 간 상호참조에 소스 줄 번호를 하드코딩하지 않는 편이 이런 drift 를 구조적으로 막는다.

- **[INFO]** `finalNodeId`/`finalPort` 삭제가 `4-nodes/3-ai/3-information-extractor.md §3.2` 와의 cross-reference 를 없앤다
  - target 위치: `## 결정` (1) 표의 `~~finalNodeId·finalPort·nodeCount·failedNodeId~~` 삭제 항목
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md` §6.3 현재 서술의 `finalPort` enum 값 중 `"completed"` 에 대한 주석("Information Extractor multi-turn 의 정상 종료 포트 (Spec 4-nodes/3-ai/3-information-extractor §3.2)")
  - 상세: 검토해 보니 `4-nodes/3-ai/3-information-extractor.md` §3.2 는 노드 레벨 출력 포트(`out`/`completed`/`user_ended`/`max_turns`/`error`)를 독립적으로 정의하고 있어 EIA 의 workflow-레벨 `finalPort` 필드가 삭제되어도 그 문서 자체는 깨지지 않는다 — 진짜 충돌은 아니다. 다만 삭제 시 그 cross-reference 문장도 함께 사라지므로, "IE 의 멀티턴 종료 포트가 workflow 종결 이벤트로 어떻게 노출되는가"에 대한 유일한 연결 고리가 없어진다는 점만 기록해 둔다(설계상 문제 아님, 정보 손실 인지용).

## 요약

target 은 재넘버링 회피·헤딩 보존·N-곳 동기화 → 단일화 구조 전환이라는 전략 자체는 이 저장소의 기존 SoT 패턴(`redis-keys.md`, WS §4.4 PR #945, chat-channel-adapter R3)과 잘 정합하고, `--spec` 4회 반려 이력에 대한 대응도 근거가 탄탄하다. 그러나 이번 라운드의 핵심 전제인 "WS 대 (webhook+SSE)" 2-wire 구도가 코드 실측(`interaction-stream.controller.ts` `writeSseFrame`)과 어긋난다 — SSE 는 webhook 처럼 `payload` 로 재-wrap 되지 않고 fanout flat 객체를 그대로 내보내며, 이는 EIA 자신의 §6.2 blockquote 가 `execution.waiting_for_input` 에 대해 이미 명시한 패턴과 동일하다. 이 draft 가 그 구분을 종결 이벤트에는 적용하지 않고 §6 도입부에 "webhook/SSE 공용 wrapped 봉투"로 못 박으면, 고치려던 것과 같은 종류의 "문서가 실제와 다르다" 결함을 §6.3~§6.5 대 §5.2 사이에 새로 만든다. 이 CRITICAL 을 반영해 3-wire 구도로 재정정하면 나머지 구조(단일 필드 집합·포인터화·헤딩 불변)는 그대로 유효하다.

## 위험도
CRITICAL
