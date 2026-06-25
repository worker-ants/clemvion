---
title: 웹채팅 위젯 — AI 에이전트 render_* presentation(PresentationPayload) 렌더 버그 수정
worktree: web-chat-ai-presentation-render-beb2be
started: 2026-06-25
owner: developer
status: in-progress
related_spec:
  - spec/7-channel-web-chat/1-widget-app.md
  - spec/4-nodes/3-ai/1-ai-agent.md
related_plans:
  - plan/complete/web-chat-preview-improvements.md
---

# 배경

라이브 미리보기에서 **AI 에이전트가 `render_carousel` 등 표현도구**를 쓰면 위젯에 카루셀이 **렌더되지 않음**
(AI 가 "카루셀로 보여드렸습니다" 라고 하지만 정작 표시 없음). 사용자 제공 SSE wire 캡처로 root cause 확정.

## Root cause (코드/wire 확정)

위젯이 받는 presentation 은 **두 shape** 가 섞임:
1. **standalone presentation 노드**(`execution.message`/`waiting_for_input`): `{ config, output }` flat envelope → 위젯 OK.
2. **AI `render_*` 도구**(`ai_message.presentations[]`): `PresentationPayload { type, toolCallId, renderedAt, payload }`
   — 데이터가 `.payload` 에 중첩, top-level 에 config/output 없음.

위젯 `classifyPresentation`(`codebase/channel-web-chat/src/lib/presentation.ts:108`)은 `env.config`/`env.output` 만
읽어 → PresentationPayload 는 config={}/output={} 로 보고 **null 반환 → `PresentationBlock` default → 미렌더**.
spec(7-channel-web-chat/1-widget-app §2 "presentation … `ai_message.presentations[]` 전체 타입 inline 렌더",
AI Agent §7.10)상 위젯은 이를 렌더해야 함 → **spec 미충족 버그**. (chat-channel 텔레그램은 `renderPresentationPayload`
로 `.type`+`.payload` 이미 처리 — 위젯만 누락.)

버튼 클릭은 기존 `clickButton(id)`→`click_button{nodeId:pending.nodeId, buttonId}` 로 동작(AI 노드가
ai_message 직후 waiting_for_input 진입 → pending.nodeId 세팅, 백엔드가 buttonId→userMessage resolve). 즉
위젯은 **렌더만** 수정하면 되고 `userMessage` 는 위젯 불필요.

# 수정 (widget-only, 백엔드 정규화 X — 계약이 PresentationPayload, 타 채널 이미 처리)

파일: `codebase/channel-web-chat/src/lib/presentation.ts`

1. **`asEnvelope(p)` 헬퍼 신설**: PresentationPayload(`typeof p.type==='string' && p.payload` 객체)면
   `{ config: payload, output: payload }` 로 펼침(to* 가 config·output 양쪽을 읽으므로 둘 다 payload 로). 아니면
   기존 `{ config: p.config, output: p.output }`.
2. **`classifyPresentation`**: `p.type` 이 4종이면 우선 반환(PresentationPayload 경로). 아니면 기존 envelope shape 판별.
3. **`toCarousel`/`toTable`/`toChart`/`toTemplate`**: 3줄 env 추출을 `asEnvelope(p)` 로 교체.
4. **`toCarousel`**: payload-level `itemButtons`(모든 item 공통 액션 버튼, AI 카루셀의 "자세히 보기")를 각 item buttons 에
   병합 → `[...item.buttons, ...itemButtons]`. (노드 카루셀도 동일 개선.)
5. **`toTemplate`**: AI template payload 는 `content`(노드는 `rendered`) → `output.rendered ?? output.content` fallback.

# 테스트 (TDD)

`codebase/channel-web-chat/src/lib/presentation.test.ts`:
- classifyPresentation: PresentationPayload `{type:'carousel',payload}` → "carousel" (table/chart/template 동일).
- toCarousel(PresentationPayload): items/layout/global buttons + itemButtons 병합 검증(실 wire 픽스처 기반).
- toTemplate(PresentationPayload): `payload.content` → rendered.
- 기존 `{config,output}` envelope 회귀 유지 확인.
(가능 시 `presentations.test.tsx` 에 PresentationBlock(PresentationPayload) 렌더 1건.)

# spec
**변경 없음** — 기존 계약(위젯이 ai_message.presentations 렌더) 충족하는 버그 수정. 필요 시 코드 주석으로 두 shape 처리 명시.

# 리뷰
lint/build/test(앞) → `/ai-review` → critical/warning fix → `/consistency-check --impl-done` → push + PR.

# 주의
- AI 카루셀 items 가 `{title, buttons}` 만 있고 image/description 없으면 카드에 title+buttons 만 표시(데이터대로). *Field 매핑은 dynamic 모드용 — static 모드 items 직접 사용.
- `asButtons` 가 `userMessage` 를 drop 하는 것은 의도(위젯은 buttonId 만 전송, 백엔드 resolve).
