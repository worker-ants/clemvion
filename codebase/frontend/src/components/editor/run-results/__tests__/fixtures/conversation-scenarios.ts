/**
 * spec/conventions/conversation-thread.md §9.10 — 회귀 차단 시나리오.
 *
 * 본 모듈은 §9.10 표의 CT-S1 ~ CT-S7 시나리오 입력을 **단일 export 로** 제공한다.
 * conversation timeline 관련 코드 (`conversation-inspector.tsx`,
 * `conversation-utils.ts`, `use-execution-events.ts`) 를 수정하는 모든 PR 은
 * 본 fixture 를 import 한 단위 테스트로 회귀를 차단할 의무가 있다 (Inv-1 ~
 * Inv-4 의 검증 입력원).
 *
 * 신규 시나리오는 spec §9.10 표에 한 줄 추가 후 본 모듈에 fixture 를 추가한다.
 * fixture 만 추가하고 spec 표 갱신을 누락하면 SoT drift 가 발생하므로 PR review
 * 단계에서 두 변경이 짝지어 들어왔는지 확인해야 한다.
 */

import type { ConversationItem } from "@/lib/stores/execution-store";

/**
 * 단일 ConversationItem 헬퍼 — `type: "user"` 기본값 + override.
 * 본 fixture 모듈 외부에서는 사용하지 말 것 (구조 변경 시 자유롭게 갱신).
 */
function makeItem(overrides: Partial<ConversationItem>): ConversationItem {
  return {
    type: "user",
    content: "",
    turnIndex: 1,
    ...overrides,
  } as ConversationItem;
}

/**
 * CT-S1: LLM 이 whitespace content + tool_use 동시 emit.
 *
 * 검증 포인트: `isAssistantContentBlank` 가 whitespace 를 blank 로 동치 처리해
 * §9.6 의 tool-call group parent 조건이 만족되는지.
 */
export const ctS1WhitespaceContentWithToolCalls: ConversationItem[] = [
  makeItem({
    type: "assistant",
    content: " \n ",
    turnIndex: 1,
    assistantToolCalls: [{ name: "kb_search", arguments: "{}" }],
  }),
  makeItem({
    type: "tool",
    content: "kb_search",
    turnIndex: 1,
    toolCallId: "call_1",
    toolStatus: "success",
  }),
];

/**
 * CT-S2: `includeToolTurns: false` lean thread + 1 tool 호출.
 *
 * `prev` 는 직전 `ai_message` 가 채워둔 messages-base snapshot (user + intermediate
 * assistant + tool + final assistant). `threadItems` 는 lean thread snapshot
 * (user + final assistant) 만 포함. `mergeOrphanToolItems(threadItems, prev)`
 * 이 tool/intermediate 를 보존하는지 검증.
 */
export const ctS2LeanThreadSingleTool = {
  prev: [
    makeItem({ type: "user", content: "질문" }),
    makeItem({
      type: "assistant",
      content: "",
      turnIndex: 1,
      assistantToolCalls: [{ name: "kb_search", arguments: "{}" }],
    }),
    makeItem({
      type: "tool",
      content: "kb_search",
      turnIndex: 1,
      toolCallId: "call_1",
      toolStatus: "success",
    }),
    makeItem({ type: "assistant", content: "최종 답변", turnIndex: 1 }),
  ] as ConversationItem[],
  threadItems: [
    makeItem({ type: "user", content: "질문" }),
    makeItem({ type: "assistant", content: "최종 답변", turnIndex: 1 }),
  ] as ConversationItem[],
};

/**
 * CT-S3: `includeToolTurns: false` + 한 turn 안 2 LLM call × N tools.
 *
 * 사용자 보고 시나리오 (2026-05-19, PR #214 직전): bot1 이 2 tools 동시 호출,
 * bot2 가 1 tool 호출. 각 parent 가 자기 toolCalls.length 만큼 후행 unclaimed
 * tool 을 sequence-claim 하는지, 중복 그룹이 없는지 검증.
 */
export const ctS3MultipleParentsParallelTools: ConversationItem[] = [
  makeItem({ type: "user", content: "어떤 상품들이 판매중이야?" }),
  makeItem({
    type: "assistant",
    content: "",
    turnIndex: 1,
    assistantToolCalls: [
      { name: "mcp_store_get", arguments: "{}" },
      { name: "mcp_product_list", arguments: "{}" },
    ],
  }),
  makeItem({
    type: "assistant",
    content: "",
    turnIndex: 1,
    assistantToolCalls: [{ name: "mcp_category_list", arguments: "{}" }],
  }),
  makeItem({
    type: "tool",
    content: "mcp_store_get",
    turnIndex: 1,
    toolCallId: "c1",
    toolStatus: "success",
  }),
  makeItem({
    type: "tool",
    content: "mcp_product_list",
    turnIndex: 1,
    toolCallId: "c2",
    toolStatus: "success",
  }),
  makeItem({
    type: "tool",
    content: "mcp_category_list",
    turnIndex: 1,
    toolCallId: "c3",
    toolStatus: "success",
  }),
  makeItem({
    type: "assistant",
    content: "현재 쇼핑몰에는 ...",
    turnIndex: 1,
  }),
];

