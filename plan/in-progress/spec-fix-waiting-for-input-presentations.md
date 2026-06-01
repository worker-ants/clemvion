---
worktree: channel-web-chat-followups-1feff2
started: 2026-06-02
owner: resolution-applier
---
# Spec Fix Draft — waiting_for_input presentations

## 원본 발견사항
SUMMARY#W3: `waiting_for_input` 이벤트의 presentations 렌더 미구현 — spec §1-widget-app §2 갭.
위치: `channel-web-chat/src/widget/use-widget.ts` `handleEiaEvent`, `src/lib/eia-types.ts` `WaitingForInputEvent`.
현재 `execution.waiting_for_input` 핸들러는 `presentations` 필드를 처리하지 않는다.

## 질문 (spec 명확화 필요)

1. `waiting_for_input` 이벤트가 `presentations` 필드를 **독립적으로** 전달하는가?
   즉, `waiting_for_input.presentations[]` 는 `ai_message.presentations[]` 와 별개로
   해당 노드에서 사용자에게 보여줄 추가 컨텍스트인가?

2. 아니면 `waiting_for_input` 직전에 항상 `ai_message` 이벤트가 오고, presentations 는
   그 `ai_message` 에만 실린다고 보면 되는가?

3. `WaitingForInputEvent` 타입에 `presentations` 필드를 추가해야 하면,
   `context.conversationThread.turns` 의 마지막 turn 과 중복 가능성이 있는가?

## 제안 변경 (spec 확인 후 적용)

spec §1-widget-app §2, spec §4-nodes/6-presentation 및 EIA 이벤트 계약을 기반으로:

```typescript
// eia-types.ts 에 추가 제안
export interface WaitingForInputEvent {
  // 기존 필드...
  presentations?: Array<Record<string, unknown>>; // spec 확인 필요
}
```

```typescript
// use-widget.ts handleEiaEvent 내 waiting_for_input 핸들러에 추가 제안
if (ev.presentations?.length) {
  dispatch({ type: "AI_MESSAGE", text: "", presentations: ev.presentations });
}
```

spec 확인 후 project-planner 가 `spec/7-channel-web-chat/1-widget-app.md §2` 및
`spec/4-nodes/6-presentation/` 관련 문서를 갱신하면 developer 가 구현한다.
