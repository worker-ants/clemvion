# 신규 식별자 충돌 검토 — spec-draft-webchat-crossref-ws-wire-drift

## 검토 대상
`plan/in-progress/spec-draft-webchat-crossref-ws-wire-drift.md` (spec draft, `--spec` 모드)
편집 대상: `spec/3-workflow-editor/4-ai-assistant.md` §3.2 · `spec/5-system/6-websocket-protocol.md §4.4` ·
`spec/5-system/14-external-interaction-api.md §6.2` · `spec/7-channel-web-chat/0-architecture.md §3`

## 사전 확인 사항
본 draft 는 **신규 엔티티/ID/endpoint/이벤트/env var/신규 spec 파일을 도입하지 않는다.** 4건의 편집 모두
기존 spec 문서에 cross-reference 링크와 caveat blockquote 를 추가/정정하는 순수 편집이며, 언급되는
필드명(`waitingNodeId`, `waitingNodeType`, `waitingNodeLabel`, `nodeExecutionId`, `nodeOutput`,
`formConfig`/`buttonConfig`/`conversationConfig`, `conversationThread`)은 이미 코드에 존재하고
(`form-interaction.service.ts:121-122`, `button-interaction.service.ts:408-409`,
`ai-turn-orchestrator.service.ts:452-453`, `chat-channel.dispatcher.ts:418-462`) 이미 spec 다른 곳
(`EIA §6.2` line 464/586, `spec/conventions/conversation-thread.md` 다수, `spec/4-nodes/3-ai/1-ai-agent.md:1191`,
`spec/conventions/swagger.md:362`)에서 동일 의미로 사용 중이다. 즉 "새 식별자 도입"이 아니라 "이미 존재하는
식별자를 새 문서 위치에 인용"하는 작업이다.

### 링크 앵커 검증 (참고, 충돌 아님)
- 편집 1 의 `4-security.md#11-마크다운html-sanitize-정책-매트릭스` → 실제 heading `### 1.1 마크다운/HTML sanitize 정책 매트릭스` (line 45) 와 GitHub-slug 규칙상 정확히 일치.
- 편집 2 의 `14-external-interaction-api.md#62-페이로드--executionwaiting_for_input` → 실제 heading `### 6.2 페이로드 — \`execution.waiting_for_input\`` (line 550) 과 일치.
- 편집 3 의 `6-websocket-protocol.md#44-사용자-입력-대기-이벤트-상세-executionwaiting_for_input` → 실제 heading (line 378) 과 일치.
- `safe-html.ts` / `markdown-renderer.tsx` 는 draft 가 새로 지어낸 이름이 아니라 이미 `4-security.md` §1.1 매트릭스(line 51-54)에 등재된 실제 코드 파일명 그대로.

## 발견사항

- **[INFO]** `waitingNodeLabel`/`waitingNodeType` 신규 문서화와 동일 파일 내 기존 `nodeLabel`/`nodeType` 필드의 근접
  - target 신규 식별자: 편집 2 caveat 가 `spec/5-system/6-websocket-protocol.md §4.4` 에 `waitingNodeType`/`waitingNodeLabel` 을 처음으로 문서화(코드에는 이미 존재, 문서화가 처음일 뿐)
  - 기존 사용처: 같은 파일 §4.1 이벤트 목록 표에 `execution.node.started`(`nodeType`, line 182)·`execution.node.cancelled`(`nodeLabel`, line 186)가 이미 있고, 바로 아래 line 187 에 "`nodeName` vs `nodeLabel` drift" 라는 **별도의** spec-drift 각주가 이미 존재한다.
  - 상세: `waitingNodeType`/`waitingNodeLabel` 은 `waiting_for_input` 전용 접두 필드로 `execution.node.*` 계열의 범용 `nodeType`/`nodeLabel` 과 이름은 비슷하지만 프로토콜 구조(top-level flat 필드, ✕ nested 여부)가 다르다. 의미는 유사(노드 타입/라벨)해 겹쳐도 실질 충돌은 아니며, draft 편집 2 원문도 "+`waitingNodeType`/`waitingNodeLabel`/`nodeExecutionId`" 로 병기해 sibling 필드임을 명확히 하고 있어 즉각적인 혼선 위험은 낮다.
  - 제안: 별도 조치 불요(현재 draft 문구로 충분히 명확). 다만 향후 같은 파일에 `nodeName`/`nodeLabel` drift 각주(line 187)를 손볼 일이 생기면 `waitingNodeLabel` 이 그 각주 대상이 아님(별도 이벤트의 별도 필드)을 한 줄 명시하면 더 견고해진다 — 이번 draft 범위에서 강제할 사항은 아님.

- **[INFO]** plan 파일 경로 명명 컨벤션 일치 (충돌 없음, 확인 결과 기록)
  - target 신규 식별자: `plan/in-progress/spec-draft-webchat-crossref-ws-wire-drift.md`
  - 기존 사용처: `plan/complete/spec-draft-webchat-truncation-total-count.md`, `plan/complete/spec-draft-webchat-en-i18n.md`, `plan/complete/spec-draft-webchat-execution-residuals.md` 등 동일 `spec-draft-webchat-*` 계열이 이미 존재.
  - 상세: 파일명 자체는 중복되지 않고 기존 명명 패턴(용도 요약 접미사)을 그대로 따른다. `plan/complete/fix-webchat-sse-field-map.md`(완료, 2026-06-06)·`plan/complete/spec-fix-webchat-eia-drift.md`(완료, 2026-07-11)와 주제가 인접하지만 각각 D-1/D-2/D-3(별개 3건 drift) 또는 위젯 코드 수정(SSE 파서)이라 본 draft(WARNING #1·#2, cross-ref + WS/EIA caveat)와 다루는 대상이 겹치지 않는다.
  - 제안: 조치 불요.

CRITICAL/WARNING 등급에 해당하는 발견사항은 없음.

## 요약
본 draft 는 신규 요구사항 ID·엔티티·API endpoint·이벤트명·환경변수·spec 파일을 전혀 새로 도입하지 않으며, 언급하는 모든 필드명(`waitingNodeId`/`waitingNodeType`/`waitingNodeLabel`/`nodeExecutionId`/`nodeOutput` 등)은 이미 코드와 다른 spec 문서(EIA §6.2, conversation-thread.md, ai-agent.md, swagger.md)에서 동일 의미로 정착되어 있는 식별자를 4곳의 기존 문서에 cross-reference/caveat 형태로 옮겨 적는 순수 편집 작업이다. 링크 앵커도 실제 heading 과 정확히 일치함을 확인했다. 유일하게 눈에 띄는 점은 같은 WS 프로토콜 문서 안에 이미 존재하는 범용 `nodeType`/`nodeLabel` 필드와, 이번에 처음 문서화되는 `waitingNodeType`/`waitingNodeLabel` 필드가 이름 유사성을 가진다는 것인데, 접두사로 구분되고 draft 문구도 sibling 관계를 명확히 병기해 실질적 혼선 위험은 낮아 INFO 수준에 그친다.

## 위험도
NONE
