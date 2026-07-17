import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ResultTimeline } from "../result-timeline";
import type { NodeResult } from "@/lib/stores/execution-store";
import {
  ctS18RagAndToolSameTurn,
  ctS19NoTurnDebug,
} from "./fixtures/conversation-scenarios";

function makeResult(overrides: Partial<NodeResult> = {}): NodeResult {
  return {
    nodeId: "n1",
    nodeLabel: "Node 1",
    nodeType: "http_request",
    nodeCategory: "integration",
    status: "completed",
    duration: 142,
    outputData: null,
    ...overrides,
  };
}

describe("ResultTimeline", () => {
  it("renders all results in the list", () => {
    const results = [
      makeResult({ nodeId: "n1", nodeLabel: "Trigger", nodeCategory: "trigger", status: "completed" }),
      makeResult({ nodeId: "n2", nodeLabel: "HTTP Request", nodeCategory: "integration", status: "completed" }),
      makeResult({ nodeId: "n3", nodeLabel: "Table", nodeCategory: "presentation", status: "completed" }),
    ];

    render(
      <ResultTimeline results={results} selectedId={null} onSelect={vi.fn()} conversationMessages={[]} selectedConversationItemIndex={null} onSelectConversationItem={vi.fn()} isLiveConversation={false} />,
    );

    expect(screen.getByText("Trigger")).toBeDefined();
    expect(screen.getByText("HTTP Request")).toBeDefined();
    expect(screen.getByText("Table")).toBeDefined();
  });

  it("highlights the selected item", () => {
    const results = [
      makeResult({ nodeId: "n1", nodeLabel: "Node A" }),
      makeResult({ nodeId: "n2", nodeLabel: "Node B" }),
    ];

    const { container } = render(
      <ResultTimeline results={results} selectedId="n1" onSelect={vi.fn()} conversationMessages={[]} selectedConversationItemIndex={null} onSelectConversationItem={vi.fn()} isLiveConversation={false} />,
    );

    const buttons = container.querySelectorAll("button");
    expect(buttons[0].className).toContain("bg-[hsl(var(--accent))]");
    expect(buttons[1].className).not.toContain("bg-[hsl(var(--accent))]");
  });

  it("calls onSelect when clicking an item", () => {
    const onSelect = vi.fn();
    const results = [makeResult({ nodeId: "n1", nodeLabel: "Click Me" })];

    render(
      <ResultTimeline results={results} selectedId={null} onSelect={onSelect} conversationMessages={[]} selectedConversationItemIndex={null} onSelectConversationItem={vi.fn()} isLiveConversation={false} />,
    );

    fireEvent.click(screen.getByText("Click Me"));
    expect(onSelect).toHaveBeenCalledWith("n1");
  });

  it("displays duration badge", () => {
    const results = [makeResult({ duration: 142 })];

    render(
      <ResultTimeline results={results} selectedId={null} onSelect={vi.fn()} conversationMessages={[]} selectedConversationItemIndex={null} onSelectConversationItem={vi.fn()} isLiveConversation={false} />,
    );

    expect(screen.getByText("142ms")).toBeDefined();
  });

  it("displays seconds for long durations", () => {
    const results = [makeResult({ duration: 2500 })];

    render(
      <ResultTimeline results={results} selectedId={null} onSelect={vi.fn()} conversationMessages={[]} selectedConversationItemIndex={null} onSelectConversationItem={vi.fn()} isLiveConversation={false} />,
    );

    expect(screen.getByText("2.5s")).toBeDefined();
  });

  it("shows expandable conversation for multi-turn information extractor", () => {
    const results = [
      makeResult({
        nodeId: "n1",
        nodeLabel: "Extractor",
        nodeType: "information_extractor",
        nodeCategory: "ai",
        status: "completed",
        outputData: {
          config: { schema: {}, mode: "multi_turn" },
          output: {
            extracted: { name: "Alice" },
            messages: [
              { role: "user", content: "My name is Alice" },
              { role: "assistant", content: "Got it." },
            ],
            endReason: "completed",
            turnCount: 1,
          },
          meta: { interactionType: "ai_conversation" },
        },
      }),
    ];

    render(
      <ResultTimeline
        results={results}
        selectedId="n1"
        onSelect={vi.fn()}
        conversationMessages={[]}
        selectedConversationItemIndex={null}
        onSelectConversationItem={vi.fn()}
        isLiveConversation={false}
      />,
    );

    expect(screen.getByText("Extractor")).toBeDefined();
    // Multi-turn nodes show robot emoji indicator
    expect(screen.getByText("🤖")).toBeDefined();
    // Click to expand and verify conversation items appear
    fireEvent.click(screen.getByText("Extractor"));
    expect(screen.getByText("My name is Alice")).toBeDefined();
    expect(screen.getByText("Got it.")).toBeDefined();
  });

  // C-18 regression guard: structured envelope keeps `turnCount` in
  // `output.result.*` and `maxTurns` in top-level `config.*` (handler never
  // echoes `output.conversationConfig`). The denominator must be read from
  // `config.maxTurns`, otherwise it falls back to 0 and "/M" is hidden.
  it("reads Turn denominator from config.maxTurns in structured envelope", () => {
    const results = [
      makeResult({
        nodeId: "n1",
        nodeLabel: "Agent",
        nodeType: "ai_agent",
        nodeCategory: "ai",
        status: "completed",
        outputData: {
          config: { mode: "multi_turn", maxTurns: 5 },
          output: {
            result: {
              turnCount: 3,
              endReason: "completed",
              messages: [{ role: "user", content: "hi" }],
            },
          },
          meta: { interactionType: "ai_conversation" },
        },
      }),
    ];

    const { container } = render(
      <ResultTimeline
        results={results}
        selectedId="n1"
        onSelect={vi.fn()}
        conversationMessages={[]}
        selectedConversationItemIndex={null}
        onSelectConversationItem={vi.fn()}
        isLiveConversation={false}
      />,
    );

    expect(container.textContent).toContain("Turn 3/5");
  });

  it("does not show conversation UI for non-conversation waiting nodes", () => {
    const results = [
      makeResult({
        nodeId: "n1",
        nodeLabel: "My Form",
        nodeType: "form",
        nodeCategory: "presentation",
        status: "waiting_for_input",
        outputData: null,
      }),
    ];

    render(
      <ResultTimeline
        results={results}
        selectedId={null}
        onSelect={vi.fn()}
        conversationMessages={[]}
        selectedConversationItemIndex={null}
        onSelectConversationItem={vi.fn()}
        isLiveConversation={true}
      />,
    );

    expect(screen.getByText("My Form")).toBeDefined();
    // Should NOT show robot emoji (not a conversation node)
    expect(screen.queryByText("🤖")).toBeNull();
  });

  it("auto-selects first result when nothing selected", () => {
    const onSelect = vi.fn();
    const results = [makeResult({ nodeId: "first" })];

    render(
      <ResultTimeline results={results} selectedId={null} onSelect={onSelect} conversationMessages={[]} selectedConversationItemIndex={null} onSelectConversationItem={vi.fn()} isLiveConversation={false} />,
    );

    expect(onSelect).toHaveBeenCalledWith("first");
  });

  // spec/conventions/conversation-thread.md §9.10 CT-S18 (e) — §9.6 "적용 surface"
  // 는 🔎 `rag` 행이 conversation Preview 와 **본 실행 트리 timeline 양쪽**에
  // 동시에 나타날 것을 강제한다. 한쪽만 주입하면 두 surface 가 공유하는
  // `selectedConversationItemIndex` 가 어긋나 선택이 다른 항목을 가리킨다.
  it("CT-S18(e): 완료된 대화 노드 expand 시 🔎 rag 행이 실행 트리 timeline 에도 나타난다", () => {
    const aiAgentResult = makeResult({
      nodeId: "ai-1",
      nodeLabel: "AI Agent",
      nodeType: "ai_agent",
      nodeCategory: "ai",
      status: "completed",
      outputData: ctS18RagAndToolSameTurn.outputData as never,
    });

    render(
      <ResultTimeline
        results={[aiAgentResult]}
        selectedId="ai-1"
        onSelect={vi.fn()}
        conversationMessages={[]}
        selectedConversationItemIndex={null}
        onSelectConversationItem={vi.fn()}
        isLiveConversation={false}
      />,
    );

    // 노드 행 클릭으로 대화 항목 expand.
    fireEvent.click(screen.getByText("AI Agent"));

    // 🔎 행의 chip — 도구 행(🔧 kb_search) 과 별개로 존재해야 한다.
    expect(screen.getByText(/KB · 2개 청크/)).toBeDefined();
    // 문서명이 dedup 되어 노출 (📚 chip·References 탭과 동일 sources).
    expect(screen.getByText(/환불\.md · 약관\.md/)).toBeDefined();
    // 도구 행은 그대로 — rag 가 도구를 대체하지 않는다.
    expect(screen.getByText("kb_search")).toBeDefined();
  });

  it("CT-S19: turnDebug 가 없으면 실행 트리 timeline 에 🔎 행이 없다", () => {
    const aiAgentResult = makeResult({
      nodeId: "ai-2",
      nodeLabel: "AI Agent",
      nodeType: "ai_agent",
      nodeCategory: "ai",
      status: "completed",
      outputData: ctS19NoTurnDebug.outputData as never,
    });

    render(
      <ResultTimeline
        results={[aiAgentResult]}
        selectedId="ai-2"
        onSelect={vi.fn()}
        conversationMessages={[]}
        selectedConversationItemIndex={null}
        onSelectConversationItem={vi.fn()}
        isLiveConversation={false}
      />,
    );

    fireEvent.click(screen.getByText("AI Agent"));

    expect(screen.queryByText(/KB ·/)).toBeNull();
    // 나머지 turn 은 정상 렌더 — 결측이 레이아웃을 깨지 않는다 (§9.12).
    expect(screen.getByText(/안녕/)).toBeDefined();
  });

  // spec/conventions/conversation-thread.md §9.6 "적용 surface" + Inv-5 (§9.9):
  // 좌측 실행 트리 timeline 도 conversation Preview 와 동일한 tool-call group
  // 정책을 따른다. 사용자 보고 (스크린샷 2026-05-19 오후 1:55): blank intermediate
  // assistant + 후행 tool 이 평면 노출돼 우측 Preview 와 시각 차이가 발생.
  // 본 케이스는 그 회귀를 차단한다.
  it("live 대화 노드 expand 시 blank intermediate assistant + tool 이 parent-child tree 로 묶인다 (Inv-5)", () => {
    const aiAgentResult = makeResult({
      nodeId: "ai-1",
      nodeLabel: "AI Agent",
      nodeType: "ai_agent",
      nodeCategory: "ai",
      status: "waiting_for_input",
      outputData: {
        interactionType: "ai_conversation",
        conversationConfig: { turnCount: 1, maxTurns: 5 },
      },
    });
    const conversationMessages = [
      { type: "user" as const, content: "지금 진열된 상품 알려줘", turnIndex: 1 },
      {
        type: "assistant" as const,
        content: "",
        turnIndex: 1,
        assistantToolCalls: [{ name: "mcp_product_list", arguments: "{}" }],
      },
      {
        type: "tool" as const,
        content: "mcp_product_list",
        turnIndex: 1,
        toolCallId: "c1",
        toolStatus: "success" as const,
      },
      {
        type: "assistant" as const,
        content: "현재 진열되어 판매 중인 상품은 ...",
        turnIndex: 1,
      },
    ];

    render(
      <ResultTimeline
        results={[aiAgentResult]}
        selectedId="ai-1"
        onSelect={vi.fn()}
        conversationMessages={conversationMessages}
        selectedConversationItemIndex={null}
        onSelectConversationItem={vi.fn()}
        isLiveConversation
      />,
    );

    // parent chip 헤더: "AI" + "1개 도구 호출" 노출. blank 봇 버블 단독 미노출.
    expect(screen.getByText("AI")).toBeDefined();
    expect(screen.getByText("1개 도구 호출")).toBeDefined();
    // child tool 도 정상 표시.
    expect(screen.getByText("mcp_product_list")).toBeDefined();
    // final assistant 본문은 그대로 표시.
    expect(screen.getByText(/현재 진열되어/)).toBeDefined();
  });
});
