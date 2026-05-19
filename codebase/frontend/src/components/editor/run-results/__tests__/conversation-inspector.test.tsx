import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  ConversationInspector,
  SUMMARY_STRING_MAX,
  SUMMARY_VALUE_MAX,
  isAssistantContentBlank,
  summarizeToolResult,
} from "../conversation-inspector";
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

function makeBaseProps() {
  return {
    result: baseResult,
    conversationMessages: [] as ConversationItem[],
    selectedItemIndex: null,
    isLive: true,
    isWaitingAiResponse: false,
    conversationConfig: { turnCount: 1, maxTurns: 5 },
    onSendMessage: vi.fn(),
    onEndConversation: vi.fn(),
  };
}

describe("ConversationInspector SummaryView — tool 메시지 렌더링", () => {
  let baseProps: ReturnType<typeof makeBaseProps>;
  beforeEach(() => {
    baseProps = makeBaseProps();
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

    expect(screen.queryByText("🤖 AI")).toBeNull();
    expect(screen.getByText("🔧")).toBeInTheDocument();
    expect(screen.getByText("kb_search")).toBeInTheDocument();
    // durationMs 노출 검증
    expect(screen.getByText("124ms")).toBeInTheDocument();
  });

  // LLM provider 가 tool_use 사이에 빈 text 블록(" "/"\n") 을 같이 emit 하면
  // result.content 가 truthy 공백문자가 되어 SummaryView 가 MarkdownRenderer 만
  // 그리고 ToolCallBadge 분기로 진입하지 못하는 회귀가 있었다 (b5ddb4dd 의 strip
  // 도입 이후 marker 만 둘러쌌던 공백이 표면화). 본 케이스는 그 회귀를 차단한다.
  it("assistant content 가 whitespace-only 면 본문은 숨기고 ToolCallBadge 만 노출한다", () => {
    const items: ConversationItem[] = [
      makeItem({
        type: "assistant",
        content: " \n ",
        turnIndex: 1,
        assistantToolCalls: [{ name: "kb_search", arguments: "{}" }],
      }),
    ];

    render(
      <ConversationInspector
        {...baseProps}
        conversationMessages={items}
      />,
    );

    // (empty) placeholder 는 표시되지 않아야 한다 — 도구 호출이 있으니까.
    expect(screen.queryByText("(empty)")).toBeNull();
    // ToolCallBadge 가 노출돼 사용자가 도구 호출 사실을 인지할 수 있어야 한다.
    expect(screen.getByText("도구 호출")).toBeInTheDocument();
    expect(screen.getByText("1개 도구 호출")).toBeInTheDocument();
  });

  it("assistant content + toolCalls 가 둘 다 있으면 본문과 뱃지를 동시 노출한다", () => {
    const items: ConversationItem[] = [
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

    render(
      <ConversationInspector
        {...baseProps}
        conversationMessages={items}
      />,
    );

    // SelectedItemDetail 과 동일하게 본문 + 뱃지 양쪽 모두 노출.
    expect(
      screen.getByText("도구를 호출해 답변을 만들었어요."),
    ).toBeInTheDocument();
    expect(screen.getByText("도구 호출")).toBeInTheDocument();
    expect(screen.getByText("2개 도구 호출")).toBeInTheDocument();
    expect(screen.queryByText("(empty)")).toBeNull();
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

    expect(screen.getAllByText("🤖 AI")).toHaveLength(2);
    expect(screen.getAllByText("👤 User")).toHaveLength(1);
    expect(screen.getAllByText("🔧")).toHaveLength(1);
  });

  it("error 상태 tool 은 에러 메시지를 표시하고 XCircle 아이콘이 보인다", () => {
    const items: ConversationItem[] = [
      makeItem({
        type: "tool",
        content: "send_email",
        toolStatus: "error",
        error: "timeout after 30s",
      }),
    ];
    const { container } = render(
      <ConversationInspector {...baseProps} conversationMessages={items} />,
    );
    expect(screen.getByText(/timeout after 30s/)).toBeInTheDocument();
    expect(container.querySelector(".lucide-circle-x")).not.toBeNull();
    expect(container.querySelector(".lucide-circle-check-big")).toBeNull();
  });

  it("success 상태 tool 은 CheckCircle 아이콘을 표시한다", () => {
    const items: ConversationItem[] = [
      makeItem({
        type: "tool",
        content: "kb_search",
        toolStatus: "success",
        toolResult: ["x"],
      }),
    ];
    const { container } = render(
      <ConversationInspector {...baseProps} conversationMessages={items} />,
    );
    expect(container.querySelector(".lucide-circle-check-big")).not.toBeNull();
    expect(container.querySelector(".lucide-loader-circle")).toBeNull();
  });

  it("pending 상태 tool 은 Loader2 (animate-spin) 아이콘을 표시하고 결과 요약은 미노출", () => {
    const items: ConversationItem[] = [
      makeItem({
        type: "tool",
        content: "kb_search",
        toolStatus: "pending",
        toolResult: undefined,
      }),
    ];
    const { container } = render(
      <ConversationInspector {...baseProps} conversationMessages={items} />,
    );
    const loader = container.querySelector(".lucide-loader-circle");
    expect(loader).not.toBeNull();
    expect(loader?.classList.contains("animate-spin")).toBe(true);
    // 결과 요약 미노출 (· 로 시작하는 텍스트 노드 부재)
    expect(screen.queryByText(/^· /)).toBeNull();
  });

  it("Enter / Space 키로 tool 라인을 활성화하면 onSelectMessage 가 호출된다", () => {
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

    const toolLine = screen.getByText("kb_search").closest("[role=button]");
    expect(toolLine).not.toBeNull();
    fireEvent.keyDown(toolLine!, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith(1);
    onSelect.mockClear();
    fireEvent.keyDown(toolLine!, { key: " " });
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("onSelectMessage 가 없으면 tool 라인이 button 역할을 갖지 않는다", () => {
    const items: ConversationItem[] = [
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
      />,
    );
    const toolName = screen.getByText("kb_search");
    expect(toolName.closest("[role=button]")).toBeNull();
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

  it("History 모드 (isLive=false) 에서도 tool 메시지가 표시된다 (Critical fix 회귀 방지)", () => {
    const result: NodeResult = {
      ...baseResult,
      status: "completed",
      outputData: {
        result: {
          messages: [
            { role: "user", content: "hi" },
            {
              role: "assistant",
              content: "",
              toolCalls: [
                { id: "call_1", name: "kb_search", arguments: "{}" },
              ],
            },
            {
              role: "tool",
              content: '["chunk1","chunk2"]',
              toolCallId: "call_1",
            },
            { role: "assistant", content: "done" },
          ],
        },
      },
    };

    render(
      <ConversationInspector
        {...baseProps}
        result={result}
        conversationMessages={[]}
        isLive={false}
      />,
    );

    expect(screen.getByText("🔧")).toBeInTheDocument();
    expect(screen.getByText("kb_search")).toBeInTheDocument();
    expect(screen.getByText(/2 items/)).toBeInTheDocument();
  });
});

describe("summarizeToolResult", () => {
  it("null/undefined → 빈 문자열", () => {
    expect(summarizeToolResult(null)).toBe("");
    expect(summarizeToolResult(undefined)).toBe("");
  });

  it("배열 단수/복수 표현", () => {
    expect(summarizeToolResult([])).toBe("0 items");
    expect(summarizeToolResult(["a"])).toBe("1 item");
    expect(summarizeToolResult(["a", "b", "c"])).toBe("3 items");
  });

  it("문자열 — 임계값 이하/초과 처리", () => {
    expect(summarizeToolResult("hello")).toBe("hello");
    const exact = "a".repeat(SUMMARY_STRING_MAX);
    expect(summarizeToolResult(exact)).toBe(exact); // 임계 정확 일치 시 미truncate
    const long = "a".repeat(SUMMARY_STRING_MAX + 5);
    expect(summarizeToolResult(long)).toBe(`${"a".repeat(SUMMARY_STRING_MAX)}…`);
  });

  it("빈 객체 / 단일 키 / 다중 키", () => {
    expect(summarizeToolResult({})).toBe("{}");
    expect(summarizeToolResult({ id: 42 })).toBe("{id: 42}");
    expect(summarizeToolResult({ id: 42, name: "Hong" })).toBe(
      "{id: 42, +1}",
    );
  });

  it("객체 값은 따옴표 없이 raw 출력 (number/string/boolean 일관)", () => {
    expect(summarizeToolResult({ x: 42 })).toBe("{x: 42}");
    expect(summarizeToolResult({ x: "Hong" })).toBe("{x: Hong}");
    expect(summarizeToolResult({ x: true })).toBe("{x: true}");
  });

  it("객체 값이 nested object 면 [...] / {...} 로 방어", () => {
    expect(summarizeToolResult({ x: { nested: 1 } })).toBe("{x: {…}}");
    expect(summarizeToolResult({ x: [1, 2] })).toBe("{x: […]}");
  });

  it("객체 값이 SUMMARY_VALUE_MAX 초과 시 truncate", () => {
    const long = "v".repeat(SUMMARY_VALUE_MAX + 5);
    expect(summarizeToolResult({ x: long })).toBe(
      `{x: ${"v".repeat(SUMMARY_VALUE_MAX)}…}`,
    );
  });

  it("number / boolean 단독 값", () => {
    expect(summarizeToolResult(42)).toBe("42");
    expect(summarizeToolResult(true)).toBe("true");
    expect(summarizeToolResult(false)).toBe("false");
  });
});

// spec/conventions/conversation-thread.md §9 — source 별 시각 분기 렌더링
describe("ConversationInspector SummaryView — source 별 시각 분기 (§9.1)", () => {
  let baseProps: ReturnType<typeof makeBaseProps>;
  beforeEach(() => {
    baseProps = makeBaseProps();
  });

  it("presentation_user (button_click) 는 회색 시스템 카드 + nodeLabel chip + buttonLabel 본문으로 렌더", () => {
    const items: ConversationItem[] = [
      makeItem({
        type: "presentation",
        content: "clicked: AI와 대화하기",
        turnIndex: 0,
        presentation: {
          nodeLabel: "Template",
          nodeType: "template",
          interactionType: "button_click",
          data: { buttonId: "open_chat", buttonLabel: "AI와 대화하기" },
        },
      }),
    ];
    render(<ConversationInspector {...baseProps} conversationMessages={items} />);

    // 시각 신호 ① 아이콘 (🧩) + ③ chip (nodeLabel) + 인터랙션 라벨
    expect(screen.getByText("🧩")).toBeInTheDocument();
    expect(screen.getByText("Template")).toBeInTheDocument();
    // 인터랙션 라벨 (i18n KO 기본 — "버튼 클릭")
    expect(screen.getByText(/button clicked|버튼 클릭/i)).toBeInTheDocument();

    // 본문은 buttonLabel ("AI와 대화하기") — `clicked:` 동사 prefix 는
    // 헤더로 흡수되어 본문에 중복 노출되지 않아야 한다.
    expect(screen.getByText("AI와 대화하기")).toBeInTheDocument();
    expect(screen.queryByText(/^clicked:/)).not.toBeInTheDocument();
  });

  it("presentation_user (form_submitted) 는 data 의 key-value 를 표로 표시", () => {
    const items: ConversationItem[] = [
      makeItem({
        type: "presentation",
        content: "name=Alice, age=30",
        turnIndex: 0,
        presentation: {
          nodeLabel: "Form1",
          nodeType: "form",
          interactionType: "form_submitted",
          data: { name: "Alice", age: 30 },
        },
      }),
    ];
    render(<ConversationInspector {...baseProps} conversationMessages={items} />);

    expect(screen.getByText("Form1")).toBeInTheDocument();
    expect(screen.getByText(/form submitted|폼 제출/i)).toBeInTheDocument();
    expect(screen.getByText("name")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("age")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
  });

  it("presentation_user (button_continue) 는 URL 을 본문에 표시", () => {
    const items: ConversationItem[] = [
      makeItem({
        type: "presentation",
        content: "continued: https://example.com",
        turnIndex: 0,
        presentation: {
          nodeLabel: "Link",
          nodeType: "template",
          interactionType: "button_continue",
          data: {
            buttonId: "go",
            buttonLabel: "Open",
            url: "https://example.com",
          },
        },
      }),
    ];
    render(<ConversationInspector {...baseProps} conversationMessages={items} />);
    expect(screen.getByText(/link continue|링크 이동/i)).toBeInTheDocument();
    expect(screen.getByText("https://example.com")).toBeInTheDocument();
  });

  it("system 아이템은 ℹ️ system note 라인으로 렌더 (v1 자동 push 없음, UI 형식만 미리 구현)", () => {
    const items: ConversationItem[] = [
      makeItem({
        type: "system",
        content: "안내 메시지",
        turnIndex: 0,
      }),
    ];
    render(<ConversationInspector {...baseProps} conversationMessages={items} />);
    expect(screen.getByText(/system note|시스템 알림/i)).toBeInTheDocument();
    expect(screen.getByText(/안내 메시지/)).toBeInTheDocument();
  });

  it("form_submitted with empty data shows '(no fields)' placeholder", () => {
    const items: ConversationItem[] = [
      makeItem({
        type: "presentation",
        content: "",
        turnIndex: 0,
        presentation: {
          nodeLabel: "EmptyForm",
          nodeType: "form",
          interactionType: "form_submitted",
          data: {},
        },
      }),
    ];
    render(<ConversationInspector {...baseProps} conversationMessages={items} />);
    expect(screen.getByText(/no fields/i)).toBeInTheDocument();
  });

  it("button_continue with missing url renders empty body (no crash)", () => {
    const items: ConversationItem[] = [
      makeItem({
        type: "presentation",
        content: "",
        turnIndex: 0,
        presentation: {
          nodeLabel: "Link",
          nodeType: "template",
          interactionType: "button_continue",
          data: { buttonId: "go", buttonLabel: "Open" },
        },
      }),
    ];
    expect(() =>
      render(<ConversationInspector {...baseProps} conversationMessages={items} />),
    ).not.toThrow();
    expect(screen.getByText(/link continue|링크 이동/i)).toBeInTheDocument();
  });

  it("form_submitted with nested object value JSON.stringify-s the cell", () => {
    const items: ConversationItem[] = [
      makeItem({
        type: "presentation",
        content: "",
        turnIndex: 0,
        presentation: {
          nodeLabel: "Form",
          nodeType: "form",
          interactionType: "form_submitted",
          data: { items: [1, 2, 3] },
        },
      }),
    ];
    render(<ConversationInspector {...baseProps} conversationMessages={items} />);
    expect(screen.getByText("[1,2,3]")).toBeInTheDocument();
  });

  it("presentation / system items render without a timestamp (undefined) without crash", () => {
    const items: ConversationItem[] = [
      makeItem({
        type: "presentation",
        content: "",
        turnIndex: 0,
        presentation: {
          nodeLabel: "T",
          nodeType: "template",
          interactionType: "button_click",
          data: { buttonId: "x", buttonLabel: "X" },
        },
      }),
      makeItem({ type: "system", content: "note", turnIndex: 0 }),
    ];
    expect(() =>
      render(<ConversationInspector {...baseProps} conversationMessages={items} />),
    ).not.toThrow();
  });

  it("strips [user-input]…[/user-input] markers from user message rendering (§9.5 compat through SummaryView)", () => {
    // Defense-in-depth: even if a legacy persisted message reaches the
    // renderer with markers intact, the SummaryView's history rebuild path
    // (parseHistoryMessages mirror) calls stripInlineMarkers so the visible
    // body stays clean.
    const items: ConversationItem[] = [
      makeItem({
        type: "user",
        content: "안녕하세요",
        turnIndex: 1,
      }),
    ];
    render(<ConversationInspector {...baseProps} conversationMessages={items} />);
    // direct content (converter already stripped any markers before this).
    expect(screen.getByText("안녕하세요")).toBeInTheDocument();
  });

  it("진짜 ai_user 메시지는 chat bubble (👤 User) 로 유지되어 presentation 카드와 시각적으로 구분", () => {
    const items: ConversationItem[] = [
      makeItem({
        type: "presentation",
        content: "clicked: AI와 대화하기",
        turnIndex: 0,
        presentation: {
          nodeLabel: "Template",
          nodeType: "template",
          interactionType: "button_click",
          data: { buttonId: "chat", buttonLabel: "AI와 대화하기" },
        },
      }),
      makeItem({ type: "user", content: "어떤 상품이 있는지 알려줘", turnIndex: 1 }),
    ];
    render(<ConversationInspector {...baseProps} conversationMessages={items} />);

    // 진짜 user 메시지는 여전히 👤 User 헤더
    expect(screen.getByText("👤 User")).toBeInTheDocument();
    expect(screen.getByText("어떤 상품이 있는지 알려줘")).toBeInTheDocument();
    // presentation 카드는 별도 chip 으로 격하 표시
    expect(screen.getByText("🧩")).toBeInTheDocument();
    expect(screen.getByText("Template")).toBeInTheDocument();
  });
});

describe("isAssistantContentBlank", () => {
  it("string 이 아니면 blank 로 본다 (null/undefined/number)", () => {
    expect(isAssistantContentBlank(null)).toBe(true);
    expect(isAssistantContentBlank(undefined)).toBe(true);
    expect(isAssistantContentBlank(0)).toBe(true);
  });

  it("빈 문자열·공백문자열·줄바꿈만 있으면 blank", () => {
    expect(isAssistantContentBlank("")).toBe(true);
    expect(isAssistantContentBlank(" ")).toBe(true);
    expect(isAssistantContentBlank("\n")).toBe(true);
    expect(isAssistantContentBlank(" \t\n  ")).toBe(true);
  });

  it("실질 문자가 한 글자라도 있으면 non-blank", () => {
    expect(isAssistantContentBlank("a")).toBe(false);
    expect(isAssistantContentBlank(" a ")).toBe(false);
    expect(isAssistantContentBlank("도구 호출")).toBe(false);
  });
});

describe("ConversationInspector SelectedItemDetail — content/toolCalls 헤더 정규화", () => {
  let baseProps: ReturnType<typeof makeBaseProps>;
  beforeEach(() => {
    baseProps = makeBaseProps();
  });

  it("content 가 비어있고 toolCalls 만 있으면 'Tool Call — Turn N' 라벨", () => {
    const items: ConversationItem[] = [
      makeItem({
        type: "assistant",
        content: "",
        turnIndex: 1,
        assistantToolCalls: [{ name: "kb_search", arguments: "{}" }],
      }),
    ];
    render(
      <ConversationInspector
        {...baseProps}
        conversationMessages={items}
        selectedItemIndex={0}
      />,
    );
    expect(screen.getByText(/Tool Call — Turn 1/)).toBeInTheDocument();
  });

  it("content 가 whitespace-only 이고 toolCalls 만 있으면 'Tool Call — Turn N' 라벨 (회귀)", () => {
    const items: ConversationItem[] = [
      makeItem({
        type: "assistant",
        content: " \n ",
        turnIndex: 2,
        assistantToolCalls: [{ name: "kb_search", arguments: "{}" }],
      }),
    ];
    render(
      <ConversationInspector
        {...baseProps}
        conversationMessages={items}
        selectedItemIndex={0}
      />,
    );
    // SummaryView 와 동일한 blank 기준을 따라야 한다.
    expect(screen.getByText(/Tool Call — Turn 2/)).toBeInTheDocument();
    expect(screen.queryByText(/AI Response — Turn 2/)).toBeNull();
  });

  it("실질 content 가 있으면 toolCalls 동반이어도 'AI Response — Turn N' 라벨", () => {
    const items: ConversationItem[] = [
      makeItem({
        type: "assistant",
        content: "답변 본문",
        turnIndex: 3,
        assistantToolCalls: [{ name: "kb_search", arguments: "{}" }],
      }),
    ];
    render(
      <ConversationInspector
        {...baseProps}
        conversationMessages={items}
        selectedItemIndex={0}
      />,
    );
    expect(screen.getByText(/AI Response — Turn 3/)).toBeInTheDocument();
  });
});
