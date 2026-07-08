import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/lib/i18n", async () => {
  const { ko } = await import("@/lib/i18n/dict/ko");
  const t = (key: string, params?: Record<string, unknown>): string => {
    const parts = key.split(".");
    let cur: unknown = ko;
    for (const p of parts) {
      if (!cur || typeof cur !== "object") return key;
      cur = (cur as Record<string, unknown>)[p];
    }
    if (typeof cur !== "string") return key;
    return params
      ? cur.replace(/\{\{(\w+)\}\}/g, (_m, k) => String(params[k] ?? ""))
      : cur;
  };
  return { useT: () => t, useLocale: () => "ko" as const };
});

vi.mock("@/components/auth/role-gate", () => ({
  RoleGate: ({ children }: { children: React.ReactNode }) => children,
}));

import { MemoryListPanel } from "../memory-list-panel";
import type { AgentMemoryData } from "@/lib/api/agent-memories";

const MEMORY: AgentMemoryData = {
  id: "m1",
  content: "user likes tea",
  kind: "fact",
  scopeKey: "cust-1",
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
  expiresAt: null,
};

function baseProps(
  over: Partial<React.ComponentProps<typeof MemoryListPanel>> = {},
) {
  return {
    selectedScope: "cust-1",
    memories: [MEMORY],
    memoryTotal: 1,
    isLoading: false,
    isError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    kindFilter: "all" as const,
    onKindFilterChange: vi.fn(),
    onRequestDeleteMemory: vi.fn(),
    onLoadMore: vi.fn(),
    ...over,
  };
}

describe("MemoryListPanel", () => {
  it("selectedScope=null 이면 placeholder", () => {
    render(<MemoryListPanel {...baseProps({ selectedScope: null })} />);
    expect(
      screen.getByText("왼쪽에서 scope 를 선택하면 메모리를 볼 수 있어요"),
    ).toBeInTheDocument();
  });

  it("isLoading 이면 스피너", () => {
    const { container } = render(
      <MemoryListPanel {...baseProps({ isLoading: true, memories: [] })} />,
    );
    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });

  it("memories 가 비면 빈 상태", () => {
    render(<MemoryListPanel {...baseProps({ memories: [] })} />);
    expect(screen.getByText("이 scope 에는 메모리가 없어요")).toBeInTheDocument();
  });

  it("kind 가 미지정 enum 이면 라벨을 원문 그대로 표시 (fallback)", () => {
    render(
      <MemoryListPanel
        {...baseProps({
          memories: [{ ...MEMORY, kind: "weird-kind" }],
        })}
      />,
    );
    // KIND_META 에 없는 kind 는 kindLabel 이 원문을 반환한다.
    expect(screen.getByText("weird-kind")).toBeInTheDocument();
  });

  it("삭제 버튼 → onRequestDeleteMemory(id)", () => {
    const onRequestDeleteMemory = vi.fn();
    render(<MemoryListPanel {...baseProps({ onRequestDeleteMemory })} />);
    fireEvent.click(screen.getByRole("button", { name: "메모리 삭제" }));
    expect(onRequestDeleteMemory).toHaveBeenCalledWith("m1");
  });

  it("hasNextPage 면 load more → onLoadMore", () => {
    const onLoadMore = vi.fn();
    render(
      <MemoryListPanel {...baseProps({ hasNextPage: true, onLoadMore })} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "더 보기" }));
    expect(onLoadMore).toHaveBeenCalled();
  });
});
