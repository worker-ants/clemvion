import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConversationInspector } from "../conversation-inspector";
import type {
  ConversationItem,
  NodeResult,
} from "@/lib/stores/execution-store";

function makeItem(overrides: Partial<ConversationItem>): ConversationItem {
  return {
    type: "user",
    content: "",
    turnIndex: 1,
    ...overrides,
  } as ConversationItem;
}

const baseResult: NodeResult = {
  nodeId: "n1",
  nodeLabel: "AI Agent",
  nodeType: "ai_agent",
  nodeCategory: "ai",
  status: "running",
  duration: 0,
  outputData: null,
};

const baseProps = {
  result: baseResult,
  selectedItemIndex: null,
  isLive: true,
  isWaitingAiResponse: false,
  conversationConfig: { turnCount: 1, maxTurns: 5 },
  onSendMessage: vi.fn(),
  onEndConversation: vi.fn(),
};

describe("ConversationInspector SummaryView — tool 메시지 렌더링", () => {
  beforeEach(() => {
    baseProps.onSendMessage.mockClear();
    baseProps.onEndConversation.mockClear();
  });

  it("tool 아이템은 '🤖 AI' 라벨로 표시되지 않는다", () => {
    const items: ConversationItem[] = [
      makeItem({
        type: "tool",
        content: "kb_search",
        turnIndex: 1,
        toolCallId: "call_1",
        toolStatus: "success",
        toolResult: ["chunk1", "chunk2", "chunk3"],
        durationMs: 124,
      }),
    ];

    render(
      <ConversationInspector
        {...baseProps}
        conversationMessages={items}
      />,
    );

    // 시스템 라인 어디에도 "🤖 AI" 라벨이 없어야 한다
    expect(screen.queryByText("🤖 AI")).toBeNull();
    // 🔧 아이콘이 보여야 한다
    expect(screen.getByText("🔧")).toBeInTheDocument();
    // 툴 이름이 보여야 한다
    expect(screen.getByText("kb_search")).toBeInTheDocument();
  });

  it("user/assistant/tool 가 섞여 있어도 'AI' 라벨은 assistant 에만 붙는다", () => {
    const items: ConversationItem[] = [
      makeItem({ type: "user", content: "요금제 추천해줘" }),
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
        toolResult: ["chunk1", "chunk2", "chunk3"],
      }),
      makeItem({
        type: "assistant",
        content: "해피톡의 요금제는 ...",
        turnIndex: 1,
      }),
    ];

    render(
      <ConversationInspector
        {...baseProps}
        conversationMessages={items}
      />,
    );

    // 정확히 두 assistant 만 "🤖 AI" 라벨을 가져야 한다 (tool 은 제외)
    expect(screen.getAllByText("🤖 AI")).toHaveLength(2);
    // user 라벨은 1 개
    expect(screen.getAllByText("👤 User")).toHaveLength(1);
    // tool 시스템 라인의 🔧 는 1 개
    expect(screen.getAllByText("🔧")).toHaveLength(1);
  });

  it("배열 결과는 'N items' 로 요약된다", () => {
    const items: ConversationItem[] = [
      makeItem({
        type: "tool",
        content: "kb_search",
        toolStatus: "success",
        toolResult: ["a", "b", "c", "d"],
      }),
    ];
    render(
      <ConversationInspector {...baseProps} conversationMessages={items} />,
    );
    expect(screen.getByText(/4 items/)).toBeInTheDocument();
  });

  it("객체 결과는 첫 키 + 잔여 키 개수로 요약된다", () => {
    const items: ConversationItem[] = [
      makeItem({
        type: "tool",
        content: "fetch_user",
        toolStatus: "success",
        toolResult: { id: 42, name: "Hong", email: "x@y.z" },
      }),
    ];
    render(
      <ConversationInspector {...baseProps} conversationMessages={items} />,
    );
    expect(screen.getByText(/\{id: 42, \+2\}/)).toBeInTheDocument();
  });

  it("문자열 결과는 80자 초과 시 truncate 된다", () => {
    const long = "a".repeat(120);
    const items: ConversationItem[] = [
      makeItem({
        type: "tool",
        content: "echo",
        toolStatus: "success",
        toolResult: long,
      }),
    ];
    render(
      <ConversationInspector {...baseProps} conversationMessages={items} />,
    );
    // 80자 + 말줄임표 (prefix `· ` 포함된 한 텍스트 노드)
    expect(
      screen.getByText(new RegExp(`a{80}…$`)),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(new RegExp(`a{81}`)),
    ).toBeNull();
  });

  it("error 상태 tool 은 에러 메시지를 표시한다", () => {
    const items: ConversationItem[] = [
      makeItem({
        type: "tool",
        content: "send_email",
        toolStatus: "error",
        error: "timeout after 30s",
      }),
    ];
    render(
      <ConversationInspector {...baseProps} conversationMessages={items} />,
    );
    expect(screen.getByText(/timeout after 30s/)).toBeInTheDocument();
  });

  it("tool 라인을 클릭하면 onSelectMessage 가 해당 인덱스로 호출된다", () => {
    const onSelect = vi.fn();
    const items: ConversationItem[] = [
      makeItem({ type: "user", content: "hi" }),
      makeItem({
        type: "tool",
        content: "kb_search",
        toolStatus: "success",
        toolResult: ["x"],
      }),
    ];
    render(
      <ConversationInspector
        {...baseProps}
        conversationMessages={items}
        onSelectMessage={onSelect}
      />,
    );

    fireEvent.click(screen.getByText("kb_search"));
    expect(onSelect).toHaveBeenCalledWith(1);
  });
});