/**
 * CT-S4: `includeToolTurns: true` — thread 가 이미 모든 row 를 enumerate.
 *
 * `mergeOrphanToolItems` 가 no-op 으로 작동하는지 (중복 추가 없음) 검증.
 */
export const ctS4FullThreadNoOpMerge: ConversationItem[] = [
  makeItem({ type: "user", content: "질문" }),
  makeItem({
    type: "assistant",
    content: "",
    turnIndex: 1,
    assistantToolCalls: [{ name: "kb_search", arguments: "{}" }],
  }),
  makeItem({
    type: "tool",
    content: "kb_search",
    turnIndex: 1,
    toolCallId: "call_1",
    toolStatus: "success",
  }),
  makeItem({ type: "assistant", content: "최종", turnIndex: 1 }),
];

/**
 * CT-S5: LLM 이 thinking text + tool_use 동시 emit.
 *
 * content 가 blank 가 아니므로 parent 그룹으로 분류하지 않고 §9.1 의 표준
 * `ai_assistant` chat bubble + ToolCallBadge 동시 노출. heuristic 한계 케이스.
 */
export const ctS5ThinkingTextWithToolCalls: ConversationItem[] = [
  makeItem({
    type: "assistant",
    content: "도구를 호출해 답변을 만들었어요.",
    turnIndex: 1,
    assistantToolCalls: [
      { name: "kb_search", arguments: "{}" },
      { name: "mcp_query", arguments: "{}" },
    ],
  }),
];

/**
 * CT-S6: multi-turn — turn 1 tool + turn 2 tool.
 *
 * turn 경계가 parent-child sequence-claim 을 가로지르지 않는지 검증.
 */
export const ctS6MultiTurnIsolation: ConversationItem[] = [
  makeItem({ type: "user", content: "Q1", turnIndex: 1 }),
  makeItem({
    type: "assistant",
    content: "",
    turnIndex: 1,
    assistantToolCalls: [{ name: "tool_A", arguments: "{}" }],
  }),
  makeItem({
    type: "tool",
    content: "tool_A",
    turnIndex: 1,
    toolCallId: "c1",
    toolStatus: "success",
  }),
  makeItem({ type: "assistant", content: "A1", turnIndex: 1 }),
  makeItem({ type: "user", content: "Q2", turnIndex: 2 }),
  makeItem({
    type: "assistant",
    content: "",
    turnIndex: 2,
    assistantToolCalls: [{ name: "tool_B", arguments: "{}" }],
  }),
  makeItem({
    type: "tool",
    content: "tool_B",
    turnIndex: 2,
    toolCallId: "c2",
    toolStatus: "success",
  }),
  makeItem({ type: "assistant", content: "A2", turnIndex: 2 }),
];

/**
 * CT-S7: `tool_call_completed` 가 `ai_message` 보다 늦게 도착 (out-of-order).
 *
 * §9.7 의 `ai_message` REPLACE 행의 carry-over policy 검증 — `toolStatus` /
 * `durationMs` / `error` 가 prev 의 동일 `toolCallId` 항목에서 보존되어
 * snapshot 의 빈 상태가 success 를 pending 으로 회귀시키지 않는지.
 */
export const ctS7CarryOverOutOfOrder = {
  prev: [
    makeItem({
      type: "tool",
      content: "kb_search",
      turnIndex: 1,
      toolCallId: "call_1",
      toolStatus: "success",
      durationMs: 124,
    }),
  ] as ConversationItem[],
  /**
   * ai_message payload.messages 형식 — `toolStatus` 가 비어있어도 carry-over
   * 로 prev 의 success 가 보존돼야 한다.
   */
  aiMessagePayload: {
    messages: [
      {
        role: "user" as const,
        content: "질문",
      },
      {
        role: "assistant" as const,
        content: "",
        toolCalls: [{ id: "call_1", name: "kb_search", arguments: "{}" }],
      },
      {
        role: "tool" as const,
        content: "result",
        toolCallId: "call_1",
      },
      {
        role: "assistant" as const,
        content: "최종 답변",
      },
    ],
  },
};

/**
 * 시나리오 목록 enum 형 export — 누락 시 컴파일 에러로 즉시 발견.
 */
export const conversationScenarios = {
  ctS1WhitespaceContentWithToolCalls,
  ctS2LeanThreadSingleTool,
  ctS3MultipleParentsParallelTools,
  ctS4FullThreadNoOpMerge,
  ctS5ThinkingTextWithToolCalls,
  ctS6MultiTurnIsolation,
  ctS7CarryOverOutOfOrder,
} as const;
