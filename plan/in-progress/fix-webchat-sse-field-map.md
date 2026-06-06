---
worktree: fix-webchat-sse-field-map-22cd94
started: 2026-06-06
owner: developer
spec_impact:
  - spec/7-channel-web-chat/0-architecture.md
---

# 웹챗 위젯 SSE 이벤트 필드 매핑 불일치 수정

> 작성일: 2026-06-06

## 배경 / 증상

봉투 언랩 수정(PR #490) 후 SSE 는 정상 개시됨. 그러나 `submit_message` 시
백엔드가 `INVALID_COMMAND: nodeId is required` 반환. 어시스턴트 답변도 빈 문자열.

## 근본 원인

위젯 SSE 파서가 EIA **notification(§6.2) 형태**(`node.id`/`context.*`/ai_message `text`)
기준으로 작성됐으나, 실제 **SSE 스트림은 WS wire 형태**(프론트엔드가 이미 소비하는 형태)를
그대로 전송한다 (sse-adapter 가 fanout envelope 를 raw 로 write). 백엔드 wire 형태가 SoT
(프론트엔드도 `waitingNodeId` 읽음) → **위젯을 백엔드에 맞춰 수정**.

| 위젯 (틀림) | 실제 SSE wire (SoT) |
| --- | --- |
| `ev.node?.id` | `ev.waitingNodeId` |
| `ev.node?.interactionType` | `ev.interactionType` (top-level) |
| `ev.context?.conversationConfig` | `ev.nodeOutput.conversationConfig` (ai) |
| `ev.context?.buttonConfig` | `ev.buttonConfig` (buttons, `.buttons` 포함) |
| `ev.context?.formConfig` | `ev.nodeOutput`(form) |
| `ev.context?.conversationThread` | `ev.conversationThread` (top-level) |
| ai_message `ev.text` | `ev.message` |

## 결정

- 백엔드 wire 형태 SoT 불변, 위젯 파서 수정.
- spec drift: web-chat `0-architecture §3` 표가 EIA §6.2(notification) 를 가리켜 오도 →
  SSE wire 필드명 note 추가 (project-planner). WS §4.4 / EIA §6.2 의 `nodeId` vs `waitingNodeId`
  drift 는 더 광범위 — 본 PR 에선 web-chat note + 플래그만.

## 체크리스트

- [x] consistency-check --impl-prep — `review/consistency/2026/06/06/10_38_21/` BLOCK: NO
- [x] 테스트 선작성 (eia-events.test.ts — 실제 wire 캡처 fixture)
- [x] eia-types: WaitingForInputEvent/AiMessageEvent wire shape 교정 + eia-events.ts 순수 헬퍼 추출
- [x] use-widget: WAITING(waitingNodeId/interactionType/nodeOutput/conversationThread) + ai_message(message) 매핑
- [x] (spec) 0-architecture §3 SSE wire 필드 note (commit c51deebd)
- [x] TEST WORKFLOW — lint ✓ / unit ✓(169) / build ✓ / e2e ✓(174)
- [x] /ai-review + SUMMARY — `review/code/2026/06/06/10_49_03/` LOW, Critical 0/Warning 3 → resolution-applier 처리 + RESOLUTION.md
- [x] SPEC-DRIFT(EIA §6.2/§6.5 SSE wire note) — resolution-applier ESCALATE=spec → 본 plan 에서 spec 적용(§6.2 waiting_for_input·§6.5 ai_message wire 필드 note). 적용 후 draft(`spec-update-eia-sse-wire-fields.md`) 제거.
- [x] consistency-check --impl-done — `review/consistency/2026/06/06/11_05_09/` **BLOCK: NO** (Critical 0; WARNING 8 전부 비차단). W-2(ev.text 잔존) grep 확인 clear.
- [ ] plan complete 이동 — 아래 비차단 followup 잔여로 in-progress 유지

## 비차단 followup (impl-done WARNING — 차단 아님)

- **EIA §6.2 drift (W-1/I-1)**: §6.2 abstract jsonc 블록은 notification 형태 유지 + SSE wire note 추가로 보완함. 추상 블록 자체를 wire 로 교체하는 정식 EIA 이슈는 backlog.
- **이중 SoT 문구 (W-4)**: EIA §6.2/§6.5 의 "참조 구현(SoT)" 가 web-chat eia-events.ts 를 가리킴 — 소유 영역(web-chat) 명확화 문구 다듬기. 후순위.
- **14 `code:` frontmatter (W-3)**: eia-events.ts 는 web-chat 코드라 7-channel-web-chat `code:` glob 에 이미 포함 — EIA(backend) spec 의 `code:` 에 추가하지 않음(잘못된 evidence claim 회피). 비조치.
- **AiMessageEvent.nodeId 주석 (W-8)**: InteractCommand.nodeId(waiting node)와 의미 구분 주석 — 코드 변경이라 별도 사이클 유발, 비차단이라 보류.
- **rebase 공존 (W-5/6/7)**: `spec-sync-audit` 브랜치 + 4개 worktree 가 동일 spec/`eia-types.ts` 병렬 수정 — 본 변경 결함 아님. 머지 순서에 따라 rebase 시 §3/§6.2/§6.5·`eia-types` 영역 재확인(두 변경 의미 독립이라 모두 보존).
