STATUS=success cross_spec review complete — 0 critical, 1 warning, 2 info
===REPORT_MARKDOWN_BELOW===
### 발견사항

- **[WARNING]** B4 의 remediation target(`websocket.service.ts`) 이 `code:` 소유권 시맨틱과 어긋나고, 더 명백한 갭을 놓친다
  - target 위치: `plan/in-progress/planner-doc-batch.md` B4 행("`conversation-thread.md` frontmatter `code:` 에 `websocket.service.ts` 누락 | **0건**") 및 체크리스트 "B4 `conversation-thread.md` frontmatter `code:`"
  - 충돌 대상: `spec/conventions/spec-impl-evidence.md` §2.1 (`code:` 필드 정의 — "본 spec 이 약속한 surface 의 구현 경로") · `codebase/backend/src/modules/websocket/websocket.service.ts` (실측) · `codebase/backend/src/modules/execution-engine/{execution-engine,ai-turn-orchestrator,form-interaction,button-interaction}.service.ts` (실측)
  - 상세: B4 는 "`conversation-thread.md` 의 `code:` 목록에 `websocket.service.ts` 가 없다"는 사실(0건)은 정확하다. 그러나 실제로 `websocket.service.ts` 를 grep 하면 `conversationThread`/`live`/`source`/`messages` 관련 도메인 로직이 **전무**하다 — 이 파일은 일반 Socket.IO emit sink 이고, 그 사실은 이미 `websocket-protocol.md`·`external-interaction-api.md` 의 `code:` 에 정확히 반영돼 있다(전송 레이어 SoT 는 그 두 문서). 반면 `execution-engine.service.ts`(`rehydrateConversationThread` 호출, park 스냅샷 복원), `ai-turn-orchestrator.service.ts`(`redactThreadForPublic`, park 시 commit), `form-interaction.service.ts`/`button-interaction.service.ts`(동일 `redactThreadForPublic` + `conversationThreadService.appendPresentationInteraction`) 는 conversation-thread 도메인 로직을 직접 구현하면서도 **넷 다 `conversation-thread.md` 의 `code:` 에 없다**. `spec-impl-evidence.md` §2.1 의 `code:` 정의("본 spec 이 약속한 surface 의 구현 경로")를 그대로 적용하면, `websocket.service.ts` 를 추가하는 것은 그 시맨틱에 맞지 않고(로직 0건인 passthrough), 정작 시맨틱에 맞는 네 파일은 그대로 누락 상태로 남는다.
  - 제안: B4 범위를 "`websocket.service.ts` 1건 추가"에서 "conversation-thread 도메인 로직을 실제로 갖는 파일 전수 재조사"로 넓힌다. 최소한 위 4개 execution-engine 파일을 포함 여부 판정에 넣고, `websocket.service.ts` 는 (전송 레이어 문서에 이미 등재돼 있다는 이유로) 제외하거나 포함 근거를 별도로 남긴다.

### 요약

target(`plan/in-progress/planner-doc-batch.md`) 는 문서 내용을 직접 바꾸지 않는 **판정용 plan** 이라, 다른 spec 영역과 즉시 충돌하는 데이터 모델·API 계약·상태 전이·RBAC 항목은 없다. 오히려 B1·B2·B3·B5·B6·B7 의 "재판정" 수치(0건/1건/1회 등)를 실제 파일(`spec/conventions/node-output.md` Principle 0, `spec/conventions/egress-masking.md` §2, `spec/5-system/6-websocket-protocol.md` §3.2/§4.4, `spec/conventions/chat-channel-adapter.md`, `codebase/backend/.../{discord,slack,telegram}-message.renderer.ts` 의 `extractRendered`)로 직접 대조 검증한 결과 전부 정확했다 — 특히 B7 의 wire/domain 층 구분(`output.rendered` vs `output.output.rendered`) 은 이미 `node-output.md` Principle 0(2026-08-24 신설)·WS §4.1-a·EIA §R17 세 곳에 동일하게 서술돼 있어 target 의 판정 프레임과 일치한다. 유일한 리스크는 B4 가 지목한 remediation 대상 파일이 이 저장소 자체의 `code:` 소유권 관례와 어긋나고 더 명백한 후보들을 가린다는 점이며, 이는 CRITICAL 이 아니라 착수 시점에 바로잡을 수 있는 WARNING 이다. 참고로 이번 검토 payload(`_prompts/cross_spec.md`)는 `--spec` 예산 절단으로 target 이 직접 지목한 `spec/conventions/{node-output,egress-masking,chat-channel-adapter,conversation-thread}.md` 4개 본문을 전혀 싣지 못했다(placeholder 조차 없음) — 알려진 반복 이슈(`feedback_consistency_spec_mode_budget`)라 이번엔 저장소 파일을 직접 읽어 우회했지만, 이 review agent 가 번들만 신뢰했다면 B1~B7 검증 자체가 불가능했을 것이다.

### 위험도
LOW
