# Cross-Spec 일관성 검토 — spec/5-system/ (impl-done, diff-base origin/main)

## 검토 범위

diff-base `origin/main`(=f5351e9c2) 대비 target 브랜치가 변경한 spec 파일:
- `spec/5-system/6-websocket-protocol.md` (§4.1 execution/node emit 값-패턴 마스킹 신설, `nodeName`→`nodeLabel` 정정)
- `spec/5-system/14-external-interaction-api.md` (§R17 잔여 ①·② 해소 — WS emit 값-마스킹 + `outputData` 내부 REST 마스킹, `inputData` 는 의도적 비대상)
- `spec/5-system/12-webhook.md` (§5.3 스코프 caveat 추가)

대응 코드: `codebase/backend/src/modules/websocket/websocket.service.ts`(`maskWireEnvelope`/`toFanoutEnvelope` 신설, emit 초크포인트), `shared/utils/sanitize-error-message.ts`(`deepRedactSecretsPreserving`, 마커 상수), `shared/utils/redact-stored-error.ts`(`redactStoredDataForResponse`), `modules/executions/executions.service.ts`, `modules/executions/background-runs/background-runs.service.ts`. 코드-spec 정합은 확인됨(별도 언급 없는 한 일치).

---

## 발견사항

- **[CRITICAL] `execution.node.completed` emit 값-패턴 마스킹이 `15-chat-channel.md` CCH-MP-06 의 "template 은 `output.rendered` 텍스트 그대로" 명시적 verbatim 계약을 깬다**
  - target 위치: `spec/5-system/6-websocket-protocol.md` §4.1 표 아래 "값-패턴 마스킹 (강제됨 — 결정 2026-08-16)" 캐비엇(대표 예시로 `output`/`input`(node.completed) 명시) · `spec/5-system/14-external-interaction-api.md` §R17 "`execution.node.*` / 비-종결 `execution.*` emit 의 자유 텍스트 값" 신설 불릿 ("대상은 필드명 불문 **payload 전체**").
  - 충돌 대상: `spec/5-system/15-chat-channel.md` §3 CCH-MP-06(라인 81, **필수** 항목) — "비-blocking presentation 노드(`template` body, …)의 `execution.node.completed` → 채널 메시지로 변환 … **`template` 은 `output.rendered` 텍스트 그대로**." 이 파일은 본 PR 이 건드리지 않았다(diff에 없음).
  - 상세: `WebsocketService.emitNodeEvent`(및 `emitExecutionEvent`)는 `maskWireEnvelope`로 wire envelope 를 마스킹한 뒤, 그 **마스킹된** envelope 를 그대로 `toFanoutEnvelope`에 넘겨 `executionEventSubject.next(...)`(=`executionEvents$`)로 publish한다(코드: `websocket.service.ts` L258-420 부근). `ChatChannelDispatcher`는 `onModuleInit`에서 정확히 이 `executionEvents$`를 구독하고(`chat-channel.dispatcher.ts` L68-82), `execution.node.completed` 케이스에서 `p.output`을 **가공 없이** `output` 필드로 통과시켜(`chat-channel.dispatcher.ts` L591-627, 주석에 "CCH-AD-07 / CCH-MP-06 / R-CCA-7" 명시) 렌더러로 넘긴다. 즉 `template` 노드의 `output.rendered`(일반 문자열)는 마스킹 관문을 **이미 통과한 뒤** CCH-MP-06 경로에 도달한다.
    `SECRET_LEAK_PATTERNS`(`sanitize-error-message.ts`)의 패턴 중 `/"?\bsecret"?\s*[=:]\s*(?:"[^"]*"|[^\s&'"]+)/gi` 는 매우 넓어("secret" 단어 + `:`/`=` 다음 토큰 전부 매치), 워크플로 작성자가 정상적으로 작성한 템플릿 문구(예: "The secret: always ask twice", "Authorization: 담당자에게 문의") 조차 `***`로 치환될 수 있다. 이는 CCH-MP-06 이 명시적으로 보장하는 "그대로" 를 조용히 깨고, 텔레그램/슬랙/디스코드로 나가는 실제 사용자 메시지 내용을 손상시킬 수 있다 — `inputData` 재제출 오염(§R17 잔여②, 이번 PR 이 이미 CRITICAL 로 인지·처리한 문제)과 **같은 클래스의 결함**이 이번엔 template 표시 출력 쪽에 새로 생겼다.
    보강 근거: `plan/in-progress/spec-draft-eia-fanout-masking.md`(이번 변경의 설계 draft)는 "`execution.node.completed` 만 Chat Channel 이 추가 구독" 이라는 **도달 범위**는 인지했지만, CCH-MP-06 의 verbatim 계약과의 충돌은 어디에도 언급되지 않는다(grep 0건) — 즉 알려진/수용된 트레이드오프가 아니라 검토 누락이다.
  - 제안: 다음 중 하나로 target 또는 `15-chat-channel.md`를 갱신해 정합화할 것.
    (a) CCH-MP-06 문구에 "값-패턴 마스킹이 적용된 이후의 값" caveat 를 추가하고 "그대로" 를 "마스킹 이후 값 그대로"로 좁힌다(다른 §R17 잔여 항목들과 같은 패턴).
    (b) `execution.node.completed`/`execution.ai_message` 의 presentation 관련 필드(`output`/`presentations`)를 `WIRE_PRESERVED_FIELDS`/fanout 마스킹 대상에서 제외(carve-out)하고 그 근거를 Rationale 에 남긴다(단, 이 경우 §R17 "payload 전체" 원칙과의 예외 사유를 명시해야 함 — `llmCalls` strip-only 예외와 유사한 구조).
    두 경우 모두 `spec/conventions/chat-channel-adapter.md` §1.3/§3 도 함께 확인.

