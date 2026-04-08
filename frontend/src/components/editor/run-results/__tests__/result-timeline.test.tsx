import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ResultTimeline } from "../result-timeline";
import type { NodeResult } from "@/lib/stores/execution-store";

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

  it("auto-selects first result when nothing selected", () => {
    const onSelect = vi.fn();
    const results = [makeResult({ nodeId: "first" })];

    render(
      <ResultTimeline results={results} selectedId={null} onSelect={onSelect} conversationMessages={[]} selectedConversationItemIndex={null} onSelectConversationItem={vi.fn()} isLiveConversation={false} />,
    );

    expect(onSelect).toHaveBeenCalledWith("first");
  });
});