- **[WARNING] 같은 마스킹이 carousel/table/chart 의 chat-channel 표시물과 AI `render_*` presentations(CCH-MP-01)에도 미치는 영향이 target 문서에 별도로 다뤄지지 않았다**
  - target 위치: 위와 동일(§4.1 캐비엇 / §R17 신설 불릿) — "부작용(수용)" 문단은 "워크플로가 정당하게 자격증명을 다루면 emit·읽기 표면에서 `***` 로 보인다"는 일반론만 서술.
  - 충돌 대상: `spec/5-system/15-chat-channel.md` CCH-MP-06(carousel/table/chart 의 `uiMapping.visualNode` 분기 입력도 같은 `output`), CCH-MP-01(AI `render_*` 의 `presentations[]` — `execution.ai_message.presentations` 도 §4.1 "payload 전체" 대상이라 같은 마스킹을 받음) · `spec/7-channel-web-chat/0-architecture.md` L82 "SSE 스트림은 내부 fanout envelope 를 그대로 전송한다"(웹챗 위젯도 같은 마스킹된 값을 받음).
  - 상세: CCH-MP-06 처럼 명시적 "그대로" 문구는 없지만, 이 표면들도 최종적으로 **실제 채널/위젯 사용자에게 보이는 콘텐츠**이므로 동일한 false-positive 마스킹 위험을 안는다. target 의 "부작용(수용)" 서술은 "에디터/내부 뷰어" 관점에 가깝게 쓰여 있어(§4.1 캐비엇의 "boundary masking parity" 논거가 workspace 멤버 대상 REST 대칭에 초점), 외부 최종 사용자(챗봇 대화 상대)에게 미치는 영향까지 의도적으로 검토·수용했는지 문서상 확인되지 않는다.
  - 제안: 위 CRITICAL 항목 해결 시 함께 정리. 최소한 §4.1/§R17 에 "chat-channel 최종 사용자에게도 동일하게 보인다"는 caveat 한 줄을 추가해, 향후 독자가 "내부 전용 리스크"로 오독하지 않게 한다.

- **[INFO] `spec/5-system/3-error-handling.md` §2.2 예시가 여전히 `nodeName` 필드를 쓴다 (target 이 WS 이벤트 표는 `nodeLabel` 로 정정했으나 이 파일은 미동기화)**
  - target 위치: `spec/5-system/6-websocket-protocol.md` §4.1 표 — 이번 PR 이 `node.started`/`completed`/`failed`/`skipped` 4행을 `nodeName`→`nodeLabel` 로 정정(실측 기반, 정당한 수정).
  - 충돌 대상: `spec/5-system/3-error-handling.md` L249 "실행 에러 형식" JSON 예시의 `"nodeName": "AI Agent"`.
  - 상세: 두 문서는 서로 다른 표면(WS 이벤트 payload vs REST 실행 에러 형식)을 기술하고 있어 직접 충돌은 아니지만, 같은 개념(노드 표시명)에 대해 필드명이 갈려 있다. 이번 PR 범위 밖에서 이미 존재하던 drift이고 target 자체가 새로 만든 문제는 아니다.
  - 제안: 우선순위 낮음 — 별도 spec-sync 항목으로 추적 권장(이번 PR 필수 아님).

---

## 요약

target 의 핵심 변경(WS emit 값-패턴 마스킹 신설 + 내부 REST `outputData` 마스킹 확장)은 데이터 모델·API 계약·요구사항 ID·RBAC·계층 책임 관점에서 관련 코드(`websocket.service.ts`, `redact-stored-error.ts`, `executions.service.ts`, `background-runs.service.ts`)와 정확히 일치하고, `inputData` 비대상 결정도 두 spec 파일(`12-webhook.md`/`14-external-interaction-api.md`) 사이에서 일관되게 서술되어 있다. 다만 이번 마스킹 초크포인트가 `WebsocketService.executionEvents$` 라는 **단일 sink**를 통해 `SseAdapter`/`NotificationFanout` 뿐 아니라 `ChatChannelDispatcher`(in-process 형제 subscriber)에도 그대로 적용되는데, target 은 이 파급을 "도달 범위" 열거에서만 언급했을 뿐 `spec/5-system/15-chat-channel.md` CCH-MP-06 이 이미 규정한 "template 출력은 그대로 전달" 이라는 **명시적 verbatim 계약**과의 충돌을 검토하지 않았다. 코드 추적으로 확인한 결과 이 경로는 실제로 마스킹된 값을 그대로 chat-channel 렌더러에 전달하므로, 정상적인 워크플로 콘텐츠가 실제 외부 채널(Telegram/Slack/Discord) 사용자에게 `***` 로 왜곡되어 도달할 수 있는 미검토 회귀다. 나머지 항목은 사소한 pre-existing drift(INFO) 수준이다.

## 위험도

CRITICAL
